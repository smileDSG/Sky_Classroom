'use client';

import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { useState, useRef, useEffect } from 'react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

export type AvatarShape = 'circle' | 'hexagon' | 'diamond' | 'blob';
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface CharacterAvatarProps {
  avatar: string;
  name: string;
  role: 'teacher' | 'student' | 'user';
  shape?: AvatarShape;
  size?: AvatarSize;
  isSpeaking?: boolean;
  isThinking?: boolean;
  isActive?: boolean;
  isCueUser?: boolean;
  description?: string;
  color?: string;
  onClick?: () => void;
  className?: string;
}

const sizeClasses: Record<AvatarSize, { wrapper: string; inner: string }> = {
  xs: { wrapper: 'w-8 h-8', inner: 'w-7 h-7' },
  sm: { wrapper: 'w-10 h-10', inner: 'w-9 h-9' },
  md: { wrapper: 'w-12 h-12', inner: 'w-10 h-10' },
  lg: { wrapper: 'w-16 h-16', inner: 'w-14 h-14' },
  xl: { wrapper: 'w-20 h-20', inner: 'w-[4.5rem] h-[4.5rem]' },
};

// Hexagon clip path
const hexagonClipPath = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)';
// Diamond clip path
const diamondClipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
// Blob clip path (organic shape)
const blobClipPath = 'polygon(30% 0%, 70% 0%, 100% 30%, 100% 70%, 70% 100%, 30% 100%, 0% 70%, 0% 30%)';

