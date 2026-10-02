'use client';

// 主页陪伴宠物 —— Live2D 版本(替代被否的 SVG 小猫)。
// 主题联动: 亮色界面用白猫(Tororo), 暗色界面用黑猫(Hijiki)。
// 受 oml2d 限制, 宠物只能停靠在窗口右下角(无法塞进输入框盒内),
// 挂载点由 Live2DPet 内部交给 document.body, 本组件自己不占布局。
// 提供开/关开关: 右下角一个可折叠的小圆钮, 控制宠物显隐。
// 单文件、可回滚: 想要回退, 删掉主页那行挂载即可。

import { useEffect, useState, useSyncExternalStore } from 'react';
import { Cat, MessageCircle, X } from 'lucide-react';
import { useTheme } from '@/lib/hooks/use-theme';
import { Live2DPet } from '@/components/sky/pet/live2d-pet';
// VRM 陪伴人物(替换被否的二次元人物「米亚拉」)
import { VrmPet } from '@/components/sky/pet/vrm-pet';
// 宠物问候语气泡: 猫和 VRM 人物共用同一套问候语, 停在宠物旁边(不压在宠物身上)
import { PetGreetingBubble } from '@/components/sky/pet/pet-greeting-bubble';
// 点击宠物唤起小镜课堂(复用现有对话组件 + 其开关状态, 不改它的实现)
import { AssistantPanel } from '@/components/sky/assistant/assistant-panel';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';
// 进入首页时, 用「今日学习提醒 + 关心话」替换固定寒暄(异步 fetch, 失败则回退时段问候)
import { useLearningGreeting } from '@/components/sky/pet/use-learning-greeting';

const CATS = {
  // 亮色 → 白猫 Tororo(本地自托管)
  light: { name: '白猫 · Tororo', path: '/live2d/tororo/tororo.model.json' },
  // 暗色 → 黑猫 Hijiki(本地自托管)
  dark: { name: '黑猫 · Hijiki', path: '/live2d/hijiki/hijiki.model.json' },
};

// VRM 陪伴人物(组长否定了米亚拉, 换成本地自托管的 VRM 模型)。用户可一键与主题猫互换。
const VRM_PET = {
  name: 'VRM 人物',
  path: '/vrm/pet',
};

// 三只宠物(白猫 / 黑猫 / VRM 人物)共用的基准尺寸。
// 白猫黑猫是同一组件的两个模型, 靠 scale 缩: 猫的舞台盒子是按模型渲染盒算出来的,
// 倍数一变, 人和盒子一起等比缩。VRM 人物靠容器宽高缩: 相机 FOV 与机位都不动,
// 所以画面在盒子里占的比例不变 —— 盒子等比缩 = 人等比缩。
// 注: 0.6 是原设计值(视觉大小合适); 曾经下调到 0.38 显得过小, 已还原。
const PET_BASE_SIZE = 0.6;

// 猫整体微调(视觉像素)。此前猫即使贴底, 右下角仍有点缝隙/偏高, 用户想让猫
// 更贴右下: 往下 100px、往右 10px。实现见 Live2DPet 的 offsetX/offsetY 说明。
const CAT_OFFSET_X = 10;
const CAT_OFFSET_Y = 100;

function subscribeCompact(listener: () => void) {
  const query = window.matchMedia('(max-width: 1023px)');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

function getCompactSnapshot() {
  return window.matchMedia('(max-width: 1023px)').matches;
}

function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', listener);
  return () => query.removeEventListener('change', listener);
}

function getReducedMotionSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function HomeLive2DPet({ simpleMode = false }: { simpleMode?: boolean }) {
  const { resolvedTheme } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const isCompact = useSyncExternalStore(subscribeCompact, getCompactSnapshot, () => false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
  const assistantToggle = isCompact || reducedMotion || simpleMode;
  const petVisible = enabled && !assistantToggle;
  // 尺寸固定为基准倍数, 不再提供 +/− 缩放
  const scale = PET_BASE_SIZE;
  // 显示哪只: 'theme' = 随主题的白/黑猫(默认, 保持原行为) ; 'vrm' = VRM 人物。
  // 存在全局 store(持久化), 这样别的页面也知道该显示哪只 —— 各页头像才不会对不上。
  // 切换动作在宠物脚底的 <PetKindSwitch /> 里做(见 pet-kind-switch.tsx)。
  const kind = useSkyClassroomStore((s) => s.petKind);
  const cat = resolvedTheme === 'dark' ? CATS.dark : CATS.light;
  const isVrm = kind === 'vrm';
  // 学习提醒话术: 进入时异步取学习数据生成, 失败则为 null(届时气泡回退时段问候)
  const { greeting } = useLearningGreeting(petVisible);

  // 小镜课堂的开关状态(复用现有全局 store, 不改它的实现)
  const isOpen = useSkyClassroomStore((s) => s.isOpen);
  const toggleOpen = useSkyClassroomStore((s) => s.toggleOpen);
  // 小镜头像的换算已移到全局的 <MascotSync />(见 components/sky/pet/mascot-sync.tsx):
  // 原先只在主页算, 一离开主页主题再切换猫就不跟着换了。全局算才能每页都跟着亮暗走。

  // 点击宠物 → 唤起/收起小镜课堂。
  // 宠物舞台挂载在 document.body(见 Live2DPet), 用 document 事件委托兜底:
  // 按下时记录坐标, 抬起时若位移很小(<6px)判为「点击」而非拖动, 再触发开关。
  // 只响应发生在 #oml2d-stage 内的事件, 不影响宠物自己的缩放/切换等按钮。
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let downX = 0;
    let downY = 0;
    let hasDown = false;
    // 返回命中的「当前显示宠物」的舞台元素: 猫挂在 #oml2d-stage, VRM 挂在 #vrm-pet-stage。
    const hitStage = (target: Node | null) => {
      // 宠物脚底切换条(嵌在舞台内)上的交互不算「点宠物」, 否则点「猫/人」会误开小镜课堂
      if (target instanceof Element && target.closest('[data-pet-ui]')) return null;
      for (const id of ['oml2d-stage', 'vrm-pet-stage']) {
        const el = document.getElementById(id);
        if (el && target && el.contains(target)) return el;
      }
      return null;
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !hitStage(e.target as Node)) return;
      downX = e.clientX;
      downY = e.clientY;
      hasDown = true;
    };
    const onUp = (e: PointerEvent) => {
      if (!hasDown || e.button !== 0 || !hitStage(e.target as Node)) {
        hasDown = false;
        return;
      }
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      hasDown = false;
      if (Math.hypot(dx, dy) < 6) toggleOpen();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointerup', onUp);
    };
  }, [toggleOpen]);

  return (
    <>
      {!simpleMode &&
        (isVrm ? (
          <VrmPet visible={petVisible} size={PET_BASE_SIZE} />
        ) : (
          <Live2DPet
            modelPath={cat.path}
            modelName={cat.name}
            visible={petVisible}
            draggable
            scale={scale}
            offsetX={CAT_OFFSET_X}
            offsetY={CAT_OFFSET_Y}
          />
        ))}

      {/* 问候语气泡: 谁在场就跟谁走, 停在宠物旁边而不是压在身上。key 随宠物变化 → 换宠物重新问好。
          文字优先用「今日学习提醒」, 取到前先短暂显示时段问候, 取到后就地替换 */}
      {petVisible && (
        <PetGreetingBubble
          key={isVrm ? 'vrm' : 'theme'}
          anchorId={isVrm ? 'vrm-pet-stage' : 'oml2d-stage'}
          text={greeting ?? undefined}
          showMs={9000}
        />
      )}

      {/* 点击宠物唤起的小镜课堂。z 高于宠物舞台(9998)。锚在左下角,
          把右下角(宠物老家)空出来 —— 否则打开对话会盖住小镜, 使人拖不动它。 */}
      {isOpen && (
        <div className="fixed inset-x-3 bottom-16 z-[10001] flex max-h-[calc(100dvh-5rem)] flex-col gap-3 overflow-auto sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[380px]">
          <AssistantPanel />
        </div>
      )}

      {/* 陪伴开关: 右下角固定小圆钮, 独立于宠物, 随时可打开/收起 */}
      <button
        type="button"
        aria-label={
          assistantToggle
            ? isOpen
              ? '关闭学习助手'
              : '打开学习助手'
            : enabled
              ? '关闭陪伴宠物'
              : '打开陪伴宠物'
        }
        title={
          assistantToggle
            ? isOpen
              ? '关闭学习助手'
              : '打开学习助手'
            : enabled
              ? '关闭陪伴宠物'
              : '打开陪伴宠物'
        }
        onClick={assistantToggle ? toggleOpen : () => setEnabled((v) => !v)}
        className={
          'fixed z-[9998] flex h-9 w-9 items-center justify-center rounded-full border shadow-lg transition-transform hover:scale-105 active:scale-95 ' +
          ((assistantToggle ? isOpen : enabled)
            ? 'bg-sky-500/90 border-sky-300 text-white'
            : 'bg-slate-200/80 border-slate-300 text-slate-500 dark:bg-slate-700/80 dark:border-slate-600 dark:text-slate-300')
        }
        style={{ right: 18, bottom: 18 }}
      >
        {assistantToggle ? (
          isOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <MessageCircle className="h-4 w-4" />
          )
        ) : (
          <Cat className="h-4 w-4" />
        )}
      </button>
    </>
  );
}
