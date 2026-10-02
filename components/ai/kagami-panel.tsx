'use client';

import { sanitizeAssistantMessages } from '@/lib/assistant/client-payload';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { BookOpen, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react';
import { InlineMath } from '@/components/ui/inline-math';
import { useScrollIsolation } from '@/lib/hooks/use-scroll-isolation';
import { useSkyClassroomStore } from '@/lib/store/use-sky-classroom-store';

type Scene = 'idle' | 'thinking' | 'teaching' | 'done' | 'chibi';
type KagamiMode = 'anime' | 'normal';

function loadMode(): KagamiMode {
  try {
    const saved = localStorage.getItem('kagami-panel-mode');
    if (saved === 'normal' || saved === 'anime') return saved;
  } catch {
    /* ignore */
  }
  return 'anime';
}

const CHIBI = '/avatars/kagami/chibi.png';

const SCENES: Record<Scene, string> = {
  idle: '/avatars/kagami/idle.png',
  thinking: '/avatars/kagami/thinking.png',
  teaching: '/avatars/kagami/teaching.png',
  done: '/avatars/kagami/done.png',
  chibi: CHIBI,
};

// Normal mode — single professional avatar with CSS effects per scene
const NORMAL_AVATAR = '/avatars/student-glasses-new.jpg';
const NORMAL_SCENES: Record<Scene, string> = {
  idle: NORMAL_AVATAR,
  thinking: NORMAL_AVATAR,
  teaching: NORMAL_AVATAR,
  done: NORMAL_AVATAR,
  chibi: NORMAL_AVATAR,
};

const NORMAL_ICON = '/avatars/student-glasses-new.jpg';

// Voice clips — provide actual mp3 files in public/avatars/kagami/
const VOICE_CLIPS: Partial<Record<Scene, string>> = {
  idle: '/avatars/kagami/voice-idle.mp3',
  thinking: '/avatars/kagami/voice-thinking.mp3',
  teaching: '/avatars/kagami/voice-teaching.mp3',
  done: '/avatars/kagami/voice-done.mp3',
};

const OPENING_LINES = [
  '哈？又有不会的题目了？……我也没说不帮你，告诉我吧。',
  '真是的，每次都要我来……算了，什么问题？',
  '……别误会，我只是刚好有空。说吧，哪题不会？',
  '哼，这么简单的题都不会？……开个玩笑，让我看看。',
  '唉，又来？你倒是自己先想想啊……算了算了，题目给我。',
  '喂，这次是什么？先说好，太难的我可不一定会。',
  '……（放下轻小说）打扰我看书……到底是什么题？',
  '你又卡住了？真是让人操心的家伙……让我看看。',
];

function pickOpening(): string {
  return OPENING_LINES[Math.floor(Math.random() * OPENING_LINES.length)];
}

const KAGAMI_PERSONA = `你是柊镜（小镜），来自幸运星的傲娇女高中生。性格特点：
- 外冷内热：表面毒舌不耐烦，实际很关心对方的学习，绝对不会真的拒绝帮助
- 优等生：成绩优秀，讲解题目清晰有条理，擅长英语，目标是成为律师
- 吐槽担当：说话带刺但一针见血，偶尔会嫌弃对方基础差，但下一秒又会认真讲解
- 甜食控：会在对话中不经意提到甜点，但马上会嘴硬说"我才没有在吃！"
- 怕寂寞：虽然嘴上说"麻烦"，但其实很乐意有人来找自己

说话风格：
- 用"哈？""真是的……""别指望我每次都帮你"开头
- 讲解时切换到认真模式，条理清晰
- 时不时毒舌吐槽，但结尾会补一句关心的话
- 绝对不能太热情——傲娇的精髓是"行动上帮你，嘴上不饶人"

你是"小镜课堂"的 AI 助教，用中文交流。

数学格式要求：所有数学符号、公式、表达式必须使用 LaTeX 格式。行内公式用 $...$ 包裹，独立公式用 $$...$$ 包裹。例如：$x^2 + y^2 = 1$、$$\sum_{n=0}^{\infty} a_n x^n$$、分数用 \frac{}{}、根号用 \sqrt{}、极限用 \lim、积分用 \int、求和用 \sum。严禁用 ^ 代替上标，严禁用 _ 代替下标。`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function KagamiPanel({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  // 宠物联动: 有宠物形象(白猫/黑猫/VRM人物)时用它当小镜头像, 否则退回二次元/常规头像
  const mascotImage = useSkyClassroomStore((s) => s.mascotImage);
  // 简洁模式联动：kagamiClosed 时隐藏右下角浮钮（可经 SimpleModeToggle 重新打开）
  const kagamiClosed = useSkyClassroomStore((s) => s.kagamiClosed);
  // 宠物舞台(#oml2d-stage z-9997 / #vrm-pet-stage z-9996)固定在右下角, 且整块画布
  // 都吃指针事件 —— 会把这个 z-50 的头像整个压住(点不动也拖不动)。
  // 宠物预览页的宠物就是主角, 所以那页把头像一个挪到左下角, 把右下角让给宠物。
  const petOwnsCorner = pathname === '/sky/pet-buddy';
  const [open, setOpen] = useState(false);
  const [scene, setScene] = useState<Scene>('idle');
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0, dist: 0, moved: false });
  const fabRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Drag via native DOM events
  useEffect(() => {
    const el = fabRef.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const dr = dragRef.current;
      dr.startX = e.clientX;
      dr.startY = e.clientY;
      dr.originX = rect.left;
      dr.originY = rect.top;
      dr.dist = 0;
      dr.moved = false;
      el.setPointerCapture(e.pointerId);
    };

    const onMove = (e: PointerEvent) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      const dr = dragRef.current;
      const dx = e.clientX - dr.startX;
      const dy = e.clientY - dr.startY;
      dr.dist = Math.abs(dx) + Math.abs(dy);
      if (dr.dist > 4) {
        dr.moved = true;
        setHasDragged(true);
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - 56, dr.originX + dx)),
          y: Math.max(0, Math.min(window.innerHeight - 56, dr.originY + dy)),
        });
      }
    };

    const onUp = (e: PointerEvent) => {
      if (!el.hasPointerCapture(e.pointerId)) return;
      el.releasePointerCapture(e.pointerId);
      if (!dragRef.current.moved) {
        setOpen(true);
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
    };
  }, []);
  const [transition, setTransition] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [mode, setMode] = useState<KagamiMode>('anime');
  // Hydrate mode from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setMode(loadMode());
  }, []);
  // Reset chat when mode switches
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      setMessages([]);
      setHasGreeted(false);
      prevModeRef.current = mode;
    }
  }, [mode]);
  const isSolving = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Detect if user is asking to solve a problem (vs casual chat)
  const detectIsSolving = (msg: string): boolean => {
    // Normal mode: always answer properly
    if (mode === 'normal') return true;
    // Anime mode: expanded keywords including educational questions
    const problemKeywords =
      /题|题|题目|怎么做|解题|讲解|帮忙|这道|问一下|算|等于|方程|函数|几何|代数|三角|概率|求|证明|化简|因式分解|计算|面积|体积|角度|导数|积分|极限|矩阵|向量|怎么|帮我|什么是|什么叫|怎么理解|解释|区别|定义|概念|原理|定理|公式|方法|步骤|过程|级数|无穷|微积分|为什么/;
    const mathExpr = /\d+[+\-×÷*^]\d+|[xXyYzZ]\s*=/i;
    return problemKeywords.test(msg) || mathExpr.test(msg);
  };

  const CHAT_BRUSHOFFS = [
    '……没事的话，我还要看轻小说呢。',
    '哈？就这？我还以为有题目要问呢。',
    '闲聊的话找此方去，我只负责答疑。',
    '（叹气）你到底有没有正事啊……',
    '喂，我可是很忙的。有题目就快说。',
    '……这种话题不在我的服务范围。',
    '你是不是走错地方了？这里是问题目的。',
    '啧，浪费我时间。下次想好题目再来。',
  ];

  const pickBrushoff = () => CHAT_BRUSHOFFS[Math.floor(Math.random() * CHAT_BRUSHOFFS.length)];

  // ── Normal (常规版) persona & responses ────────────────────────────

  const NORMAL_PERSONA = `你是一个专业、友善的 AI 学习助手。性格特点：
  - 专业严谨：回答问题条理清晰，注重知识点的准确性
  - 耐心温和：无论问题简单还是复杂，都认真对待，循循善诱
  - 鼓励式教学：用积极正面的语言激励学生，肯定进步
  - 实用导向：讲解后会用实例加深理解，帮助举一反三

  说话风格：
  - 开头用"你好！""没问题，让我来帮你""这道题我们可以这样思考"等友好开场
  - 讲解时结构清晰、逻辑严密
  - 适当肯定学生的努力
  - 结尾鼓励学生继续练习

  你是 AI 学习助教，用中文交流。注意：你不是"小镜"，不要以小镜自称，不要使用傲娇或角色扮演的语气。

  数学格式要求：所有数学符号、公式、表达式必须使用 LaTeX 格式。行内公式用 $...$ 包裹，独立公式用 $$...$$ 包裹。例如：$x^2 + y^2 = 1$、$$\sum_{n=0}^{\infty} a_n x^n$$、分数用 \frac{}{}、根号用 \sqrt{}、极限用 \lim、积分用 \int、求和用 \sum。严禁用 ^ 代替上标，严禁用 _ 代替下标。`;

  const NORMAL_OPENING_LINES = [
    '你好！有什么学习上的问题需要帮忙吗？',
    '欢迎！有题目需要讲解吗？',
    '有什么可以帮你的？学习上的问题尽管问。',
    '你好！今天想学习什么内容呢？',
    '在的，有什么题目需要一起探讨吗？',
    '没问题，告诉我你需要什么帮助吧。',
    '你好呀！无论是数学、物理还是其他科目，都可以问我。',
    '有什么问题随时问我，我会尽力帮你解答的。',
  ];

  const pickNormalOpening = () =>
    NORMAL_OPENING_LINES[Math.floor(Math.random() * NORMAL_OPENING_LINES.length)];

  const NORMAL_CHAT_REPLIES = [
    '如果有学习上的问题，随时可以来问我哦。',
    '需要讲解什么题目吗？我随时在这里。',
    '有什么不懂的知识点吗？我们一起看看。',
    '没问题，等你准备好了就把题目发过来吧。',
    '好的，有其他问题随时找我。',
    '加油！有不懂的地方就问我。',
  ];

  const pickNormalReply = () =>
    NORMAL_CHAT_REPLIES[Math.floor(Math.random() * NORMAL_CHAT_REPLIES.length)];

  // Play voice clip for a scene
  const playVoice = useCallback(
    (s: Scene) => {
      if (!voiceOn) return;
      const src = VOICE_CLIPS[s];
      if (!src) return;
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        const audio = new Audio(src);
        audio.volume = 0.7;
        audio.play().catch(() => {
          /* file missing — silent */
        });
        audioRef.current = audio;
      } catch {
        /* ignore */
      }
    },
    [voiceOn],
  );

  // Keyboard shortcut + custom event for opening from other components
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-kagami-panel', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-kagami-panel', onOpen);
    };
  }, []);

  // Auto-scroll
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  // Prevent scroll chaining
  useScrollIsolation(listRef, open);

  const sceneKey = useRef(0);

  // Scene transition — smooth slide for galgame feel
  // Uses a two-layer approach: old image slides out, new image slides in
  const changeScene = useCallback(
    (next: Scene) => {
      if (next === scene) return;
      sceneKey.current += 1;
      setTransition(true); // start exit animation on current
      setTimeout(() => {
        setScene(next);
        playVoice(next);
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setTransition(false)); // enter animation on new
        });
      }, 350); // match CSS duration
    },
    [scene, playVoice],
  );

  // T04: 课堂运行时检测到受挫信号（detectFrustration）后派发 'kagami-frustration'，
  // 切到 chibi 场景温柔接住，避免评判式措辞。
  useEffect(() => {
    const onFrustration = () => changeScene('chibi');
    window.addEventListener('kagami-frustration', onFrustration);
    return () => window.removeEventListener('kagami-frustration', onFrustration);
  }, [changeScene]);

  const sendMessage = async (msgs: Message[]) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/sky/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: sanitizeAssistantMessages(msgs),
          style: 'detailed',
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              mode === 'anime' ? '……信号不好，待会再说。' : '抱歉，网络连接异常，请稍后重试。',
          },
        ]);
        changeScene('idle');
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = '';
      setMessages((prev) => [...prev, { role: 'assistant', content: '' }]);

      const processChunk = (text: string) => {
        const lines = text.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            if (event.type === 'text_delta' && event.content) {
              reply += event.content;
              setMessages((prev) => {
                const copy = [...prev];
                copy[copy.length - 1] = { role: 'assistant', content: reply };
                return copy;
              });
            }
            if (event.type === 'done') {
              if (isSolving.current) changeScene('done');
            }
          } catch {
            /* partial */
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Flush buffered data — the 'done' SSE event may be here
          const tail = decoder.decode();
          if (tail) processChunk(tail);
          break;
        }
        processChunk(decoder.decode(value, { stream: true }));
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              mode === 'anime' ? '……烦死了，网络又出问题了。' : '抱歉，网络出现问题，请稍后重试。',
          },
        ]);
        changeScene('idle');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput('');

    // Detect problem-solving intent
    isSolving.current = detectIsSolving(userMsg);

    // First message from user
    if (!hasGreeted) {
      setHasGreeted(true);
      const opening = mode === 'anime' ? pickOpening() : pickNormalOpening();
      const next: Message[] = [
        { role: 'assistant', content: opening },
        { role: 'user', content: userMsg },
      ];
      setMessages(next);

      if (isSolving.current) {
        // Problem: show thinking, call LLM
        changeScene('thinking');
        setLoading(true);
        sendMessage(next);
      } else {
        // Casual: mode-appropriate reply, stay idle
        setTimeout(() => {
          const reply = mode === 'anime' ? pickBrushoff() : pickNormalReply();
          setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
        }, 600);
      }
      return;
    }

    // Subsequent messages
    const next: Message[] = [...messages, { role: 'user' as const, content: userMsg }];
    setMessages(next);

    if (isSolving.current) {
      changeScene('thinking');
      setLoading(true);
      sendMessage(next);
    } else {
      // Casual chat: mode-appropriate reply, no scene change
      setTimeout(() => {
        const reply = mode === 'anime' ? pickBrushoff() : pickNormalReply();
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      }, 600);
    }
  };

  // Play voice when panel opens
  useEffect(() => {
    if (open) playVoice('idle');
  }, [open, playVoice]);

  // Switch to teaching scene ONLY when solving a problem and streaming explanation
  useEffect(() => {
    if (loading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant') {
      if (isSolving.current) {
        changeScene('teaching');
      }
      // For casual chat: stay in thinking scene, go directly to done when finished
    }
  }, [changeScene, loading, messages]);

  // Auto-return to idle from done after 5s
  useEffect(() => {
    if (scene === 'done' && !loading) {
      const timer = setTimeout(() => changeScene('idle'), 5000);
      return () => clearTimeout(timer);
    }
  }, [scene, loading, changeScene]);

  if (
    pathname?.startsWith('/auth') ||
    pathname === '/sky/onboarding' ||
    pathname?.startsWith('/sky/software-cup') ||
    pathname?.startsWith('/sky/cloud-mind/course-studio') ||
    pathname?.startsWith('/sky/study-lab') ||
    (mobile && pathname === '/m/auth/login')
  ) {
    return null;
  }

  return (
    <>
      {/* Scene transition keyframes */}
      <style>{`
        @keyframes kagamiSlideOut {
          0%   { opacity: 1; transform: translateX(0) scale(1); }
          100% { opacity: 0; transform: translateX(-24px) scale(0.96); }
        }
        @keyframes kagamiSlideIn {
          0%   { opacity: 0; transform: translateX(24px) scale(0.96); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes avatarPulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
      `}</style>

      {/* FAB — always rendered, hidden via CSS when panel open (so listeners persist) */}
      <button
        ref={fabRef}
        aria-label={mode === 'anime' ? '打开小镜课堂' : '打开 AI 学习助手'}
        className={`fixed z-50 h-14 w-14 items-center justify-center overflow-hidden rounded-full shadow-lg hover:scale-105 transition-transform cursor-grab active:cursor-grabbing select-none touch-none ${mobile || pathname === '/' || pathname?.startsWith('/m/') || kagamiClosed ? 'hidden' : 'flex'} ${open ? 'hidden' : ''}`}
        style={
          hasDragged
            ? { left: pos.x, top: pos.y }
            : petOwnsCorner
              ? { left: 24, bottom: 24 }
              : { right: 24, bottom: 24 }
        }
        title={
          mode === 'anime'
            ? '小镜课堂 (Ctrl+Shift+A) — 点击打开 / 拖拽移动'
            : 'AI 学习助手 (Ctrl+Shift+A) — 点击打开 / 拖拽移动'
        }
      >
        <img
          src={mascotImage || (mode === 'anime' ? CHIBI : NORMAL_ICON)}
          alt="小镜"
          draggable={false}
          className="h-full w-full object-cover pointer-events-none"
        />
      </button>

      {/* Panel */}
      {open && (
        <>
          {mobile && (
            <button
              type="button"
              aria-label="关闭学习助手"
              className="absolute inset-0 z-[99] cursor-default bg-slate-950/35 backdrop-blur-[2px]"
              onClick={() => setOpen(false)}
            />
          )}
          <section
            ref={panelRef}
            role="dialog"
            aria-modal={mobile || undefined}
            aria-label={mode === 'anime' ? '小镜课堂' : 'AI 学习助手'}
            className={`flex flex-col overflow-hidden border bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 ${
              mobile
                ? 'absolute inset-x-0 bottom-0 z-[100] h-[min(72dvh,620px)] rounded-t-3xl border-x-0 border-b-0'
                : 'fixed bottom-4 right-4 z-50 h-[min(620px,calc(100dvh-2rem))] w-[min(420px,calc(100vw-2rem))] rounded-lg border-gray-200'
            }`}
          >
            {mobile && (
              <div className="flex h-5 shrink-0 items-center justify-center" aria-hidden="true">
                <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
              </div>
            )}

            {/* Header */}
            <div className="flex min-h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-700">
              <div
                data-kagami
                className={`relative size-10 shrink-0 overflow-hidden rounded-full border ${
                  mode === 'anime'
                    ? 'border-violet-200 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/40'
                    : 'border-sky-200 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/40'
                }`}
              >
                <img
                  key={sceneKey.current}
                  // 宠物联动: 用户选了宠物(白/黑猫、VRM人物)时, 进入对话后的头像就
                  // 用那只宠物, 与右下角浮钮一致 —— 而不是一直显示小镜。没设宠物(访客
                  // 或未开宠物)才退回二次元/常规场景头像。这与 home 用 AssistantPanel 时
                  // 消息头像渲染宠物是同一套 petKind→mascotImage 换算(/avatars/mascot)。
                  src={
                    mascotImage ||
                    (mode === 'anime' ? SCENES[scene] : NORMAL_SCENES[scene])
                  }
                  alt={mascotImage ? '当前宠物头像' : mode === 'anime' ? '小镜头像' : 'AI 学习助手头像'}
                  className={`size-full ${
                    mascotImage || mode === 'normal' ? 'object-cover' : 'object-contain'
                  }`}
                  style={{
                    animation: transition
                      ? 'kagamiSlideOut 350ms ease-in forwards'
                      : 'kagamiSlideIn 400ms ease-out forwards',
                  }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-50">
                  {mode === 'anime' ? '小镜课堂' : 'AI 学习助手'}
                </h2>
                <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span
                    className={`size-1.5 rounded-full ${loading ? 'animate-pulse bg-amber-400' : 'bg-emerald-500'}`}
                  />
                  {scene === 'idle' && '随时可以提问'}
                  {scene === 'thinking' && '正在思考'}
                  {scene === 'teaching' && '正在组织讲解'}
                  {scene === 'done' && '解答完成'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {/* Mode toggle */}
                <button
                  type="button"
                  onClick={() => {
                    const next = mode === 'anime' ? 'normal' : 'anime';
                    setMode(next);
                    try {
                      localStorage.setItem('kagami-panel-mode', next);
                    } catch {
                      /* ignore */
                    }
                  }}
                  className={`flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors ${
                    mode === 'anime'
                      ? 'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/40 dark:text-violet-300'
                      : 'bg-sky-50 text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300'
                  }`}
                  title={
                    mode === 'anime'
                      ? '当前：二次元版 — 点击切换常规版'
                      : '当前：常规版 — 点击切换二次元版'
                  }
                >
                  {mode === 'anime' ? (
                    <Sparkles className="size-4" />
                  ) : (
                    <BookOpen className="size-4" />
                  )}
                  <span className={mobile ? 'sr-only' : ''}>
                    {mode === 'anime' ? '二次元' : '常规'}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceOn((v) => !v)}
                  aria-label={voiceOn ? '关闭语音' : '开启语音'}
                  aria-pressed={voiceOn}
                  className={`flex size-11 items-center justify-center rounded-md transition-colors ${
                    voiceOn
                      ? 'text-violet-600 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-950/40'
                      : 'text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-slate-800'
                  }`}
                  title={voiceOn ? '语音已开启' : '语音已关闭'}
                >
                  {voiceOn ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="关闭学习助手"
                  className="flex size-11 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div
              ref={listRef}
              className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
              style={{ overscrollBehavior: 'contain' }}
            >
              {messages.length === 0 && (
                <div className="flex min-h-full flex-col items-center justify-center py-4 text-center">
                  <div className="mb-3 flex size-12 items-center justify-center rounded-full bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300">
                    <Sparkles className="size-5" />
                  </div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {mode === 'anime' ? '遇到不会的题目了？' : '有任何学习问题，尽管问我'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    {mode === 'anime' ? '输入问题，小镜会帮你' : '输入题目，我会耐心解答'}
                  </p>
                  <div className="mt-5 flex w-full max-w-[320px] flex-wrap justify-center gap-2">
                    {['讲解这道题', '梳理知识点', '制定复习计划'].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setInput(prompt)}
                        className="min-h-10 rounded-full border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-violet-700 dark:hover:bg-violet-950/30"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-lg px-3 py-2 text-sm leading-6 ${
                      m.role === 'user'
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {m.content ? <InlineMath text={m.content} /> : loading ? '...' : ''}
                  </div>
                </div>
              ))}
            </div>

            {/* Input */}
            <div className="shrink-0 border-t border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-end gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5 transition-colors focus-within:border-violet-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-violet-100 dark:border-slate-700 dark:bg-slate-800 dark:focus-within:border-violet-500 dark:focus-within:bg-slate-900 dark:focus-within:ring-violet-950">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="输入题目……"
                  rows={1}
                  className="max-h-24 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!input.trim() || loading}
                  aria-label="发送问题"
                  className="flex size-10 shrink-0 items-center justify-center rounded-md bg-violet-600 text-white transition-colors hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
                >
                  <Send className="size-4" />
                </button>
              </div>
              <p className="mt-1.5 px-1 text-[11px] text-slate-400 dark:text-slate-500">
                Enter 发送，Shift + Enter 换行
              </p>
            </div>
          </section>
        </>
      )}

      </>
  );
}
