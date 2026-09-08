/**
 * Template picker modal — browse and select built-in templates.
 */

'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CourseTemplate, CourseTemplateSubject } from '@/lib/templates/types';
import {
  getBuiltInTemplates,
  searchTemplates,
  getTemplateName,
  getTemplateDescription,
} from '@/lib/templates/registry';
const SUBJECTS: {
  key: 'all' | CourseTemplateSubject;
  label: Record<string, string>;
  icon: string;
}[] = [
  { key: 'all', label: { 'zh-CN': '全部', 'en-US': 'All' }, icon: '📚' },
  { key: 'math', label: { 'zh-CN': '数学', 'en-US': 'Math' }, icon: '📐' },
  { key: 'physics', label: { 'zh-CN': '物理', 'en-US': 'Physics' }, icon: '⚡' },
  { key: 'chemistry', label: { 'zh-CN': '化学', 'en-US': 'Chemistry' }, icon: '🧪' },
  { key: 'english', label: { 'zh-CN': '英语', 'en-US': 'English' }, icon: '📖' },
  { key: 'ai', label: { 'zh-CN': 'AI', 'en-US': 'AI' }, icon: '🤖' },
  { key: 'programming', label: { 'zh-CN': '编程', 'en-US': 'Programming' }, icon: '💻' },
  { key: 'anime', label: { 'zh-CN': '动漫', 'en-US': 'Anime' }, icon: '🎬' },
  { key: 'gaming', label: { 'zh-CN': '游戏', 'en-US': 'Gaming' }, icon: '🎮' },
];

function resolveSubjectLabel(label: Record<string, string>, locale: string): string {
  return label[locale] ?? label['zh-CN'] ?? label['en-US'] ?? '';
}

const DIALOG_TITLES: Record<string, string> = {
  'zh-CN': '从模板创建',
  'en-US': 'Create from Template',
};

const DIALOG_DESCS: Record<string, string> = {
  'zh-CN': '选择一个预设课程模板快速开始',
  'en-US': 'Choose a pre-built course template to get started quickly',
};

const SEARCH_PLACEHOLDERS: Record<string, string> = {
  'zh-CN': '搜索模板...',
  'en-US': 'Search templates...',
};

const USE_BTN_LABELS: Record<string, string> = {
  'zh-CN': '使用模板',
  'en-US': 'Use Template',
};

const NO_RESULTS: Record<string, string> = {
  'zh-CN': '未找到模板',
  'en-US': 'No templates found',
};

function t(map: Record<string, string>, locale: string): string {
  return map[locale] ?? map['zh-CN'] ?? map['en-US'] ?? '';
}

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (template: CourseTemplate) => void;
}

export function TemplatePicker({ open, onClose, onSelect }: TemplatePickerProps) {
  const locale = 'zh-CN';
  const [subject, setSubject] = useState('all');
  const [query, setQuery] = useState('');

  const allTemplates = getBuiltInTemplates();
  const filtered =
    subject === 'all' ? allTemplates : allTemplates.filter((t) => t.subject === subject);
  const results = query ? searchTemplates(query, locale) : filtered;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t(DIALOG_TITLES, locale)}</DialogTitle>
          <DialogDescription>{t(DIALOG_DESCS, locale)}</DialogDescription>
        </DialogHeader>

        <div className="mb-4">
          <input
            type="text"
            placeholder={t(SEARCH_PLACEHOLDERS, locale)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <Tabs value={subject} onValueChange={setSubject}>
          <TabsList className="mb-4 flex-wrap h-auto">
            {SUBJECTS.map((s) => (
              <TabsTrigger key={s.key} value={s.key}>
                {s.icon} {resolveSubjectLabel(s.label, locale)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((template) => (
            <Card
              key={template.id}
              className="cursor-pointer hover:border-primary transition-colors"
            >
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{template.icon}</span>
                  <div>
                    <CardTitle className="text-base">{getTemplateName(template, locale)}</CardTitle>
                    <CardDescription className="text-xs text-muted-foreground/70">
                      {getTemplateName(template, locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {getTemplateDescription(template, locale)}
                </p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-secondary px-2 py-1 rounded capitalize">
                    {template.subject}
                  </span>
                  {template.grade && (
                    <span className="text-xs bg-secondary px-2 py-1 rounded">{template.grade}</span>
                  )}
                  <span className="text-xs bg-secondary px-2 py-1 rounded">
                    {template.outline.length} scenes
                  </span>
                </div>
              </CardContent>
              <CardFooter>
                <Button size="sm" className="w-full" onClick={() => onSelect(template)}>
                  {t(USE_BTN_LABELS, locale)}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        {results.length === 0 && (
          <p className="text-center text-muted-foreground py-8">{t(NO_RESULTS, locale)}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
