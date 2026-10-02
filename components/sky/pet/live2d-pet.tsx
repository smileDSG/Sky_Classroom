'use client';

// Live2D 陪伴宠物 —— 独立小组件。固定单只模型(黑猫/白猫), 外部只控制"打开/关闭"。
// 关键坑: 不往 loadOml2d 传真实 DOM 的 parentElement —— 库内部会深合并整个配置,
// DOM 的循环引用会造成 "Maximum call stack size exceeded"。故让它挂到 body(隔离预览页正合适)。
// SSR 安全: 库只在 useEffect 里动态 import + mount, 服务端不执行。
//
// 可见性: 本组件自身 return null(宠物由 oml2d 挂到 body 右下角)。
// 开关由外部(主页右下角圆钮)通过 visible 控制, 本组件不再额外画关闭按钮。

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PetKindSwitch } from '@/components/sky/pet/pet-kind-switch';

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

// 猫脚下为模式切换条预留的高度(px)。舞台加高、猫随之上移, 切换条停在这段透明区里;
// 舞台悬在窗口右下角、猫的脚本来就贴着窗口底边, 不抬高一段就没有放条子的地方。
const FOOT_UI_H = 44;
// 舞台离窗口右缘的内收距离(px)。库默认 right:0 让盒子贴死窗口右缘, 猫的渲染盒
// 若比实际形象略窄, 右缘就会被裁 —— 整体右移一段, 猫完整可见。
const STAGE_RIGHT_OFFSET = 32;
// 舞台(猫 + 脚下切换条)最大高度占窗口的比例。明明想让人看清这只宠物, 之前 0.28 却把
// 猫盒高压到窗口 22~25%、缩小成「右下角一个小点」, 用户反映「越来越小了、很丑」。
// 放宽到 0.55: 猫明显更大更完整, 但仍留上限, 避免窄窗口里把机器人下方内容按钮盖满。
const PET_MAX_STAGE_H_FRAC = 0.55;

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
  offsetX = 0,
  offsetY = 0,
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
  /**
   * 整体微调(视觉像素, 向右/下为正)。舞台贴死窗口右下角, 直接平移会把猫推出屏外或裁掉身体,
   * 所以这里不挪盒子, 而是: offsetX 用于缩小「距右缘内收量」= 更贴右缘; offsetY 用于让猫脚
   * 沿脚下切换条区域继续下沉。两者都不破坏动画/尺寸, 也不会把身体变矮。
   */
  offsetX?: number;
  offsetY?: number;
}) {
  const instRef = useRef<Oml2dLike | null>(null);
  const [loaded, setLoaded] = useState(false);
  // oml2d 舞台元素(库异步挂载到 body, 主题/模型切换会重建): 脚下切换条 portal 进它,
  // 猫被拖动时切换条跟着走。重建后重新拿新节点, 旧节点自动丢弃。
  const [stageEl, setStageEl] = useState<HTMLElement | null>(null);

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
    // 重试预算: 等待模型几何(getBounds)就绪的秒数 = MAX_TRIES * 150ms。
    // 之前是 30(4.5s): 快速连切(主题/宠物)时个别回合 getBounds 偶发要到 5s+ 才就绪,
    // 预算耗尽就用库默认盒兜底放行 → 「切回来猫又很大/没固定大小」。放宽到 80(12s):
    // 慢但有效的几何多等等就能定稿; 真正加载失败的模型 12s 后才会被兜底放行, 可接受。
    const MAX_TRIES = 80;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let keeperTimer: ReturnType<typeof setInterval> | undefined;

    // 尺寸定稿后才放行显示。库把舞台插进 DOM 时用的是它自己的默认尺寸(实测 360x420),
    // 而我们的盒子要等 getBounds 量到模型渲染盒后才会被改写 —— 中间这段时间如果直接显示,
    // 看到的就是「一只大猫」闪一下。所以定稿前先藏着。
    const reveal = (stage: HTMLElement | null) => {
      if (!stage) return;
      stage.dataset.sized = '1';
      stage.style.visibility = 'visible';
      // oml2d 的滑入动画(oml2d-stage-slide-in, fill-mode: forwards)偶尔会把舞台停在
      // translateY(130%) 这种「屏幕外」的帧上 —— 元素还是 visible, 但猫被拖出视野看不见。
      // 我们的定位是 fixed + 精确坐标、盒子也已定稿, 不需要那种装饰动画。定稿后直接清掉
      // 动画和残留位移, 让盒子老老实实停在原位、猫完整可见。
      stage.style.animation = 'none';
      stage.style.transform = 'none';
    };

    // 一次布局尝试: 读模型几何(可能因模型未就绪抛错), 成功则锚定右下角 + 转译舞台尺寸并返回 true。
    // getBounds 在模型纹理/几何尚未计算完时会抛内部 TypeError, 这是普通的"还没准备好", 不是真崩溃。
    const attempt = (): boolean => {
      if (cancelled) return true;
      try {
        const models = (inst as unknown as { models?: unknown }).models as
          | {
              model?: {
                scale?: { x: number };
                x: number;
                y: number;
                getBounds?: () => { x: number; y: number; width: number; height: number };
              };
            }
          | undefined;
        const model = models?.model;
        const stage = document.getElementById('oml2d-stage');
        // 舞台是库异步插进 DOM 的, 而模型第二次加载走浏览器缓存、loaded 会早于舞台挂载就置真。
        // 这种时候**不能算「完成」**—— 一旦返回 true 重试就停了, 盒子永远等不到改写,
        // 猫会一直按库的默认尺寸显示(看上去就是「切回来猫还是很大, 没固定到一个大小」)。
        // 所以舞台没挂上就返回 false, 交给下面的重试循环继续等。
        if (!stage) return false;
        if (stage.dataset.sized !== '1') stage.style.visibility = 'hidden';
        // 模型/几何还没就绪(getBounds 尚不可用)时, 绝不能「按库默认盒直接放行 + return true」——
        // 那样会立刻停掉重试循环, 猫被钉在库默认尺寸(不经 0.6 倍缩放), 首帧看着就又大又不完整;
        // 而切换(重 init)时模型已缓存、getBounds 就绪才会走下面的精确分支, 所以「切一次才完整」。
        // 改成返回 false, 让重试循环继续等几何就绪, 再由下面的精确路径定稿; 重试耗尽时兜底仍会放行。
        if (!model || typeof model.getBounds !== 'function') {
          inst.setModelScale(BASE_MODEL_SCALE * scale);
          return false;
        }
        // 当前模型的实际"UI 倍数"(模型 scale / 基准 scale), 用于把测量值归一化到 UI 倍数=1。
        const currentUI =
          model.scale && model.scale.x && BASE_MODEL_SCALE ? model.scale.x / BASE_MODEL_SCALE : 1;
        const key = model as object;
        if (!geomRef.current || geomRef.current.key !== key) {
          const b = model.getBounds();
          if (!b || typeof b.width !== 'number' || typeof b.x !== 'number') {
            // 几何还没算完 —— 同样是「没准备好」, 返回 false 继续重试
            inst.setModelScale(BASE_MODEL_SCALE * scale);
            return false;
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
        const win = window;
        const margin = 12;
        // 用「窗口」而非舞台尺寸做放大上限: 舞台已随猫缩到盒子后仍能继续放大, 不会被误判超窗。
        // 高度上限收窄到窗口的 PET_MAX_STAGE_H_FRAC: 小窗口下自动缩小成"角落小宠物",
        // 不再让猫占掉大半个屏幕。
        const maxBoxH = win.innerHeight * PET_MAX_STAGE_H_FRAC - FOOT_UI_H;
        const fitR = Math.max(
          0.01,
          Math.min(scale, (win.innerWidth - margin) / g.bw, maxBoxH / g.bh),
        );
        inst.setModelScale(BASE_MODEL_SCALE * fitR);
        // 后框随猫自适应: 只改舞台 CSS 尺寸对齐猫的渲染盒, 并 overflow:hidden 裁掉多余的画布。
        // 不动画布本身(改画布会拉伸/裁剪 Pixi 渲染, 导致模糊)。
        stage.style.width = `${Math.ceil(g.bw * fitR)}px`;
        stage.style.height = `${Math.ceil(g.bh * fitR + FOOT_UI_H)}px`;
        stage.style.overflow = 'hidden';
        // 层级: 库只给了 position:fixed, 没给 z-index(auto) → 猫会被页面里任何有层级的
        // 内容盖住(实测主页的白色卡片把猫的上半身压住, 只剩后腿和尾巴)。
        // 与 VRM 舞台的 z-[9996] 对齐: 高于页面内容, 低于气泡(9999)与助手(10001)。
        stage.style.zIndex = '9996';
        // 猫离窗口右缘留出空隙(默认 right:0 会贴边, 猫的渲染盒若略小于实际形象
        // 会被窗口右缘裁掉一角 —— 实测出现「猫探头被切」)。整体右移后猫和脚下
        // 切换条一起内收, 始终完整可见。offsetX>0 时再往里收一点 = 整只猫更贴右缘。
        const targetRight = Math.max(0, STAGE_RIGHT_OFFSET - offsetX);
        stage.style.right = `${targetRight}px`;
        // 关键修复「刚进主页猫显示不完整」: 求定位用的 getBoundingClientRect 必须反映
        // 「定稿后的静止盒」。之前是先量 rect 再定宽高 —— 首帧时盒子还是库的默认/过渡盒
        // (甚至被滑入动画 translateY 抬离原位, 实测出现过 1280x0), 拿它算出来的模型位置
        // 就会把猫钉到盒子错误的一角, overflow:hidden 把后半截裁掉 → 猫「出现但不完整」。
        // 切换(重 init)时碰巧遇到已静止的盒, 所以切一次又变完整。现在先把清动画、定宽高
        // 做完, 再量静止盒来自洽定位; reveal 末尾那句 animation/transform 清理保留作双保险。
        stage.style.animation = 'none';
        stage.style.transform = 'none';
        const sRect = stage.getBoundingClientRect();
        // 下沉量: 模型坐标单位缩放跟随 fitR, 所以把「视觉像素 offset」除以 fitR 还原成模型
        // 坐标位移, 视觉上就正好走 offsetY 像素。最高让脚贴到舞台底(切换条下缘)为止,
        // 再多就轮到裁身体了 —— 下沉由脚下 FOOT_UI_H 的透明区消化, 猫不会变矮。
        const maxDownPx = FOOT_UI_H * 0.9;
        const dy = Math.min(offsetY, maxDownPx) / fitR;
        // 模型盒左上角在舞台内的位置(模型坐标系的绘制原点)。
        // 复用与 setModelPosition 完全相同的算式 —— 避免两处公式各写一遍后算出不同结果,
        // 导致轮廓与实际渲染错位(曾致气泡被顶到屏幕外消失)。
        const mBoxW = g.bw * fitR;
        const mBoxH = g.bh * fitR;
        const mLeft = sRect.width - mBoxW - g.nOffX * fitR;
        const mTop = sRect.height - mBoxH - g.nOffY * fitR - FOOT_UI_H * 0.9 + mBoxH * 0.22 + dy;
        // 让盒子右下角对准舞台右下角(舞台默认 bottom:0/right:0, 与窗口右下角重合),
        // 放大时盒子往左/上生长, 不超出窗口。
        inst.setModelPosition({
          x: mLeft,
          // getBounds 盒的下缘还垫着一截「模型脚底的透明空隙」(约为盒子高度的一小段, 随缩放等比变化)。
          // 只把盒底对齐舞台底, 猫脚仍会悬在切换条上方; 缺口大小又随窗口尺寸变, 定值压不下去。
          // 修法: 下压量也按盒子高度等比给(0.22 * 盒高), 抵消掉那截空闲, 无论如何缩放都能把脚
          // 钉进底部 FOOT_UI_H 的切换条区域内 —— 超出的部分全是透明空隙, overflow:hidden 裁剪无碍,
          // 切换条(z 在最上层)顺势遮住脚的下缘, 视觉上就是猫脚贴着按钮。offsetY 在此基础上再沉一点。
          y: mTop,
        });
        // 写轮廓: 猫的实际渲染盒(不含底部给切换条留的 FOOT_UI_H 透明区)投影到屏幕坐标,
        // 写进 data-silhouette。供问候气泡贴猫定位(与 VRM 同一套协议)。
        // 不写的话气泡只能按舞台盒定位 —— 盒子比猫高一截, 气泡就会飘在猫头顶老远。
        // 安全兜底: 算出的轮廓若明显不合法(跑到视口外/尺寸异常), 宁可不写,
        // 让气泡退回按舞台盒定位(偏一点但可见), 好过气泡被顶到屏幕外彻底消失。
        const silTop = sRect.top + mTop;
        const silBottom = silTop + mBoxH;
        if (
          Number.isFinite(silTop) &&
          mBoxW > 0 &&
          mBoxH > 0 &&
          silBottom > 0 &&
          silTop < window.innerHeight &&
          silBottom > silTop
        ) {
          try {
            stage.setAttribute(
              'data-silhouette',
              JSON.stringify({
                left: sRect.left + mLeft,
                right: sRect.left + mLeft + mBoxW,
                top: silTop,
                bottom: silBottom,
              }),
            );
          } catch {
            /* 轮廓只是优化, 写失败就退回按舞台盒定位 */
          }
        } else {
          stage.removeAttribute('data-silhouette');
        }
        reveal(stage); // 尺寸已定稿, 放行显示
        return true;
      } catch {
        // 几何尚未就绪(getBounds 内部抛错), 重试等待模型算完, 不在此处打印成 console error。
        return false;
      }
    };

    // 布局守护: 库在模型加载完成的内部回调里会调用 stage.reloadStyle(modelSize),
    // 把舞台样式重置回它自己算的默认尺寸(360x420、right:0)。这个回调可能晚于我们
    // attempt() 定稿才触发 —— 盒子被改回去、猫跟着错位, 看起来就是「位置奇怪/不固定」。
    // 定稿后持续检测盒子是否还是定稿值, 被重置就立刻重跑 attempt() 拉回来。
    // 用户拖动过(舞台改用 left/top、right=auto)则跳过, 不跟拖动打架。
    const startKeeper = () => {
      if (keeperTimer || cancelled) return;
      keeperTimer = setInterval(() => {
        if (cancelled) {
          clearInterval(keeperTimer);
          return;
        }
        const stage = document.getElementById('oml2d-stage');
        if (!stage) return;
        if (stage.style.right === 'auto') return;
        const g = geomRef.current;
        if (!g) return;
        const maxBoxH = window.innerHeight * PET_MAX_STAGE_H_FRAC - FOOT_UI_H;
        const fitR = Math.max(
          0.01,
          Math.min(scale, (window.innerWidth - 12) / g.bw, maxBoxH / g.bh),
        );
        const w = Math.ceil(g.bw * fitR);
        const h = Math.ceil(g.bh * fitR + FOOT_UI_H);
        const targetRight = Math.max(0, STAGE_RIGHT_OFFSET - offsetX);
        if (
          stage.dataset.sized !== '1' ||
          parseInt(stage.style.width, 10) !== w ||
          parseInt(stage.style.height, 10) !== h ||
          stage.style.right !== `${targetRight}px` ||
          // 库 reloadStyle 可能把 z-index 一并重置 → 猫又会被页面内容盖住
          stage.style.zIndex !== '9996'
        ) {
          attempt();
          return;
        }
        // 尺寸没变, 但用户可能拖动了猫(舞台改用 left/top)或窗口在缩放 →
        // 轮廓坐标会变, 定期重算一次供气泡跟随(不重排模型, 只更新 data-silhouette)。
        const sRect = stage.getBoundingClientRect();
        if (sRect.width > 0) {
          const mBoxH = g.bh * fitR;
          const mBoxW = g.bw * fitR;
          const dy = Math.min(offsetY, FOOT_UI_H * 0.9) / fitR;
          const mLeft = sRect.width - mBoxW - g.nOffX * fitR;
          const mTop = sRect.height - mBoxH - g.nOffY * fitR - FOOT_UI_H * 0.9 + mBoxH * 0.22 + dy;
          const silTop = sRect.top + mTop;
          const silBottom = silTop + mBoxH;
          // 合法性校验同上: 轮廓越界就删掉, 让气泡退回按舞台盒定位(偏但可见)
          if (
            Number.isFinite(silTop) &&
            mBoxW > 0 &&
            mBoxH > 0 &&
            silBottom > 0 &&
            silTop < window.innerHeight &&
            silBottom > silTop
          ) {
            const next = JSON.stringify({
              left: sRect.left + mLeft,
              right: sRect.left + mLeft + mBoxW,
              top: silTop,
              bottom: silBottom,
            });
            if (stage.getAttribute('data-silhouette') !== next) {
              stage.setAttribute('data-silhouette', next);
            }
          } else if (stage.hasAttribute('data-silhouette')) {
            stage.removeAttribute('data-silhouette');
          }
        }
      }, 500);
    };

    if (!attempt() && tries < MAX_TRIES) {
      timer = setInterval(() => {
        if (cancelled) {
          clearInterval(timer);
          return;
        }
        tries += 1;
        const ok = attempt();
        if (ok || tries >= MAX_TRIES) {
          clearInterval(timer);
          // 重试用尽仍没量到几何: 宁可显示一只尺寸没对准的猫, 也不能让它一直隐身
          if (tries >= MAX_TRIES) reveal(document.getElementById('oml2d-stage'));
          startKeeper();
        }
      }, 150);
    } else {
      startKeeper();
    }

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (keeperTimer) clearInterval(keeperTimer);
    };
  }, [scale, loaded, modelPath, offsetX, offsetY]);

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

  // 追踪舞台元素: 库挂载/重建都是异步的, 轮询找最新的 #oml2d-stage 并同步给 state
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let tries = 0;
    const poll = () => {
      const el = document.getElementById('oml2d-stage');
      if (el && document.body.contains(el)) {
        setStageEl((prev) => (prev === el ? prev : el));
        return true;
      }
      return false;
    };
    if (!poll()) {
      const timer = setInterval(() => {
        tries += 1;
        if (poll() || tries > 80) clearInterval(timer);
      }, 150);
      return () => clearInterval(timer);
    }
  }, [modelPath, loaded]);

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
      // 脚下切换条上的按下不算拖动, 否则点「猫/人」会把猫拖走
      if (target instanceof Element && target.closest('[data-pet-ui]')) return;
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

  // 初始化: 挂载单只模型 (也负责主题/模型切换时重建实例)
  useEffect(() => {
    let disposed = false;
    // 关键: 先把 loaded 复位。切换主题(modelPath 变→重新 init)时, loaded 来自上一个模型已是
    // true, 直接往下走的话, 新模型加载完那句 setLoaded(true) 是个「空操作」—— loaded 没变成
    // 从 false→true, 尺寸校准 effect(依赖 loaded)就永远不会重跑 → 新猫一直是库默认尺寸(不缩小)。
    // 先置 false 再等加载完置 true, 强制触发那次重跑。
    setLoaded(false);
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
          // tips: 把这个气泡整个藏掉。库把 welcome() 挂在 stageSlideIn 事件上
          // (registerGlobalEvent), 没有「弹不弹」的开关; 只清空文案的话, 它照样弹出一个
          // 空的蓝色气泡压在猫身上(底色取 primaryColor)。所以从样式层 display:none ——
          // 库的 setStyle 是合并式(Ne(this.style, t)), 后续的 opacity/visibility 覆盖不掉它。
          // 问候语改由共用的 <PetGreetingBubble> 渲染在宠物「旁边」, 猫与 VRM 人物内容一致。
          tips: {
            idleTips: { message: [] },
            copyTips: { message: [] },
            style: { display: 'none' },
            mobileStyle: { display: 'none' },
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
      const ids = ['oml2d-stage', 'oml2d-canvas', 'oml2d-statusBar', 'oml2d-tips', 'oml2d-menus'];
      for (const id of ids) {
        document.getElementById(id)?.remove();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelPath, modelName, dockedPosition, primaryColor]);

  // 打开/关闭: 直接管舞台显隐, 不再调 stageSlideIn/Out。
  // stageSlideIn/Out 会给舞台挂 slide 动画(fill-mode: forwards), 有时会停在 translateY(130%)
  // 屏幕外, 猫明明 visible 却看不见(reveal 已把动画清掉, 这里再主动避开它, 双保险)。
  // 位置由固定盒子 + 定稿尺寸决定, 显隐靠 visibility, 不重复初始化。
  useEffect(() => {
    if (!loaded) return;
    const stage = document.getElementById('oml2d-stage');
    if (!stage) return;
    // 只有「盒子定稿(data-sized)」才放行显示, 否则回到隐藏态等尺寸
    stage.style.visibility = visible && stage.dataset.sized === '1' ? 'visible' : 'hidden';
  }, [visible, loaded]);

  // 自身不渲染 DOM, 宠物由 oml2d 挂到 body 右下角; 唯一例外是脚下切换条
  // (portal 进 oml2d 舞台, 猫被拖动时它跟着走)。舞台还没挂出来时不渲染。
  // z 必须压过库给画布设的 z-index:9998 —— 画布盖在切换条上时是透明的(视觉正常),
  // 但点击命中全落在画布上, 切换条按钮永远收不到事件(实测「猫切不成人」)。
  // pointer-events-auto: 非拖拽场景舞台是 pointer-events:none, 子元素默认也不收
  // 事件, 切换条要自己把事件拿回来(预览页等 draggable=false 的地方才点得动)。
  return stageEl
    ? createPortal(
        <PetKindSwitch className="pointer-events-auto absolute bottom-1.5 right-16 z-[9999]" />,
        stageEl,
      )
    : null;
}
