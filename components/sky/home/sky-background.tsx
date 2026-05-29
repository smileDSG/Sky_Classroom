'use client';

// CSS keyframes for infinite animations — runs on GPU compositor thread, no JS cost
const cloudKeyframes = `
@keyframes cloud-drift {
  from { transform: translateX(-100%); }
  to   { transform: translateX(calc(100vw + 100%)); }
}
@keyframes twinkle {
  0%, 100% { opacity: 0.2; transform: scale(0.8); }
  50%      { opacity: 1;   transform: scale(1.2); }
}
@keyframes shooting {
  0%       { transform: translate(0, 0); opacity: 0; }
  10%      { opacity: 1; }
  100%     { transform: translate(20vw, 30vh); opacity: 0; }
}
@keyframes celestial-pulse {
  0%, 100% { transform: scale(1);   opacity: 0.5; }
  50%      { transform: scale(1.1); opacity: 0.7; }
}
`;

// 动态云朵
function FloatingCloud({
  delay = 0,
  duration = 20,
  y = 0,
  scale = 1,
  opacity = 0.6,
}: {
  delay?: number;
  duration?: number;
  y?: number | string;
  scale?: number;
  opacity?: number;
}) {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        top: y,
        scale: String(scale),
        opacity,
        animation: `cloud-drift ${duration}s linear ${delay}s infinite`,
      }}
    >
      <svg
        viewBox="0 0 200 100"
        className="w-32 h-16 md:w-48 md:h-24 text-white/40 dark:text-white/20"
        fill="currentColor"
      >
        <ellipse cx="50" cy="60" rx="35" ry="25" />
        <ellipse cx="90" cy="45" rx="45" ry="35" />
        <ellipse cx="140" cy="55" rx="40" ry="28" />
        <ellipse cx="30" cy="70" rx="25" ry="18" />
        <ellipse cx="160" cy="65" rx="30" ry="20" />
      </svg>
    </div>
  );
}

// 星光闪烁
function TwinklingStar({
  x,
  y,
  delay = 0,
  size = 2,
}: {
  x: string;
  y: string;
  delay?: number;
  size?: number;
}) {
  return (
    <div
      className="absolute rounded-full bg-white dark:bg-sky-200 pointer-events-none"
      style={{
        left: x,
        top: y,
        width: size,
        height: size,
        boxShadow: '0 0 6px 2px rgba(255,255,255,0.4)',
        animation: `twinkle 3s ease-in-out ${delay}s infinite`,
      }}
    />
  );
}

// 流星
function ShootingStar() {
  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: '10%',
        top: '10%',
        animation: 'shooting 2s ease-out 8s infinite',
      }}
    >
      <div
        className="w-20 h-0.5 bg-gradient-to-r from-transparent via-white to-transparent"
        style={{
          transform: 'rotate(-45deg)',
          boxShadow: '0 0 10px 2px rgba(255,255,255,0.3)',
        }}
      />
    </div>
  );
}

// 太阳光晕
function CelestialBody() {
  return (
    <div
      className="absolute -top-20 -right-20 w-80 h-80 rounded-full pointer-events-none dark:hidden"
      style={{
        background:
          'radial-gradient(circle, rgba(255,200,100,0.3) 0%, rgba(255,150,50,0.1) 40%, transparent 70%)',
        animation: 'celestial-pulse 8s ease-in-out infinite',
      }}
    />
  );
}

// 主背景组件
export function SkyBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none">
      {/* CSS 动画定义 */}
      <style>{cloudKeyframes}</style>

      {/* 渐变天空背景 */}
      <div className="absolute inset-0 bg-gradient-to-b from-sky-200 via-sky-100 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950" />

      {/* 日出/日落效果 */}
      <div
        className="absolute inset-0 opacity-60 dark:opacity-30"
        style={{
          background: `
            radial-gradient(ellipse 120% 80% at 50% -20%, rgba(135,206,235,0.4) 0%, transparent 50%),
            radial-gradient(ellipse 80% 60% at 80% 100%, rgba(255,183,178,0.2) 0%, transparent 40%)
          `,
        }}
      />

      {/* 动态云朵 - 白天 */}
      <div className="dark:hidden">
        <FloatingCloud delay={0} duration={35} y={10} scale={0.8} opacity={0.5} />
        <FloatingCloud delay={5} duration={45} y={25} scale={1.2} opacity={0.4} />
        <FloatingCloud delay={12} duration={40} y={15} scale={0.6} opacity={0.3} />
      </div>

      {/* 星光 - 夜间 (从 10 颗减到 5 颗，视觉几乎无差别) */}
      <div className="hidden dark:block">
        <TwinklingStar x="10%" y="15%" delay={0} size={2} />
        <TwinklingStar x="40%" y="8%" delay={0.8} size={3} />
        <TwinklingStar x="65%" y="20%" delay={1.5} size={2} />
        <TwinklingStar x="85%" y="10%" delay={2.2} size={2.5} />
        <TwinklingStar x="30%" y="30%" delay={0.5} size={2} />
        <ShootingStar />
      </div>

      {/* 光晕 */}
      <CelestialBody />

      {/* 底部渐变遮罩 */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white/80 dark:from-slate-950/80 to-transparent" />

      {/* 网格纹理 */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(100,149,237,0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(100,149,237,0.1) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  );
}
