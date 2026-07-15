'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle, FileWarning } from 'lucide-react';
import type { QuestionBankInsert } from '@/lib/question-bank/types';
import type { ImportRowError } from '@/lib/question-bank/importers/types';

interface ImportPreviewProps {
  entries: QuestionBankInsert[];
  errors: ImportRowError[];
  fileName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  choice: '选择',
  fill: '填空',
  solve: '解答',
  judge: '判断',
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
};

export function ImportPreview({
  entries,
  errors,
  fileName,
  onConfirm,
  onCancel,
}: ImportPreviewProps) {
  const hasErrors = errors.length > 0;
  const canImport = entries.length > 0;

  return (
    <Card className="mb-6 flex flex-col max-h-[calc(100vh-140px)]">
      <CardHeader className="shrink-0">
        <CardTitle className="text-lg flex items-center gap-2">
          {hasErrors ? (
            <FileWarning className="w-5 h-5 text-yellow-500" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
          导入预览
          {fileName && <span className="text-sm font-normal text-muted-foreground">({fileName})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 flex-1 min-h-0">
        {/* Stats */}
        <div className="flex flex-wrap gap-3 shrink-0">
          <Badge variant="secondary">总计: {entries.length + errors.length}</Badge>
          <Badge variant="default" className="bg-green-600">有效: {entries.length}</Badge>
          {errors.length > 0 && <Badge variant="destructive">错误: {errors.length}</Badge>}
        </div>

        {/* Errors summary */}
        {hasErrors && (
          <div className="rounded-md border bg-yellow-50 dark:bg-yellow-950/20 p-3 shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <p className="text-sm font-medium">发现 {errors.length} 条错误</p>
            </div>
            <ScrollArea className="max-h-[120px]">
              <div className="space-y-1">
                {errors.map((err, idx) => (
                  <div key={idx} className="text-xs text-yellow-700 dark:text-yellow-400">
                    {err.row > 0 ? `第 ${err.row} 行` : '全局'}: {err.reason}
                    {err.field && ` (${err.field})`}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Preview table */}
        {entries.length > 0 && (
          <div className="rounded-md border flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium w-12">#</th>
                    <th className="text-left px-3 py-2 font-medium">学科</th>
                    <th className="text-left px-3 py-2 font-medium">题型</th>
                    <th className="text-left px-3 py-2 font-medium">难度</th>
                    <th className="text-left px-3 py-2 font-medium min-w-[200px]">内容</th>
                    <th className="text-left px-3 py-2 font-medium">答案</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => (
                    <tr
                      key={idx}
                      className="border-t transition-colors hover:bg-muted/50"
                    >
                      <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                      <td className="px-3 py-2">{entry.subject || '-'}</td>
                      <td className="px-3 py-2">{TYPE_LABELS[entry.questionType] || entry.questionType}</td>
                      <td className="px-3 py-2">{DIFFICULTY_LABELS[entry.difficulty] || entry.difficulty}</td>
                      <td className="px-3 py-2 max-w-[300px] truncate">{entry.content}</td>
                      <td className="px-3 py-2 max-w-[150px] truncate">{entry.answer}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        {entries.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm shrink-0">
            没有可导入的数据，请检查文件内容
          </div>
        )}

        {/* Actions — always visible at bottom */}
        <div className="flex justify-end gap-2 pt-2 shrink-0">
          <Button variant="outline" onClick={onCancel}>
            取消
          </Button>
          <Button onClick={onConfirm} disabled={!canImport}>
            确认导入 ({entries.length} 条)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