export function CharacterAvatar({
  avatar,
  name,
  role,
  shape = 'circle',
  size = 'md',
  isSpeaking,
  isThinking,
  isActive,
  isCueUser,
  description,
  color = '#8b5cf6',
  onClick,
  className,
}: CharacterAvatarProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const sizes = sizeClasses[size];

  // Role-based default colors
  const roleColors = {
    teacher: '#8b5cf6', // violet
    student: '#0ea5e9', // sky
    user: '#10b981', // emerald
  };

  const accentColor = color || roleColors[role];

  // Shape clip path
  const getClipPath = () => {
    switch (shape) {
      case 'hexagon':
        return hexagonClipPath;
      case 'diamond':
        return diamondClipPath;
      case 'blob':
        return blobClipPath;
      default:
        return undefined;
    }
  };

  // Glow animation config
  const glowVariants = {
    idle: {
      boxShadow: `0 0 0 0 ${accentColor}00`,
    },
    speaking: {
      boxShadow: [
        `0 0 0 0 ${accentColor}40`,
        `0 0 6px 1px ${accentColor}60`,
        `0 0 0 0 ${accentColor}40`,
      ],
    },
    thinking: {
      boxShadow: [
        `0 0 0 0 ${accentColor}30`,
        `0 0 4px 1px ${accentColor}50`,
        `0 0 0 0 ${accentColor}30`,
      ],
    },
    active: {
      boxShadow: `0 0 0 2px ${accentColor}`,
    },
  };

  const getAnimationState = () => {
    if (isSpeaking) return 'speaking';
    if (isThinking) return 'thinking';
    if (isActive) return 'active';
    return 'idle';
  };

  const AvatarWrapper = ({ children }: { children: React.ReactNode }) => (
    <motion.div
      animate={getAnimationState()}
      variants={glowVariants}
      transition={{
        duration: isSpeaking ? 1.5 : isThinking ? 1 : 0.3,
        repeat: isSpeaking || isThinking ? Infinity : 0,
        ease: 'easeInOut',
      }}
      className={cn(
        'relative flex items-center justify-center',
        sizes.wrapper,
        'transition-transform duration-300',
        isActive && !isSpeaking && !isThinking && 'scale-105',
        onClick && 'cursor-pointer hover:scale-110',
        className
      )}
      onClick={onClick}
      style={{
        clipPath: shape === 'circle' ? undefined : getClipPath(),
        borderRadius: shape === 'circle' ? '50%' : undefined,
      }}
    >
      {children}
    </motion.div>
  );

  // Inner avatar container
  const AvatarInner = () => (
    <div
      className={cn(
        'relative overflow-hidden bg-slate-800',
        sizes.inner,
        shape === 'circle' ? 'rounded-full' : ''
      )}
      style={{
        clipPath: shape === 'circle' ? undefined : getClipPath(),
        borderRadius: shape === 'circle' ? undefined : '50%',
      }}
    >
      {/* Placeholder/loading state */}
      {!imageLoaded && (
        <div className="absolute inset-0 bg-slate-700 animate-pulse" />
      )}

      {/* Avatar image */}
      <img
        src={avatar}
        alt={name}
        className={cn(
          'w-full h-full object-cover transition-opacity duration-300',
          imageLoaded ? 'opacity-100' : 'opacity-0'
        )}
        onLoad={() => setImageLoaded(true)}
      />

      {/* Thinking spinner overlay */}
      {isThinking && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
          />
        </div>
      )}

      {/* Speaking indicator */}
      {isSpeaking && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/80 to-transparent" />
      )}
    </div>
  );

  // Cue indicator
  const CueIndicator = () => (
    <AnimatePresence>
      {isCueUser && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center z-20"
        >
          <motion.div
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-white"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Audio wave visualization for speaking
  const AudioWave = () => (
    <AnimatePresence>
      {isSpeaking && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex gap-0.5"
        >
          {[0, 1, 2, 3, 2, 1, 0].map((height, i) => (
            <motion.div
              key={i}
              animate={{
                height: [4 + height * 2, 8 + height * 4, 4 + height * 2],
                opacity: [0.4, 0.8, 0.4],
              }}
              transition={{
                duration: 0.5 + i * 0.1,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="w-0.5 rounded-full bg-white/70"
              style={{ backgroundColor: accentColor }}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Wrap with HoverCard if description provided
  if (description) {
    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          <div className="relative inline-block">
            <AvatarWrapper>
              <AvatarInner />
            </AvatarWrapper>
            <CueIndicator />
            <AudioWave />
          </div>
        </HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="center"
          className="w-56 p-3 bg-slate-900/90 backdrop-blur-xl border-white/10"
        >
          <div className="flex items-center gap-2 mb-2">
            <div
              className={cn(
                'w-8 h-8 rounded-full overflow-hidden',
                shape === 'hexagon' && 'clip-hexagon',
                shape === 'diamond' && 'clip-diamond',
                shape === 'blob' && 'clip-blob'
              )}
              style={{
                clipPath: shape === 'circle' ? undefined : getClipPath(),
              }}
            >
              <img src={avatar} alt={name} className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">{name}</p>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                style={{ backgroundColor: accentColor }}
              >
                {role === 'teacher' ? '教师' : role === 'student' ? '学生' : '我'}
              </span>
            </div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
        </HoverCardContent>
      </HoverCard>
    );
  }

  return (
    <div className="relative inline-block">
      <AvatarWrapper>
        <AvatarInner />
      </AvatarWrapper>
      <CueIndicator />
      <AudioWave />
    </div>
  );
}

// Character strip for vertical layout
interface CharacterStripProps {
  participants: Array<{
    id: string;
    avatar: string;
    name: string;
    role: 'teacher' | 'student' | 'user';
    color?: string;
    description?: string;
  }>;
  speakingId?: string | null;
  thinkingId?: string | null;
  userAvatar?: string;
  isCueUser?: boolean;
  onParticipantClick?: (id: string) => void;
  className?: string;
  avatarRefMap?: React.MutableRefObject<Map<string, HTMLDivElement>>;
}

export function CharacterStrip({
  participants,
  speakingId,
  thinkingId,
  userAvatar,
  isCueUser,
  onParticipantClick,
  className,
  avatarRefMap,
}: CharacterStripProps) {
  const teacher = participants.find((p) => p.role === 'teacher');
  const students = participants.filter((p) => p.role === 'student');
  const user = participants.find((p) => p.role === 'user');

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-4 py-4',
        className
      )}
    >
      {/* Teacher - Hexagon, larger */}
      {teacher && (
        <div
          className="relative"
          ref={(el) => {
            if (el && avatarRefMap) avatarRefMap.current.set(teacher.id, el);
          }}
        >
          <CharacterAvatar
            avatar={teacher.avatar}
            name={teacher.name}
            role="teacher"
            shape="hexagon"
            size="md"
            isSpeaking={speakingId === teacher.id}
            isThinking={thinkingId === teacher.id}
            isActive={speakingId === teacher.id}
            description={teacher.description}
            color={teacher.color}
            onClick={() => onParticipantClick?.(teacher.id)}
          />
          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-slate-400 whitespace-nowrap">
            {teacher.name}
          </span>
        </div>
      )}

      {/* Divider */}
      {teacher && students.length > 0 && (
        <div className="w-8 h-px bg-gradient-to-r from-transparent via-slate-600/50 to-transparent my-2" />
      )}

      {/* Students - Diamond, scrollable */}
      {students.length > 0 && (
        <div className="flex flex-col items-center gap-3 max-h-[200px] overflow-y-auto scrollbar-hide py-1">
          {students.map((student) => (
            <div
              key={student.id}
              className="relative"
              ref={(el) => {
                if (el && avatarRefMap) avatarRefMap.current.set(student.id, el);
              }}
            >
              <CharacterAvatar
                avatar={student.avatar}
                name={student.name}
                role="student"
                shape="diamond"
                size="sm"
                isSpeaking={speakingId === student.id}
                isThinking={thinkingId === student.id}
                isActive={speakingId === student.id}
                description={student.description}
                color={student.color}
                onClick={() => onParticipantClick?.(student.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Divider */}
      <div className="w-8 h-px bg-gradient-to-r from-transparent via-slate-600/50 to-transparent my-2" />

      {/* User - Blob shape */}
      <div
        className="relative"
        ref={(el) => {
          if (el && avatarRefMap && user) avatarRefMap.current.set(user.id, el);
        }}
      >
        <CharacterAvatar
          avatar={user?.avatar || userAvatar || '/avatars/user.png'}
          name="我"
          role="user"
          shape="blob"
          size="md"
          isActive={isCueUser}
          isCueUser={isCueUser}
          color="#10b981"
          onClick={() => onParticipantClick?.('user')}
        />
        {isCueUser && (
          <motion.span
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-amber-400 whitespace-nowrap font-medium"
          >
            你的回合
          </motion.span>
        )}
      </div>
    </div>
  );
}

export default CharacterAvatar;
