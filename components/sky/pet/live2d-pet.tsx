'use client';

// Live2D 陪伴宠物 —— 独立小组件。固定单只模型(黑猫/白猫), 外部只控制"打开/关闭"。
// 关键坑: 不往 loadOml2d 传真实 DOM 的 parentElement —— 库内部会深合并整个配置,
// DOM 的循环引用会造成 "Maximum call stack size exceeded"。故让它挂到 body(隔离预览页正合适)。
// SSR 安全: 库只在 useEffect 里动态 import + mount, 服务端不执行。
//
// 可见性: 本组件自身 return null(宠物由 oml2d 挂到 body 右下角)。
// 开关由外部(主页右下角圆钮)通过 visible 控制, 本组件不再额外画关闭按钮。

import { useEffect, useRef, useState } from 'react';

// 库自托管在 public/vendor/oml2d/, 运行时以同源 ESM 加载本地副本。
// webpackIgnore: 打包器忽略它(不 resolve fs); 常量 specifier 让 tsc 不尝试解析类型。
const OML2D_LIB = '/vendor/oml2d/index.js';

type Oml2dLike = {
  stageSlideIn: () => Promise<void>;
  stageSlideOut: () => Promise<void>;
  // 库官方放大 API —— 顶层实例就有 setModelScale, 内部转发到模型控制器。
  setModelScale: (s: number) => void;
  // 库官方平移 API —— setModelPosition({x,y}) 转发到 models.setPosition。
  setModelPosition: (pos: { x: number; y: number }) => void;
};

// 模型的基准缩放(传给 oml2d models[].scale 的值)。
// UI 缩放倍数 scale 会乘以它得到模型内部的实际 scale, 保证"视觉与底层同步"。
const BASE_MODEL_SCALE = 0.18;

type PetStatus = 'loading' | 'ready' | 'error';

