'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Plus, Eye, PenLine } from 'lucide-react';
import { toast } from 'sonner';
import type { QuestionBankRow } from '@/lib/question-bank/types';
import katex from 'katex';

interface QuestionFormProps {
  initialData?: Partial<QuestionBankRow>;
  onSubmit: (data: Partial<QuestionBankRow>) => void;
  onCancel?: () => void;
  submitting?: boolean;
}

function renderLatex(text: string): string {
  if (!text) return '';
  try {
    return katex.renderToString(text, { throwOnError: false, displayMode: false });
  } catch {
    return text;
  }
}

function LatexPreview({ text, label }: { text: string; label?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = renderLatex(text);
    }
  }, [text]);
  if (!text) return null;
  return (
    <div className="mt-2 rounded-lg bg-slate-50 dark:bg-slate-900/50 border p-3">
      {label && <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>}
      <div ref={ref} className="text-sm mt-1" />
    </div>
  );
}

export function QuestionForm({ initialData, onSubmit, onCancel, submitting }: QuestionFormProps) {
  const [subject, setSubject] = useState(initialData?.subject ?? '');
  const [grade, setGrade] = useState(initialData?.grade ?? '');
  const [difficulty, setDifficulty] = useState(initialData?.difficulty ?? 'medium');
  const [questionType, setQuestionType] = useState(initialData?.questionType ?? 'solve');
  const [content, setContent] = useState(initialData?.content ?? '');
  const [answer, setAnswer] = useState(initialData?.answer ?? '');
  const [explanation, setExplanation] = useState(initialData?.explanation ?? '');
  const [options, setOptions] = useState<string[]>(initialData?.options ?? []);
  const [knowledgePoints, setKnowledgePoints] = useState<string[]>(initialData?.knowledgePoints ?? []);
  const [source, setSource] = useState(initialData?.source ?? '');
  const [kpInput, setKpInput] = useState('');

  const [previewMode, setPreviewMode] = useState(false);

  const isChoice = questionType === 'choice';

  useEffect(() => {
    if (!isChoice) {
      setOptions([]);
    } else if (options.length === 0) {
      setOptions(['', '', '', '']);
    }
  }, [isChoice]);

  const handleSubmit = () => {
    if (!content.trim() || !answer.trim()) {
      toast.error('请填写题目内容和答案');
      return;
    }
    if (isChoice) {
      const validOptions = options.filter((o) => o.trim());
      if (validOptions.length < 2) {
        toast.error('选择题至少需要 2 个有效选项', {
          description: `当前只有 ${validOptions.length} 个选项，请补充完整`,
        });
        return;
      }
    }
    onSubmit({
      subject: subject || '未知学科',
      grade,
      difficulty: difficulty as any,
      questionType: questionType as any,
      content: content.trim(),
      answer: answer.trim(),
      explanation: explanation.trim(),
      options: isChoice ? options.filter((o) => o.trim()) : undefined,
      knowledgePoints,
      source: source || undefined,
    });
  };

  const addOption = () => setOptions([...options, '']);
  const removeOption = (idx: number) => setOptions(options.filter((_, i) => i !== idx));
  const updateOption = (idx: number, val: string) => {
    const next = [...options];
    next[idx] = val;
    setOptions(next);
  };

  const addKnowledgePoint = () => {
    const val = kpInput.trim();
    if (val && !knowledgePoints.includes(val)) {
      setKnowledgePoints([...knowledgePoints, val]);
      setKpInput('');
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <Label className="text-xs">学科 *</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="如：数学" />
          </div>
          <div>
            <Label className="text-xs">年级</Label>
            <Input value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="如：高一" />
          </div>
          <div>
            <Label className="text-xs">难度</Label>
            <Select value={difficulty} onValueChange={(v) => setDifficulty(v as 'easy' | 'medium' | 'hard')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">简单</SelectItem>
                <SelectItem value="medium">中等</SelectItem>
                <SelectItem value="hard">困难</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">题型</Label>
            <Select value={questionType} onValueChange={(v) => setQuestionType(v as 'choice' | 'fill' | 'solve' | 'judge')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="choice">选择题</SelectItem>
                <SelectItem value="fill">填空题</SelectItem>
                <SelectItem value="solve">解答题</SelectItem>
                <SelectItem value="judge">判断题</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content with LaTeX preview */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-xs">题目内容 *</Label>
            <Tabs value={previewMode ? 'preview' : 'edit'} onValueChange={(v) => setPreviewMode(v === 'preview')} className="w-auto">
              <TabsList className="h-7">
                <TabsTrigger value="edit" className="text-xs px-2 py-0.5 h-6">
                  <PenLine className="w-3 h-3 mr-1" />
                  编辑
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs px-2 py-0.5 h-6">
                  <Eye className="w-3 h-3 mr-1" />
                  预览
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {previewMode ? (
            <LatexPreview text={content} label="预览" />
          ) : (
            <>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="输入题目内容，支持 LaTeX 公式如 $x^2 + y^2 = 1$..."
                rows={4}
              />
              <LatexPreview text={content} label="实时预览" />
            </>
          )}
        </div>

        {isChoice && (
          <div>
            <Label className="text-xs">选项</Label>
            <div className="space-y-2 mt-1">
              {options.map((opt, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground w-6">{String.fromCharCode(65 + idx)}.</span>
                    <Input
                      value={opt}
                      onChange={(e) => updateOption(idx, e.target.value)}
                      placeholder={`选项 ${String.fromCharCode(65 + idx)}`}
                    />
                    <Button variant="ghost" size="icon" onClick={() => removeOption(idx)} disabled={options.length <= 2}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <LatexPreview text={opt} />
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addOption}>
                <Plus className="w-4 h-4 mr-1" />
                添加选项
              </Button>
            </div>
          </div>
        )}

        {/* Answer with LaTeX preview */}
        <div>
          <Label className="text-xs">答案 *</Label>
          <Input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="输入标准答案" />
          <LatexPreview text={answer} />
        </div>

        {/* Explanation with LaTeX preview */}
        <div>
          <Label className="text-xs">解析</Label>
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="输入答案解析（可选），支持 LaTeX..."
            rows={3}
          />
          <LatexPreview text={explanation} />
        </div>

        <div>
          <Label className="text-xs">知识点</Label>
          <div className="flex flex-wrap gap-2 mt-1 mb-2">
            {knowledgePoints.map((kp, idx) => (
              <div key={idx} className="flex items-center gap-1 bg-muted rounded-full px-3 py-1 text-sm">
                {kp}
                <button onClick={() => setKnowledgePoints(knowledgePoints.filter((_, i) => i !== idx))}>
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              value={kpInput}
              onChange={(e) => setKpInput(e.target.value)}
              placeholder="输入知识点后按回车添加"
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKnowledgePoint(); } }}
            />
            <Button variant="outline" size="sm" onClick={addKnowledgePoint}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div>
          <Label className="text-xs">来源</Label>
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="如：2024年高考真题" />
        </div>
      </CardContent>

      <CardFooter className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={submitting}>
            取消
          </Button>
        )}
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting ? '保存中...' : '保存'}
        </Button>
      </CardFooter>
    </Card>
  );
}
