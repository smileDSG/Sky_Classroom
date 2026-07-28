/**
 * Personalization Settings Form
 *
 * User personalization preferences for AI interactions.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  BookOpen,
  Brain,
  MessageCircle,
  Settings2,
  RotateCcw,
  ArrowRight,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  useSettingsStore,
  LEARNING_STYLE_LABELS,
  DETAIL_LEVEL_LABELS,
  AI_PERSONALITY_LABELS,
  EDUCATION_LEVEL_LABELS,
  DEFAULT_SUBJECTS,
  type LearningStyle,
  type DetailLevel,
  type AIPersonality,
  type EducationLevel,
} from '@/lib/store/settings';

const LEARNING_STYLES: LearningStyle[] = ['visual', 'auditory', 'reading', 'kinesthetic', 'balanced'];
const DETAIL_LEVELS: DetailLevel[] = ['concise', 'standard', 'detailed', 'comprehensive'];
const AI_PERSONALITIES: AIPersonality[] = ['friendly', 'professional', 'encouraging', 'strict', 'humorous'];
const EDUCATION_LEVELS: EducationLevel[] = ['primary', 'middle', 'high', 'undergraduate', 'graduate', 'other'];

export function PersonalizationForm() {const [activeTab, setActiveTab] = useState<'profile' | 'learning' | 'ai' | 'features'>('profile');

  // Profile settings
  const educationLevel = useSettingsStore((s) => s.educationLevel);
  const grade = useSettingsStore((s) => s.grade);
  const favoriteSubjects = useSettingsStore((s) => s.favoriteSubjects);
  const setEducationLevel = useSettingsStore((s) => s.setEducationLevel);
  const setGrade = useSettingsStore((s) => s.setGrade);
  const toggleSubject = useSettingsStore((s) => s.toggleSubject);

  // Learning settings
  const learningStyle = useSettingsStore((s) => s.learningStyle);
  const detailLevel = useSettingsStore((s) => s.detailLevel);
  const preferredLanguage = useSettingsStore((s) => s.preferredLanguage);
  const setLearningStyle = useSettingsStore((s) => s.setLearningStyle);
  const setDetailLevel = useSettingsStore((s) => s.setDetailLevel);
  const setPreferredLanguage = useSettingsStore((s) => s.setPreferredLanguage);

  // AI personality settings
  const aiPersonality = useSettingsStore((s) => s.aiPersonality);
  const aiName = useSettingsStore((s) => s.aiName);
  const customInstructions = useSettingsStore((s) => s.customInstructions);
  const setAIPersonality = useSettingsStore((s) => s.setAIPersonality);
  const setAIName = useSettingsStore((s) => s.setAIName);
  const setCustomInstructions = useSettingsStore((s) => s.setCustomInstructions);

  // Feature settings
  const autoGenerateQuiz = useSettingsStore((s) => s.autoGenerateQuiz);
  const showStepByStep = useSettingsStore((s) => s.showStepByStep);
  const enableMemory = useSettingsStore((s) => s.enableMemory);
  const enableRAG = useSettingsStore((s) => s.enableRAG);
  const setAutoGenerateQuiz = useSettingsStore((s) => s.setAutoGenerateQuiz);
  const setShowStepByStep = useSettingsStore((s) => s.setShowStepByStep);
  const setEnableMemory = useSettingsStore((s) => s.setEnableMemory);
  const setEnableRAG = useSettingsStore((s) => s.setEnableRAG);
  const resetPersonalization = useSettingsStore((s) => s.resetPersonalization);

  const handleReset = () => {
    if (confirm('确定要重置所有个性化设置吗？')) {
      resetPersonalization();
      toast.success('已重置为默认设置');
    }
  };

  const tabs = [
    { key: 'profile' as const, icon: BookOpen, label: '个人资料' },
    { key: 'learning' as const, icon: Brain, label: '学习偏好' },
    { key: 'ai' as const, icon: MessageCircle, label: 'AI 个性' },
    { key: 'features' as const, icon: Settings2, label: '功能设置' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-violet-500" />
          <h2 className="text-lg font-semibold">{'个性化设置'}</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
          <RotateCcw className="size-4 mr-1" />
          {'重置'}
        </Button>
      </div>

      <Link
        href="/sky/onboarding?mode=edit&redirect=%2Faccount"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        重新填写学习画像
        <ArrowRight className="size-4" />
      </Link>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all',
              activeTab === key
                ? 'bg-white dark:bg-slate-800 text-violet-600 dark:text-violet-400 shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="space-y-6">
          {/* Education Level */}
          <Card className="p-5 space-y-3">
            <label className="text-sm font-medium">{'教育阶段' || '教育阶段'}</label>
            <div className="flex flex-wrap gap-2">
              {EDUCATION_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setEducationLevel(level)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    educationLevel === level
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-300 dark:ring-violet-600'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground',
                  )}
                >
                  {EDUCATION_LEVEL_LABELS[level]}
                </button>
              ))}
            </div>
          </Card>

          {/* Grade */}
          <Card className="p-5 space-y-3">
            <label className="text-sm font-medium">{'年级' || '年级'}</label>
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder={'例如：初二、高一、大三' || '例如：初二、高一、大三'}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </Card>

          {/* Favorite Subjects */}
          <Card className="p-5 space-y-3">
            <label className="text-sm font-medium">{'感兴趣的学科' || '感兴趣的学科'}</label>
            <div className="flex flex-wrap gap-2">
              {(favoriteSubjects.length > 0 ? favoriteSubjects : DEFAULT_SUBJECTS).map((subject) => (
                <button
                  key={subject.id}
                  onClick={() => toggleSubject(subject.id)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                    subject.enabled
                      ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 ring-1 ring-sky-300 dark:ring-sky-600'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground',
                  )}
                >
                  {subject.name}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Learning Tab */}
      {activeTab === 'learning' && (
        <div className="space-y-6">
          {/* Learning Style */}
          <Card className="p-5 space-y-3">
            <label className="text-sm font-medium">{'学习风格' || '学习风格'}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {LEARNING_STYLES.map((style) => (
                <button
                  key={style}
                  onClick={() => setLearningStyle(style)}
                  className={cn(
                    'px-4 py-3 rounded-lg text-sm font-medium transition-all text-center',
                    learningStyle === style
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-300 dark:ring-violet-600'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground',
                  )}
                >
                  {LEARNING_STYLE_LABELS[style]}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {'选择最适合你的学习方式，AI会据此调整讲解风格' || '选择最适合你的学习方式，AI会据此调整讲解风格'}
            </p>
          </Card>

          {/* Detail Level */}
          <Card className="p-5 space-y-3">
            <label className="text-sm font-medium">{'回答详细程度' || '回答详细程度'}</label>
            <div className="flex flex-wrap gap-2">
              {DETAIL_LEVELS.map((level) => (
                <button
                  key={level}
                  onClick={() => setDetailLevel(level)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    detailLevel === level
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-300 dark:ring-violet-600'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground',
                  )}
                >
                  {DETAIL_LEVEL_LABELS[level]}
                </button>
              ))}
            </div>
          </Card>

          {/* Preferred Language */}
          <Card className="p-5 space-y-3">
            <label className="text-sm font-medium">{'首选语言' || '首选语言'}</label>
            <div className="flex gap-2">
              {[
                { value: 'zh', label: '中文' },
                { value: 'en', label: 'English' },
              ].map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => setPreferredLanguage(lang.value)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                    preferredLanguage === lang.value
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-300 dark:ring-violet-600'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground',
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* AI Personality Tab */}
      {activeTab === 'ai' && (
        <div className="space-y-6">
          {/* AI Name */}
          <Card className="p-5 space-y-3">
            <label className="text-sm font-medium">{'AI 助手名称' || 'AI 助手名称'}</label>
            <input
              type="text"
              value={aiName}
              onChange={(e) => setAIName(e.target.value)}
              placeholder={'给你的AI助手起个名字' || '给你的AI助手起个名字'}
              maxLength={20}
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
            />
          </Card>

          {/* AI Personality */}
          <Card className="p-5 space-y-3">
            <label className="text-sm font-medium">{'AI 性格风格' || 'AI 性格风格'}</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {AI_PERSONALITIES.map((personality) => (
                <button
                  key={personality}
                  onClick={() => setAIPersonality(personality)}
                  className={cn(
                    'px-4 py-3 rounded-lg text-sm font-medium transition-all text-center',
                    aiPersonality === personality
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-300 dark:ring-violet-600'
                      : 'bg-muted hover:bg-muted/80 text-muted-foreground',
                  )}
                >
                  {AI_PERSONALITY_LABELS[personality]}
                </button>
              ))}
            </div>
          </Card>

          {/* Custom Instructions */}
          <Card className="p-5 space-y-3">
            <label className="text-sm font-medium">{'自定义指令' || '自定义指令'}</label>
            <Textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder={'告诉AI你的特殊需求，例如：我更喜欢用图示理解概念；请多用例子说明；我对编程感兴趣...' || '告诉AI你的特殊需求，例如：我更喜欢用图示理解概念；请多用例子说明；我对编程感兴趣...'}
              maxLength={500}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{customInstructions.length}/500</p>
          </Card>
        </div>
      )}

      {/* Features Tab */}
      {activeTab === 'features' && (
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-sm font-medium">{'自动出题' || '自动出题'}</label>
                <p className="text-xs text-muted-foreground">{'学习完成后自动生成练习题' || '学习完成后自动生成练习题'}</p>
              </div>
              <Switch checked={autoGenerateQuiz} onCheckedChange={setAutoGenerateQuiz} />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-sm font-medium">{'分步解答' || '分步解答'}</label>
                <p className="text-xs text-muted-foreground">{'解题时显示详细步骤' || '解题时显示详细步骤'}</p>
              </div>
              <Switch checked={showStepByStep} onCheckedChange={setShowStepByStep} />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-sm font-medium">{'记忆功能' || '记忆功能'}</label>
                <p className="text-xs text-muted-foreground">{'AI记住你的学习历史和偏好' || 'AI记住你的学习历史和偏好'}</p>
              </div>
              <Switch checked={enableMemory} onCheckedChange={setEnableMemory} />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label className="text-sm font-medium">{'知识库增强' || '知识库增强'}</label>
                <p className="text-xs text-muted-foreground">{'使用上传的知识库辅助回答' || '使用上传的知识库辅助回答'}</p>
              </div>
              <Switch checked={enableRAG} onCheckedChange={setEnableRAG} />
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