export function Live2DPet({
  modelPath,
  modelName = '小镜',
  visible,
  dockedPosition = 'right',
  primaryColor = '#0ea5e9',
  draggable = false,
  scale = 1,
  onStatusChange,
}: {
  modelPath: string;
  modelName?: string;
  visible: boolean;
  dockedPosition?: 'left' | 'right';
  primaryColor?: string;
  // 是否允许拖动宠物位置。开启后舞台会接收鼠标(可能挡住下方按钮, 但可挪开),
  // 关掉则舞台 pointer-events: none, 不挡任何点击。
  draggable?: boolean;
  // 宠物缩放倍数(1 = 原尺寸), 由外部按键控制放大/缩小
  scale?: number;
  onStatusChange?: (status: PetStatus, errorMsg?: string) => void;
}) {
  const instRef = useRef<Oml2dLike | null>(null);
  const [loaded, setLoaded] = useState(false);

  // 模型基准几何(归一化到 UI 倍数=1 时的渲染盒宽高 + 盒子相对模型原点的偏移)。
  // getBounds 可能因库内部状态不稳定返回无效值, 全部判空 + try/catch 兜底, 兜底只做朴素缩放。
  const geomRef = useRef<{
    bw: number;
    bh: number;
    nOffX: number;
    nOffY: number;
    key: object | null;
  } | null>(null);

  // 宠物缩放 + 放大不溢出窗口:
  // 库的 setModelScale 从盒子左上角向右下生长, 而宠物停靠右下角, 放大必然冲出窗口右/下边缘。
  // 修法: 放大时把盒子右下角锚在舞台(窗口)右下角, 让它往左上生长; 再按舞台宽高限制倍数,
  // 保证放大后也始终在窗口内。缩小不特殊处理(只随倍数缩小, 天然不会溢出)。
  useEffect(() => {
    if (!loaded) return;
    const inst = instRef.current;
    if (!inst) return;

    let cancelled = false;
    let tries = 0;
    const MAX_TRIES = 30;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // 一次布局尝试: 读模型几何(可能因模型未就绪抛错), 成功则锚定右下角 + 转译舞台尺寸并返回 true。
    // getBounds 在模型纹理/几何尚未计算完时会抛内部 TypeError, 这是普通的"还没准备好", 不是真崩溃。
    const attempt = (): boolean => {
      if (cancelled) return true;
      try {
        const models = (inst as unknown as { models?: unknown }).models as
          | { model?: { scale?: { x: number }; x: number; y: number; getBounds?: () => { x: number; y: number; width: number; height: number } } }
          | undefined;
        const model = models?.model;
        const stage = document.getElementById('oml2d-stage');
        if (!model || typeof model.getBounds !== 'function' || !stage) {
          inst.setModelScale(BASE_MODEL_SCALE * scale);
          return true;
        }
        // 当前模型的实际"UI 倍数"(模型 scale / 基准 scale), 用于把测量值归一化到 UI 倍数=1。
        const currentUI = model.scale && model.scale.x && BASE_MODEL_SCALE ? model.scale.x / BASE_MODEL_SCALE : 1;
        const key = model as object;
        if (!geomRef.current || geomRef.current.key !== key) {
          const b = model.getBounds();
          if (!b || typeof b.width !== 'number' || typeof b.x !== 'number') {
            inst.setModelScale(BASE_MODEL_SCALE * scale);
            return true;
          }
          geomRef.current = {
            bw: b.width / currentUI,
            bh: b.height / currentUI,
            nOffX: (b.x - model.x) / currentUI,
            nOffY: (b.y - model.y) / currentUI,
            key,
          };
        }
        const g = geomRef.current;
        const sRect = stage.getBoundingClientRect();
        const win = window;
        const margin = 12;
        // 用「窗口」而非舞台尺寸做放大上限: 舞台已随猫缩到盒子后仍能继续放大, 不会被误判超窗。
        const fitR = Math.max(0.01, Math.min(scale, (win.innerWidth - margin) / g.bw, (win.innerHeight - margin) / g.bh));
        inst.setModelScale(BASE_MODEL_SCALE * fitR);
        // 让盒子右下角对准舞台右下角(舞台默认 bottom:0/right:0, 与窗口右下角重合),
        // 放大时盒子往左/上生长, 不超出窗口。
        inst.setModelPosition({
          x: sRect.width - g.bw * fitR - g.nOffX * fitR,
          y: sRect.height - g.bh * fitR - g.nOffY * fitR,
        });
        // 后框随猫自适应: 只改舞台 CSS 尺寸对齐猫的渲染盒, 并 overflow:hidden 裁掉多余的画布。
        // 不动画布本身(改画布会拉伸/裁剪 Pixi 渲染, 导致模糊)。
        stage.style.width = `${Math.ceil(g.bw * fitR)}px`;
        stage.style.height = `${Math.ceil(g.bh * fitR)}px`;
        stage.style.overflow = 'hidden';
        return true;
      } catch {
        // 几何尚未就绪(getBounds 内部抛错), 重试等待模型算完, 不在此处打印成 console error。
        return false;
      }
    };

    if (!attempt() && tries < MAX_TRIES) {
      timer = setInterval(() => {
        if (cancelled) {
          clearInterval(timer);
          return;
        }
        tries += 1;
        if (attempt() || tries >= MAX_TRIES) clearInterval(timer);
      }, 200);
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [scale, loaded, modelPath]);

  // 让舞台层不拦截鼠标/触摸 —— 否则右下角固定层的透明区会挡住下面的按钮(小镜问答键等)。
  // 非拖拽模式: 猫是纯装饰, 不接收点击。拖拽模式则保留鼠标以便拖动。
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const id = 'oml2d-stage';
    const apply = () => {
      const stage = document.getElementById(id);
      if (stage) stage.style.pointerEvents = draggable ? 'auto' : 'none';
    };
    apply();
    // 舞台由库异步插入, 轮询几次兜底
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      apply();
      if (tries > 30) clearInterval(timer);
    }, 150);
    return () => clearInterval(timer);
  }, [loaded, modelPath, draggable]);

  // 拖动宠物: 用 document 上的事件委托, 不依赖舞台何时/被重建几次。
  // 按下时判断目标是否在 #oml2d-stage 内, 是则开始拖动, 位置用 left/top(清掉 bottom/right)。
  // 挂在 document 上, 所以切页重挂、舞台重新创建后依然即时可用。
  useEffect(() => {
    if (!draggable || typeof document === 'undefined') return;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let dragging = false;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const stage = document.getElementById('oml2d-stage');
      if (!stage) return;
      // 只响应发生在舞台(或其子元素)上的按下 —— 事件委托的门卫
      const target = e.target as Node | null;
      if (!target || !stage.contains(target)) return;
      const rect = stage.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      dragging = true;
      stage.style.userSelect = 'none';
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const stage = document.getElementById('oml2d-stage');
      if (!stage) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      // 转换: 舞台原本用 bottom/right 定位, 拖一次后切到 top/left
      stage.style.bottom = 'auto';
      stage.style.right = 'auto';
      stage.style.top = `${Math.max(0, startTop + dy)}px`;
      stage.style.left = `${Math.max(0, startLeft + dx)}px`;
    };
    const onPointerUp = () => {
      const stage = document.getElementById('oml2d-stage');
      dragging = false;
      if (stage) stage.style.userSelect = '';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [draggable]);

  // 初始化一次: 挂载单只模型
  useEffect(() => {
    let disposed = false;
    onStatusChange?.('loading');

    (async () => {
      try {
        type LoadOml2d = (options: Record<string, unknown>) => unknown;
        const { loadOml2d } = (await import(
          /* webpackIgnore: true */
          OML2D_LIB
        )) as { loadOml2d: LoadOml2d };
        if (disposed) return;

        const inst = loadOml2d({
          dockedPosition,
          primaryColor,
          // 关掉原生菜单按钮(左下角那一排: 休息/切换/刷新等), 只由外部 visible 开关控制
          menus: {
            disable: true,
            items: [],
          },
          // onLoad: 模型 JSON + 贴图 + moc 全部拉到并开始渲染才算成功,
          // 其回调的 index >= 0 代表当前模型成功。
          onLoad: (data: unknown) => {
            const d = data as { index?: number } | undefined;
            if (d && typeof d.index === 'number' && d.index >= 0) {
              onStatusChange?.('ready');
            }
          },
          models: [
            {
              name: modelName,
              path: modelPath,
              scale: BASE_MODEL_SCALE,
              position: [0, 40],
              stageStyle: { height: 420 },
            },
          ],
          // tips 空数组即可, 状态浮在 statusBar 上
          tips: {
            idleTips: { message: [] },
            copyTips: { message: [] },
          },
          statusBar: {
            loadingMessage: '正在叫小镜…',
            loadSuccessMessage: '小镜到啦',
            loadFailMessage: '小镜走神了，点我重试',
            reloadMessage: '再叫一次',
            restMessage: '小镜在旁边陪着你',
            switchingMessage: '换一只…',
          },
        }) as unknown as Oml2dLike;

        instRef.current = inst;
        setLoaded(true);
      } catch (e) {
        if (disposed) return;
        console.error('[Live2DPet] 初始化失败:', e);
        onStatusChange?.('error', e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      disposed = true;
      instRef.current = null;
      // 关键: 把上一个实例留在 body 里的所有 oml2d 元素清掉,
      // 否则切换主题(modelPath 变 → 重新 init)会叠出多只猫。
      const ids = [
        'oml2d-stage',
        'oml2d-canvas',
        'oml2d-statusBar',
        'oml2d-tips',
        'oml2d-menus',
      ];
      for (const id of ids) {
        document.getElementById(id)?.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelPath, modelName, dockedPosition, primaryColor]);

  // 打开/关闭: 通过 stageSlideIn/Out 收起或唤出宠物, 不重复初始化、不杀进程
  useEffect(() => {
    if (!loaded) return;
    const inst = instRef.current;
    if (!inst) return;
    (visible ? inst.stageSlideIn() : inst.stageSlideOut()).catch((e) =>
      console.error('[Live2DPet] 切换可见性失败:', e),
    );
  }, [visible, loaded]);

  // 自身不渲染 DOM, 宠物挂在 body 右下角
  return null;
}