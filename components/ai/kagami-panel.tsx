'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { InlineMath } from '@/components/ui/inline-math';
import { useScrollIsolation } from '@/lib/hooks/use-scroll-isolation';

type Scene = 'idle' | 'thinking' | 'teaching' | 'done';
type KagamiMode = 'anime' | 'normal';

function loadMode(): KagamiMode {
  try {
    const saved = localStorage.getItem('kagami-panel-mode');
    if (saved === 'normal' || saved === 'anime') return saved;
  } catch { /* ignore */ }
  return 'anime';
}

const SCENES: Record<Scene, string> = {
  idle: '/avatars/kagami/idle.png',
  thinking: '/avatars/kagami/thinking.png',
  teaching: '/avatars/kagami/teaching.png',
  done: '/avatars/kagami/done.png',
};

// Normal mode — single professional avatar with CSS effects per scene
const NORMAL_AVATAR = '/avatars/student-glasses-new.jpg';
const NORMAL_SCENES: Record<Scene, string> = {
  idle: NORMAL_AVATAR,
  thinking: NORMAL_AVATAR,
  teaching: NORMAL_AVATAR,
  done: NORMAL_AVATAR,
};

const CHIBI = '/avatars/kagami/chibi.png';
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

function detectLang(text: string): string {
  let cjk = 0, hira = 0, kata = 0, hang = 0, lat = 0;
  for (const ch of text.slice(0, 500)) {
    const c = ch.charCodeAt(0);
    if ((c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3400 && c <= 0x4DBF)) cjk++;
    else if (c >= 0x3040 && c <= 0x309F) hira++;
    else if (c >= 0x30A0 && c <= 0x30FF) kata++;
    else if (c >= 0xAC00 && c <= 0xD7AF) hang++;
    else if ((c >= 0x41 && c <= 0x5A) || (c >= 0x61 && c <= 0x7A)) lat++;
  }
  if (hira > 0 || kata > 0) return 'ja';
  if (hang > cjk && hang > lat) return 'ko';
  if (cjk > 4) return 'zh';
  if (lat > 0) return 'en';
  return 'auto';
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

export function KagamiPanel() {
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
  // ── translate popup state ────────────────────────────────────
  const [tlPopup, setTlPopup] = useState<{ text: string; src: string; x: number; y: number } | null>(null);
  const [tlResult, setTlResult] = useState('');
  const [tlLoading, setTlLoading] = useState(false);

  // ── mouseup → detect selection → show translate popup ───────
  useEffect(() => {
    const onMouseUp = (e: MouseEvent) => {
      // ignore clicks inside the Kagami panel / FAB
      const target = e.target as HTMLElement;
      if (fabRef.current?.contains(target) || panelRef.current?.contains(target)) return;

      // capture selection synchronously before it's cleared
      const selObj = window.getSelection();
      if (!selObj || selObj.rangeCount === 0) return;
      const text = selObj.toString().trim();
      if (text.length < 2 || text.length > 3000) return;

      let rect: DOMRect;
      try { rect = selObj.getRangeAt(0).getBoundingClientRect(); } catch { return; }
      const src = detectLang(text);
      const x = rect.left + rect.width / 2;
      const y = rect.top - 8;

      setTimeout(() => {
        setTlPopup({ text, src, x, y });
        setTlResult('');
        setTlLoading(true);
        fetch('/api/sky/cloud-mind/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: text.slice(0, 3000), sourceLang: src === 'auto' ? '' : src, targetLang: 'zh', stream: false }),
        }).then(async (res) => {
          const raw = await res.text();
          try {
            const j = JSON.parse(raw);
            setTlResult(j?.success && j?.data?.translation ? j.data.translation : '翻译失败');
          } catch {
            setTlResult(raw.slice(0, 500));
          }
        }).catch(() => setTlResult('网络错误')).finally(() => setTlLoading(false));
      }, 200);
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, []);
  // Hydrate mode from localStorage after mount (avoids SSR mismatch)
  useEffect(() => { setMode(loadMode()); }, []);
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
    const problemKeywords = /题|题|题目|怎么做|解题|讲解|帮忙|这道|问一下|算|等于|方程|函数|几何|代数|三角|概率|求|证明|化简|因式分解|计算|面积|体积|角度|导数|积分|极限|矩阵|向量|怎么|帮我|什么是|什么叫|怎么理解|解释|区别|定义|概念|原理|定理|公式|方法|步骤|过程|级数|无穷|微积分|为什么/;
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

  const pickNormalOpening = () => NORMAL_OPENING_LINES[Math.floor(Math.random() * NORMAL_OPENING_LINES.length)];

  const NORMAL_CHAT_REPLIES = [
    '如果有学习上的问题，随时可以来问我哦。',
    '需要讲解什么题目吗？我随时在这里。',
    '有什么不懂的知识点吗？我们一起看看。',
    '没问题，等你准备好了就把题目发过来吧。',
    '好的，有其他问题随时找我。',
    '加油！有不懂的地方就问我。',
  ];

  const pickNormalReply = () => NORMAL_CHAT_REPLIES[Math.floor(Math.random() * NORMAL_CHAT_REPLIES.length)];

  // Play voice clip for a scene
  const playVoice = useCallback((s: Scene) => {
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
      audio.play().catch(() => { /* file missing — silent */ });
      audioRef.current = audio;
    } catch { /* ignore */ }
  }, [voiceOn]);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'A') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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
  const changeScene = useCallback((next: Scene) => {
    if (next === scene) return;
    sceneKey.current += 1;
    setTransition(true);  // start exit animation on current
    setTimeout(() => {
      setScene(next);
      playVoice(next);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTransition(false)); // enter animation on new
      });
    }, 350); // match CSS duration
  }, [scene, playVoice]);

  const sendMessage = async (msgs: Message[]) => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/sky/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: mode === 'anime' ? KAGAMI_PERSONA : NORMAL_PERSONA },
            ...msgs.map((m) => ({ role: m.role, content: m.content })),
          ],
          style: 'detailed',
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        setMessages((prev) => [...prev, { role: 'assistant', content: mode === 'anime' ? '……信号不好，待会再说。' : '抱歉，网络连接异常，请稍后重试。' }]);
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
          } catch { /* partial */ }
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
        setMessages((prev) => [...prev, { role: 'assistant', content: mode === 'anime' ? '……烦死了，网络又出问题了。' : '抱歉，网络出现问题，请稍后重试。' }]);
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
  }, [open]);

  // Switch to teaching scene ONLY when solving a problem and streaming explanation
  useEffect(() => {
    if (loading && messages.length > 0 && messages[messages.length - 1]?.role === 'assistant') {
      if (isSolving.current) {
        changeScene('teaching');
      }
      // For casual chat: stay in thinking scene, go directly to done when finished
    }
  }, [loading, messages.length]);

  // Auto-return to idle from done after 5s
  useEffect(() => {
    if (scene === 'done' && !loading) {
      const timer = setTimeout(() => changeScene('idle'), 5000);
      return () => clearTimeout(timer);
    }
  }, [scene, loading, changeScene]);

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
        className={`fixed z-50 flex h-14 w-14 items-center justify-center overflow-hidden rounded-full shadow-lg hover:scale-105 transition-transform cursor-grab active:cursor-grabbing select-none touch-none ${open ? 'hidden' : ''}`}
        style={
          hasDragged
            ? { left: pos.x, top: pos.y }
            : { right: 24, bottom: 24 }
        }
        title={mode === 'anime' ? '小镜课堂 (Ctrl+Shift+A) — 点击打开 / 拖拽移动' : 'AI 学习助手 (Ctrl+Shift+A) — 点击打开 / 拖拽移动'}
      >
        <img src={mode === 'anime' ? CHIBI : NORMAL_ICON} alt="小镜" draggable={false} className="h-full w-full object-cover pointer-events-none" />
      </button>

      {/* Panel */}
      {open && (
        <div ref={panelRef} className="fixed bottom-6 right-6 z-50 flex h-[560px] w-[420px] rounded-xl bg-white shadow-2xl border border-gray-200 overflow-hidden">
          {/* Character area */}
          <div className={`relative flex w-[160px] flex-shrink-0 items-end overflow-hidden ${
            mode === 'anime'
              ? 'bg-gradient-to-b from-[#f0e6f6] to-[#e8d5f0]'
              : 'bg-gradient-to-b from-[#e0ecf8] to-[#d0dff0]'
          }`}>
            <div data-kagami className="absolute inset-0 flex items-center justify-center">
              <img
                key={sceneKey.current}
                src={mode === 'anime' ? SCENES[scene] : NORMAL_SCENES[scene]}
                alt="小镜"
                className={`${mode === 'normal' ? 'drop-shadow-md' : ''} max-h-full w-auto object-contain`}
                style={{
                  animation: transition
                    ? 'kagamiSlideOut 350ms ease-in forwards'
                    : `kagamiSlideIn 400ms ease-out forwards ${mode === 'normal' ? ', avatarPulse 3s ease-in-out infinite' : ''}`,
                }}
              />
            </div>
            {/* Scene label */}
            <div className="absolute bottom-2 left-0 right-0 text-center">
              <span className={`text-xs bg-white/70 rounded-full px-2 py-0.5 ${
                mode === 'anime' ? 'text-purple-400' : 'text-blue-500'
              }`}>
                {scene === 'idle' && (mode === 'anime' ? '……' : '待命中')}
                {scene === 'thinking' && (mode === 'anime' ? '正在思考……' : '思考中...')}
                {scene === 'teaching' && (mode === 'anime' ? '讲解中……' : '讲解中...')}
                {scene === 'done' && (mode === 'anime' ? '哼，解决了。' : '已解答 ✅')}
              </span>
            </div>
          </div>

          {/* Chat area */}
          <div className="flex flex-1 flex-col min-w-0">
            {/* Header */}
            <div className="flex items-center justify-between border-b px-3 py-2.5">
              <span className="font-semibold text-sm text-gray-800">{mode === 'anime' ? '小镜课堂' : 'AI 学习助手'}</span>
              <div className="flex items-center gap-1.5">
                {/* Mode toggle */}
                <button
                  onClick={() => {
                    const next = mode === 'anime' ? 'normal' : 'anime';
                    setMode(next);
                    try { localStorage.setItem('kagami-panel-mode', next); } catch { /* ignore */ }
                  }}
                  className={`rounded px-1.5 py-0.5 text-xs transition-colors font-medium ${
                    mode === 'anime'
                      ? 'bg-pink-100 text-pink-600'
                      : 'bg-blue-100 text-blue-600'
                  }`}
                  title={mode === 'anime' ? '当前：二次元版 — 点击切换常规版' : '当前：常规版 — 点击切换二次元版'}
                >
                  {mode === 'anime' ? '🌸 二次元' : '📖 常规'}
                </button>
                <button
                  onClick={() => setVoiceOn((v) => !v)}
                  className={`rounded px-1.5 py-0.5 text-xs transition-colors ${
                    voiceOn
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                  title={voiceOn ? '语音已开启' : '语音已关闭'}
                >
                  {voiceOn ? '🔊' : '🔇'}
                </button>
                <span className="text-[10px] text-gray-400">Ctrl+Shift+A</span>
                <button
                  onClick={() => setOpen(false)}
                  className="rounded p-0.5 text-gray-400 hover:bg-gray-100"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Messages */}
            <div ref={listRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-2" style={{ overscrollBehavior: 'contain' }}>
                {messages.length === 0 && (
                  <div className="py-6 text-center text-sm text-gray-400">
                    <p className="text-lg mb-1">💜</p>
                    <p className="text-xs">
                      {mode === 'anime' ? '遇到不会的题目了？' : '有任何学习问题，尽管问我'}
                    </p>
                    <p className="text-xs text-gray-300">
                      {mode === 'anime' ? '输入问题，小镜会帮你' : '输入题目，我会耐心解答'}
                    </p>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-2.5 py-1.5 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-purple-500 text-white'
                          : 'bg-purple-50 text-gray-700'
                      }`}
                    >
                      {m.content ? <InlineMath text={m.content} /> : (loading ? '...' : '')}
                    </div>
                  </div>
                ))}
              </div>

            {/* Input */}
            <div className="border-t px-2 py-2">
              <div className="flex gap-1.5">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="输入题目……"
                  className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs outline-none focus:border-purple-400"
                />
                <button
                  onClick={handleSubmit}
                  disabled={!input.trim() || loading}
                  className="rounded-lg bg-purple-500 px-3 py-1.5 text-xs text-white hover:bg-purple-600 disabled:opacity-50 transition-colors"
                >
                  发送
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── translate popup (portal) ─────────────────────────── */}
      {tlPopup && typeof window !== 'undefined' && (() => {
        const { createPortal } = require('react-dom');
        return createPortal(
          <div className="fixed inset-0 z-[99999]" onClick={() => { setTlPopup(null); setTlResult(''); }}>
            <div
              className="absolute w-[320px] max-w-[calc(100vw-2rem)] rounded-xl border border-sky-200/60 bg-white shadow-2xl overflow-hidden"
              style={{ left: Math.min(tlPopup.x, window.innerWidth - 330), top: Math.min(tlPopup.y, window.innerHeight - 200) }}
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-3 py-2 border-b border-sky-100 bg-gradient-to-r from-sky-50 to-blue-50">
                <span className="text-xs font-medium text-sky-700">翻译</span>
                <button onClick={() => { setTlPopup(null); setTlResult(''); }} className="text-slate-400 hover:text-slate-600 text-sm leading-none">&times;</button>
              </div>
              <div className="p-3">
                <p className="text-xs text-slate-500 mb-2 line-clamp-3 italic border-l-2 border-sky-200 pl-2">{tlPopup.text}</p>
                <div className="h-px bg-sky-100 mb-2" />
                {tlLoading && (
                  <div className="flex items-center gap-1.5 py-2">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: '120ms' }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: '240ms' }} />
                    <span className="text-xs text-slate-400 ml-2">正在翻译…</span>
                  </div>
                )}
                {!tlLoading && tlResult && (
                  <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">{tlResult}</p>
                )}
              </div>
            </div>
          </div>,
          document.body,
        );
      })()}
    </>
  );
}
