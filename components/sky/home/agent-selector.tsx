'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Users, Bot, Sparkles, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

// 预定义的代理配置 - 使用用户提供的趣味头像
export const TEACHER_OPTIONS = [
  {
    id: 'default-1',
    name: '卡皮老师',
    nameEn: 'Teacher',
    role: 'teacher',
    description: '水豚数学老师，淡定中透着智慧的光芒',
    avatar: '/avatars/teacher-new.jpg',
    color: '#8B7355',
  },
  {
    id: 'default-2',
    name: '酷盖助教',
    nameEn: 'Assistant',
    role: 'assistant',
    description: '永远戴着墨镜的潮流少年',
    avatar: '/avatars/assistant-new.jpg',
    color: '#6366f1',
  },
];

export const STUDENT_OPTIONS = [
  {
    id: 'default-3',
    name: '海绵宝宝',
    nameEn: 'Curious',
    role: 'student',
    personaType: 'curious',
    description: '对知识如饥似渴，疯狂吸入知识中',
    avatar: '/avatars/student-curious-new.jpg',
    color: '#FF6B6B',
  },
  {
    id: 'default-4',
    name: '已疯同学',
    nameEn: 'Analytical',
    role: 'student',
    personaType: 'analytical',
    description: '开学已疯，但还在坚持学习',
    avatar: '/avatars/student-meme-new.jpg',
    color: '#4ECDC4',
  },
  {
    id: 'default-5',
    name: '杰瑞',
    nameEn: 'Creative',
    role: 'student',
    personaType: 'creative',
    description: '勤奋读书的小老鼠，梦想成为富婆',
    avatar: '/avatars/student-reader-new.jpg',
    color: '#D2691E',
  },
  {
    id: 'default-6',
    name: '小花',
    nameEn: 'Note-Taker',
    role: 'student',
    personaType: 'note-taker',
    description: '戴眼镜的可爱男孩，手里总是拿着小花',
    avatar: '/avatars/student-glasses-new.jpg',
    color: '#FFB6C1',
  },
  {
    id: 'default-7',
    name: '酷酷',
    nameEn: 'Cool',
    role: 'student',
    personaType: 'creative',
    description: '戴墨镜的白发少年，走路带风',
    avatar: '/avatars/student-cool-new.jpg',
    color: '#87CEEB',
  },
];

interface AgentSelectorProps {
  selectedTeacherId: string;
  selectedStudentIds: string[];
  onTeacherChange: (teacherId: string) => void;
  onStudentsChange: (studentIds: string[]) => void;
}

export function AgentSelector({
  selectedTeacherId,
  selectedStudentIds,
  onTeacherChange,
  onStudentsChange,
}: AgentSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedTeacher = TEACHER_OPTIONS.find((t) => t.id === selectedTeacherId);
  const selectedStudents = STUDENT_OPTIONS.filter((s) => selectedStudentIds.includes(s.id));

  const toggleStudent = (studentId: string) => {
    if (selectedStudentIds.includes(studentId)) {
      onStudentsChange(selectedStudentIds.filter((id) => id !== studentId));
    } else {
      onStudentsChange([...selectedStudentIds, studentId]);
    }
  };

  return (
    <div className="w-full">
      {/* 折叠状态 - 显示已选择的代理摘要 */}
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.button
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onClick={() => setIsExpanded(true)}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3 rounded-2xl',
              'bg-gradient-to-r from-slate-50/80 to-slate-100/80',
              'dark:from-slate-800/50 dark:to-slate-700/50',
              'border border-slate-200/60 dark:border-slate-700/60',
              'hover:border-sky-400/40 dark:hover:border-sky-500/40',
              'transition-all duration-200 group',
            )}
          >
            {/* 老师头像 */}
            {selectedTeacher && (
              <div className="relative">
                <div
                  className="relative w-10 h-10 rounded-xl overflow-hidden"
                  style={{ backgroundColor: `${selectedTeacher.color}20` }}
                >
                  <Image
                    src={selectedTeacher.avatar}
                    alt={selectedTeacher.name}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: selectedTeacher.color }}
                >
                  <User className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
            )}

            {/* 学生头像组 */}
            <div className="flex -space-x-2">
              {selectedStudents.slice(0, 3).map((student, index) => (
                <div
                  key={student.id}
                  className="relative w-8 h-8 rounded-lg overflow-hidden border-2 border-white dark:border-slate-800"
                  style={{
                    backgroundColor: `${student.color}20`,
                    zIndex: selectedStudents.length - index,
                  }}
                >
                  <Image
                    src={student.avatar}
                    alt={student.name}
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </div>
              ))}
              {selectedStudents.length > 3 && (
                <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-medium text-slate-600 dark:text-slate-400 border-2 border-white dark:border-slate-800">
                  +{selectedStudents.length - 3}
                </div>
              )}
            </div>

            {/* 文字信息 */}
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {selectedTeacher?.name}
                </span>
                <span className="text-slate-400">·</span>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedStudents.length} 位学生
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-500">点击配置课堂角色</div>
            </div>

            {/* 展开箭头 */}
            <ChevronDown className="w-5 h-5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn(
              'w-full rounded-2xl overflow-hidden',
              'bg-white/90 dark:bg-slate-800/90',
              'border border-slate-200/80 dark:border-slate-700/80',
              'shadow-xl shadow-slate-200/50 dark:shadow-slate-900/30',
            )}
          >
            {/* 头部 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-violet-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
                <span className="font-medium text-slate-800 dark:text-slate-200">配置课堂角色</span>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 内容区 */}
            <div className="p-4 space-y-6">
              {/* 老师选择 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-sky-500" />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    选择老师
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {TEACHER_OPTIONS.map((teacher) => (
                    <button
                      key={teacher.id}
                      onClick={() => onTeacherChange(teacher.id)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl transition-all',
                        'border-2',
                        selectedTeacherId === teacher.id
                          ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/20'
                          : 'border-transparent bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50',
                      )}
                    >
                      <div
                        className="relative w-10 h-10 rounded-xl overflow-hidden"
                        style={{ backgroundColor: `${teacher.color}20` }}
                      >
                        <Image
                          src={teacher.avatar}
                          alt={teacher.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-sm text-slate-800 dark:text-slate-200">
                          {teacher.name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                          {teacher.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 学生选择 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      选择同学
                    </span>
                  </div>
                  <span className="text-xs text-slate-500 dark:text-slate-500">
                    已选择 {selectedStudentIds.length} 位
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {STUDENT_OPTIONS.map((student) => {
                    const isSelected = selectedStudentIds.includes(student.id);
                    return (
                      <button
                        key={student.id}
                        onClick={() => toggleStudent(student.id)}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl transition-all',
                          'border-2 relative',
                          isSelected
                            ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20'
                            : 'border-transparent bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/50',
                        )}
                      >
                        <div
                          className="relative w-10 h-10 rounded-xl overflow-hidden"
                          style={{ backgroundColor: `${student.color}20` }}
                        >
                          <Image
                            src={student.avatar}
                            alt={student.name}
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="font-medium text-sm text-slate-800 dark:text-slate-200">
                            {student.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {student.description}
                          </div>
                        </div>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center"
                          >
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={3}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </motion.div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 提示 */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-sm">
                <Bot className="w-4 h-4 mt-0.5 shrink-0" />
                <span>选择不同性格的同学让课堂更有趣！每个角色都有独特的表情包风格。</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
