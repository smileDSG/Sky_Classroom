'use client';

import { motion } from 'motion/react';

/**
 * 输入框旁的"小陪伴"。
 * 设计要点：平时近乎隐身（伏着、缓慢呼吸），只有聚焦或输入时才活过来（睁眼、竖耳、摆尾）。
 * 纯装饰：pointer-events none，不挡任何操作；aria-hidden，不干扰读屏。
 * 同一套填充色在亮 / 暗背景上都成立（奶油金，中性）。
 */
export function InputCat({ active }: { active: boolean }) {
  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none absolute bottom-1 right-4 z-10 flex items-end"
      animate={{ y: active ? -1 : 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
    >
      <svg
        width="46"
        height="42"
        viewBox="0 0 46 42"
        fill="none"
        className="drop-shadow-sm"
      >
        {/* 尾巴（摆） */}
        <motion.path
          d="M33 31 q7 -1 5 -8"
          stroke="#efbe8b"
          strokeWidth="3.2"
          strokeLinecap="round"
          animate={active ? { rotate: [0, 10, 0] } : { rotate: 0 }}
          transition={active ? { duration: 0.9, repeat: Infinity } : {}}
          style={{ transformOrigin: '33px 31px', transformBox: 'fill-box' }}
        />
        {/* 身体 */}
        <ellipse cx="22" cy="31" rx="11.5" ry="9" fill="#f5c690" />
        <ellipse cx="15" cy="35" rx="6" ry="4.5" fill="#fbe5cf" />
        {/* 耳朵（聚焦时轻微竖起） */}
        <motion.g animate={active ? { rotate: 0, y: 0 } : { rotate: 4 }} transition={{ duration: 0.3 }} style={{ transformOrigin: '17px 11px' }}>
          <path d="M14 12 L11 3.5 L19 7 Z" fill="#eaa95e" />
        </motion.g>
        <motion.g animate={active ? { rotate: 0, y: 0 } : { rotate: -4 }} transition={{ duration: 0.3 }} style={{ transformOrigin: '33px 10.5px' }}>
          <path d="M33 11 L36 3 L28 6.5 Z" fill="#eaa95e" />
        </motion.g>
        {/* 头 */}
        <circle cx="24" cy="16" r="10.2" fill="#f6cf9f" />
        {/* 表情：醒 / 睡 */}
        {active ? (
          <motion.g initial={{ opacity: 0, y: 1 }} animate={{ opacity: 1, y: 0 }}>
            <circle cx="21.2" cy="16" r="1.7" fill="#3b2e22" />
            <circle cx="28" cy="16" r="1.7" fill="#3b2e22" />
            <circle cx="21.6" cy="15.2" r="0.55" fill="#fff" />
            <circle cx="28.4" cy="15.2" r="0.55" fill="#fff" />
            <path d="M23.2 19 l1 0.8 1.2 -0.6" stroke="#cf8f4e" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
          </motion.g>
        ) : (
          <motion.g
            animate={{ scaleY: [1, 0.9, 1] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '24px 18px' }}
          >
            <path d="M19.6 17.4 q1.7 1.5 3.4 0" stroke="#3b2e22" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M26.4 17.4 q1.7 1.5 3.4 0" stroke="#3b2e22" strokeWidth="1.2" strokeLinecap="round" />
          </motion.g>
        )}
      </svg>
    </motion.div>
  );
}