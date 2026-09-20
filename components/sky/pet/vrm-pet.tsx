'use client';

// VRM 陪伴人物 —— three.js + @pixiv/three-vrm 渲染。用于替换被否的二次元人物「米亚拉」。
// 主题猫(Live2D/oml2d)不受影响;本组件是独立的 3D 渲染路径,纯新增、可回滚。
//
// 关键点:
// - 所有 three/three-vrm 都在 useEffect 里动态 import(不拖进服务端 bundle,SSR 安全)。
// - 组件自己管一只人物的拖动(与 Live2DPet 同一套 document 指针委托),点开对话由外层
//   (home-live2d-pet)监听 #vrm-pet-stage 实现,职责划分与猫一致。
// - 人物就停在右下角;透明背景,不挡页面。headless 无法读 GL 像素,所以用 data-vrm-ready
//   / data-vrm-error 暴露加载结果,便于功能校验。

import { useEffect, useRef } from 'react';

type PetStatus = 'loading' | 'ready' | 'error';

// 容器(包裹框)基准尺寸 —— size 是它的等比倍数, 与 Live2D 猫共用同一个系数, 保证三只等比。
const STAGE_W = 320;
const STAGE_H = 420;

export function VrmPet({
  modelPath = '/vrm/pet',
  visible = true,
  size = 1,
  onStatusChange,
}: {
  modelPath?: string;
  visible?: boolean;
  /** 包裹框尺寸倍数。相机 FOV 与机位固定, 所以框等比缩 → 人也等比缩(画布由 ResizeObserver 跟随) */
  size?: number;
  onStatusChange?: (status: PetStatus, errorMsg?: string) => void;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // 是否还能跑(component 卸载/重建时置位,避免 setState on unmounted / 内存泄漏)
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    onStatusChange?.('loading');
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    // 组件卸载清理用的句柄
    const cleanupFn = { cancel: false };
    const dispose = () => {
      cleanupFn.cancel = true;
      aliveRef.current = false;
    };

    (async () => {
      try {
        // 动态加载 three / three-vrm,避免进入服务端 bundle
        // three 的命名空间即完整模块(Scene/WebGLRenderer/Box3 等都是具名导出),直接拿来用
        const THREE = await import('three');
        const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
        const {
          VRMLoaderPlugin,
          VRMUtils,
        } = await import('@pixiv/three-vrm');

        if (cleanupFn.cancel) return;

        // ── 渲染器: 透明背景 ──
        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
        });
        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);

        // 灯光
        scene.add(new THREE.HemisphereLight(0xffffff, 0x887766, 1.4));
        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(1, 1.5, 1).normalize();
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x88aaff, 0.5);
        fill.position.set(-1, 0.5, -0.5).normalize();
        scene.add(fill);

        // ── 加载 VRM ──
        const loader = new GLTFLoader();
        loader.register((parser) => new VRMLoaderPlugin(parser));
        const gltf = await loader.loadAsync(modelPath);
        if (cleanupFn.cancel) return;

        // 骨架合并(保留 humanoid 骨节点,人形归一化才能生效)。
        // 注意: 不再 removeUnnecessaryJoints —— 该模型若被裁掉 humanoid 所需
        // 关节, vrm.update() 就静默套不上姿势, 会露出 T 型/十字架绑定姿态。
        try {
          VRMUtils.combineSkeletons(gltf.scene);
        } catch {
          /* optional */
        }

        // 运行时由 VRMLoaderPlugin 注入到 gltf.userData.vrm(类型上插件已声明,返回 VRM)
        const vrm = gltf.userData.vrm as import('@pixiv/three-vrm').VRM;
        if (!vrm) throw new Error('VRM 元数据缺失(未通过 VRMLoaderPlugin 加载)');

        // 把人物摆正站立: 按包围盒缩放到指定高度,脚底对齐 y=0。
        // 该模型原朝向为 -Z(背对镜头), 故基础转向潘 +Z 面向观众; 循环里的轻微摇摆叠加其上。
        const FACE_CAMERA_Y = Math.PI;
        scene.add(vrm.scene);
        vrm.scene.rotation.y = FACE_CAMERA_Y;
        const targetHeight = 1.7;
        const box0 = new THREE.Box3().setFromObject(vrm.scene);
        const h0 = box0.getSize(new THREE.Vector3()).y;
        const scale = targetHeight / (h0 || 1);
        vrm.scene.scale.setScalar(scale);
        const box1 = new THREE.Box3().setFromObject(vrm.scene);
        vrm.scene.position.y -= box1.min.y; // 让脚底落在 y=0
        const centerY = box1.getSize(new THREE.Vector3()).y / 2;

        // ── 手臂自然下垂 ──
        // 该 VRM 的 humanoid 骨全部 useDefaultValues=true 且绑定姿势就是 T 型(双臂横伸,
        // 各骨旋转均为单位四元数, 上臂沿 ±X 水平), 文件里没有自带的中立放松姿势 ——
        // three-vrm 对 useDefaultValues 的骨会原样保留, 于是永远是十字手。
        // 所以在运行时直接把这些骨摆成自然下垂: 上臂绕本地 Z 转 90° 放下, 前臂加一点
        // 自然弯折, 手微内扣。用这个模型实际的 UniGLTF 骨名驱动, 缺某根骨就跳过。
        const ARM_POSE = {
          // 上臂放低到 ~80°(接近自然垂直): 手垂到髋侧, 但仍带一点向外
          J_Bip_L_UpperArm: { x: 0, y: 0, z: 1.4 },
          J_Bip_R_UpperArm: { x: 0, y: 0, z: -1.4 },
          // 肘部弯折 ~30°, 让手落在腰前上方、离开髋/裙摆侧 —— 这是防穿模、又显自然的关键
          J_Bip_L_LowerArm: { x: 0.5, y: 0, z: 0 },
          J_Bip_R_LowerArm: { x: 0.5, y: 0, z: 0 },
          // 手腕微内扣(掌心偏向身体): 左 +右 -, 幅度小以免又贴近大腿
          J_Bip_L_Hand: { x: 0, y: 0.25, z: 0 },
          J_Bip_R_Hand: { x: 0, y: -0.25, z: 0 },
        };
        const armNodes = new Map<string, import('three').Object3D>();
        vrm.scene.traverse((o) => {
          if (o?.name && ARM_POSE[o.name as keyof typeof ARM_POSE] && !armNodes.has(o.name)) {
            armNodes.set(o.name, o);
          }
        });
        // 把上面那套姿势真正写到骨头上。tick 每帧调一次; resize 里的轮廓投影也要先调一次 ——
        // 否则量到的是文件自带的 T 型绑定姿势(臂展≈身高, 比相机横向视野还宽), 轮廓会被撑爆。
        const applyArmPose = () => {
          for (const name in ARM_POSE) {
            const bn = armNodes.get(name);
            if (!bn) continue;
            const p = ARM_POSE[name as keyof typeof ARM_POSE];
            bn.rotation.x = p.x;
            bn.rotation.y = p.y;
            bn.rotation.z = p.z;
          }
        };
        // 头骨(用于极轻的头部摆动, 让僵住的脸有一丝「活」感)
        let headBone: import('three').Object3D | null = null;
        vrm.scene.traverse((o) => {
          if (o?.name === 'J_Bip_C_Head') headBone = o;
        });
        // 眨眼预设名: 该模型带 14 个表情。three-vrm 的 setValue/getExpression 是按表达式的
        // expressionName 匹配的(VRM0 里它等于 blendShapeGroup 的 presetName, 即 'blink'),
        // 而表达式对象的 .name 是 'VRMExpression_blink'(不是 map 的键)。所以这里取
        // expressionName —— 传带前缀的名字反而查不到、眨眼会静默失效。
        const blinkName = (() => {
          try {
            const s = vrm.expressionManager;
            const arr = s ? (s as unknown as { expressions?: { name?: string; presetName?: string; expressionName?: string }[] }).expressions : undefined;
            const exprs = (arr || []).map((e) => ({
              name: e?.name ?? '',
              preset: e?.presetName ?? '',
              exprName: (e as unknown as { expressionName?: string })?.expressionName ?? '',
            }));
            const hit = exprs.find(
              (x) =>
                /^blink$/i.test(x.preset) ||
                /^blink$/i.test(x.exprName) ||
                (/blink$/i.test(x.name) && !/blink_[lr]$/i.test(x.name))
            );
            const resolved = hit ? hit.exprName || hit.preset || 'blink' : 'blink';
            stage.setAttribute(
              'data-expression-report',
              JSON.stringify({
                total: exprs.length,
                sample: exprs.slice(0, 6).map((x) => x.name || x.preset),
                blinkResolved: resolved,
                head: !!headBone,
              })
            );
            return resolved;
          } catch {
            return 'blink';
          }
        })();

        // ── 自适应尺寸 ──
        const resize = () => {
          const cssW = Math.max(1, stage.clientWidth);
          const cssH = Math.max(1, stage.clientHeight);
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          renderer.setSize(cssW, cssH, false);
          canvas.width = Math.round(cssW * dpr);
          canvas.height = Math.round(cssH * dpr);
          camera.aspect = cssW / cssH;
          camera.position.set(0, centerY, 3.4);
          camera.lookAt(0, centerY, 0);
          camera.updateProjectionMatrix();

          // 轮廓投影: 相机按固定 FOV/机位取景, 人只占盒子中间一条 —— 盒子左右各留一大片空白。
          // 问候气泡若贴盒子边, 离「人」还有几十像素。这里把模型包围盒的 8 个角投影到屏幕上,
          // 得到人在舞台内的实际边界(相对舞台的 CSS 像素), 写进 data-silhouette 供气泡取用。
          // 纯几何计算, 不依赖读取 GL 像素。
          try {
            applyArmPose(); // 先摆好姿势再量, 否则量到 T 型绑定姿势
            vrm.scene.updateMatrixWorld(true);
            // precise: true 必须开 —— 这个模型是 SkinnedMesh, 默认档位只拿「绑定姿势」的
            // 几何包围盒乘世界矩阵, 骨头怎么转它都不变(量出来仍是 T 型臂展, 比视野还宽)。
            // 开了之后 three 会逐顶点走 applyBoneTransform, 量到的才是当前姿势的真实轮廓。
            const wb = new THREE.Box3().setFromObject(vrm.scene, true);
            const v = new THREE.Vector3();
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for (let i = 0; i < 8; i++) {
              v.set(
                i & 1 ? wb.max.x : wb.min.x,
                i & 2 ? wb.max.y : wb.min.y,
                i & 4 ? wb.max.z : wb.min.z
              );
              v.project(camera);
              const px = (v.x * 0.5 + 0.5) * cssW;
              const py = (0.5 - v.y * 0.5) * cssH;
              if (px < minX) minX = px;
              if (px > maxX) maxX = px;
              if (py < minY) minY = py;
              if (py > maxY) maxY = py;
            }
            stage.setAttribute(
              'data-silhouette',
              JSON.stringify({
                left: Math.round(minX),
                right: Math.round(maxX),
                top: Math.round(minY),
                bottom: Math.round(maxY),
              })
            );
          } catch {
            /* 投影失败就退回整框定位 */
          }
        };
        resize();
        const ro = new ResizeObserver(resize);
        ro.observe(stage);

        // ── 循环 ──
        const clock = new THREE.Clock();
        let raf = 0;
        let blinkAt = performance.now() + 2000;
        let rafRunning = true;
        let armReported = false;
        let blinkLatched = false;
        let blinkPeaks = 0;

        const tick = () => {
          if (!rafRunning) return;
          raf = requestAnimationFrame(tick);
          const dt = Math.min(clock.getDelta(), 0.05);
          const t = clock.elapsedTime;

          try {
            // 轻微呼吸/浮动,让人物更像「活的」; 面朝观众的基础转向 + 左右轻摆
            vrm.scene.position.y = -box1.min.y * scale + Math.sin(t * 1.2) * 0.004;
            vrm.scene.rotation.y = FACE_CAMERA_Y + Math.sin(t * 0.6) * 0.06;
            // 极轻的头摆摇(±1.7°), 打破僵住的脸 —— 数值很小, 且独立于面朝转向
            if (headBone) {
              headBone.rotation.y = Math.sin(t * 0.5) * 0.03;
              headBone.rotation.x = Math.sin(t * 0.37) * 0.012;
            }
            vrm.update(dt);
            // 把手臂摆回自然下垂(在 vrm.update 之后, 覆盖它的 T 型保留值)
            applyArmPose();
            // 只报一次: 把「肩 vs 手」的世界 Y 暴露给探针, 校验手臂是否已放下
            if (!armReported && armNodes.size > 0) {
              armReported = true;
              vrm.scene.updateMatrixWorld(true);
              const sPos = armNodes.get('J_Bip_L_UpperArm')?.getWorldPosition(new THREE.Vector3());
              const hPos = armNodes.get('J_Bip_L_Hand')?.getWorldPosition(new THREE.Vector3());
              const lh = armNodes.get('J_Bip_L_Hand');
              const rh = armNodes.get('J_Bip_R_Hand');
              stage.setAttribute(
                'data-arm-report',
                JSON.stringify({
                  found: armNodes.size,
                  shoulderY: sPos ? +sPos.y.toFixed(2) : null,
                  handY: hPos ? +hPos.y.toFixed(2) : null,
                  // 实际套在手腕骨上的内扣角度(应为 +0.25 / -0.25), 供探针校验
                  handInwardL: lh ? +lh.rotation.y.toFixed(2) : null,
                  handInwardR: rh ? +rh.rotation.y.toFixed(2) : null,
                })
              );
            }
          } catch {
            /* 模型个别骨缺失时静默容忍 */
          }

          // 眨眼: 自然的随机节律(2.5~4.5s), 单次眨闭 ~170ms, 力度到 1.0 足够明显。
          // 用校验过存在的 blink 预设名, 顺带清掉左右单眼残留, 避免定格成怪表情。
          try {
            const mgr = vrm.expressionManager;
            if (mgr && typeof mgr.setValue === 'function') {
              const now = performance.now();
              const dur = 170;
              if (now - blinkAt > 0) {
                blinkAt = now + 2500 + Math.random() * 2000;
              }
              const p = now - blinkAt;
              if (p >= -dur && p <= dur) {
                const u = (p + dur) / (2 * dur);
                const w = Math.sin(u * Math.PI);
                mgr.setValue(blinkName, w);
                mgr.setValue('blink_l', 0);
                mgr.setValue('blink_r', 0);
                // 峰值看门狗: 每成功闭眼一次计数+1, 暴露给探针 —— 确认眨眼真的在触发
                if (w >= 0.5 && !blinkLatched) {
                  blinkLatched = true;
                  blinkPeaks += 1;
                  stage.setAttribute('data-blink-peaks', String(blinkPeaks));
                } else if (w < 0.5) {
                  blinkLatched = false;
                }
              } else {
                mgr.setValue(blinkName, 0);
              }
              mgr.update();
            }
          } catch {
            /* 无表情能力则跳过 */
          }

          renderer.render(scene, camera);
        };
        tick();

        // 就绪信号 → 面板/探针用
        stage.setAttribute('data-vrm-ready', '1');
        stage.removeAttribute('data-vrm-error');
        onStatusChange?.('ready');

        // 拖动: 与 Live2D 猫一致 —— document 指针事件委托,位移 <6px 视为点击(交给外层)
        let sx = 0, sy = 0, sl = 0, st = 0;
        let dragging = false;
        const isInStage = (e: PointerEvent) =>
          !!stage && !!e.target && (e.target as Node).nodeType === 1 && stage.contains(e.target as Node);
        const onDown = (e: PointerEvent) => {
          if (e.button !== 0 || !isInStage(e)) return;
          const r = stage.getBoundingClientRect();
          sx = e.clientX; sy = e.clientY; sl = r.left; st = r.top; dragging = true;
          stage.style.userSelect = 'none';
          window.addEventListener('pointermove', onMove);
          window.addEventListener('pointerup', onUp);
        };
        const onMove = (e: PointerEvent) => {
          if (!dragging) return;
          const dx = e.clientX - sx, dy = e.clientY - sy;
          stage.style.right = 'auto';
          stage.style.bottom = 'auto';
          stage.style.left = `${Math.max(0, sl + dx)}px`;
          stage.style.top = `${Math.max(0, st + dy)}px`;
        };
        const onUp = () => {
          dragging = false;
          stage.style.userSelect = '';
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        };
        document.addEventListener('pointerdown', onDown);

        // 清理
        const stop = () => {
          rafRunning = false;
          cancelAnimationFrame(raf);
          ro.disconnect();
          document.removeEventListener('pointerdown', onDown);
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          try {
            (vrm as unknown as { dispose?: () => void }).dispose?.();
          } catch { /* ignore */ }
          try {
            renderer.dispose();
          } catch { /* ignore */ }
        };
        (stage as unknown as { __dispose?: () => void }).__dispose = stop;
      } catch (err) {
        if (!cleanupFn.cancel) {
          console.error('[VrmPet] 初始化失败:', err);
          stage?.setAttribute('data-vrm-error', err instanceof Error ? err.message : String(err));
          onStatusChange?.('error', err instanceof Error ? err.message : String(err));
        }
      }
    })();

    return () => {
      dispose();
      const d = (stageRef.current as unknown as { __dispose?: () => void } | null)?.__dispose;
      d?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelPath]);

  // 开关: 显隐画布(不重复初始化)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.style.display = visible ? 'block' : 'none';
  }, [visible]);

  // 画布要能接住指针才能拖动;整个组件返回 null 不好,故返回一个固定容器
  return (
    <div
      // eslint-disable-next-line react/no-unknown-property
      id="vrm-pet-stage"
      ref={stageRef}
      aria-hidden
      className="fixed z-[9996] pointer-events-auto"
      style={{
        right: 24,
        bottom: 24,
        width: Math.round(STAGE_W * size),
        height: Math.round(STAGE_H * size),
        // 纯装饰,不响应多余的指针;拖动/点击由上面的委托处理
        touchAction: 'none',
      }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </div>
  );
}