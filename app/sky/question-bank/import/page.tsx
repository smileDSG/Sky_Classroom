'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { createLogger } from '@/lib/logger';
import { ImportPreview } from '@/components/sky/question-bank/import-preview';
import { createJsonImporter } from '@/lib/question-bank/importers/json-importer';
import { createCsvImporter } from '@/lib/question-bank/importers/csv-importer';
import { createXlsxImporter } from '@/lib/question-bank/importers/xlsx-importer';
import type { ImportPipelineResult, ImportRowError } from '@/lib/question-bank/importers/types';
import type { QuestionBankInsert } from '@/lib/question-bank/types';
import {
  Upload, FileText, ArrowLeft,
  CheckCircle, AlertCircle, XCircle, X,
} from 'lucide-react';

const log = createLogger('QB:ImportPage');

type PreviewState = {
  entries: QuestionBankInsert[];
  errors: ImportRowError[];
  file: File;
} | null;

export default function ImportPage() {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<PreviewState>(null);
  const [progress, setProgress] = useState<{ stage: string; processed: number; total: number } | null>(null);
  const [result, setResult] = useState<{ total: number; inserted: number; duplicates: number; errors: Array<{ row: number; reason: string }> } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Import history (localStorage)
  const [history, setHistory] = useState<Array<{ date: string; fileName: string; total: number; inserted: number; duplicates: number; errors: number }>>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('qb_import_history');
      if (raw) setHistory(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const addHistory = (fileName: string, total: number, inserted: number, duplicates: number, errors: number) => {
    const entry = { date: new Date().toISOString(), fileName, total, inserted, duplicates, errors };
    setHistory((prev) => {
      const next = [entry, ...prev].slice(0, 20);
      localStorage.setItem('qb_import_history', JSON.stringify(next));
      return next;
    });
  };

  // ── Parse file locally for preview (JSON/CSV/Excel only) ──────────

  const parsePreview = useCallback(async (file: File): Promise<ImportPipelineResult | null> => {
    const name = file.name.toLowerCase();
    try {
      if (name.endsWith('.json')) {
        const text = await file.text();
        return createJsonImporter().parse(text);
      }
      if (name.endsWith('.csv')) {
        const text = await file.text();
        return createCsvImporter().parse(text);
      }
      if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
        const arrayBuffer = await file.arrayBuffer();
        return createXlsxImporter().parse(Buffer.from(arrayBuffer));
      }
      return null; // PDF or unknown: no local preview
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '无法解析该文件，请检查格式';
      log.error('Preview parse failed:', err);
      toast.error('文件解析失败', { description: message });
      return null;
    }
  }, []);

  // ── Upload file to API ────────────────────────────────────────────

  const uploadFile = useCallback(async (file: File) => {
    if (uploading) return;
    setUploading(true);
    setResult(null);
    setProgress(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/sky/question-bank/import', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`上传失败: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'progress') {
              setProgress({ stage: event.stage, processed: event.processed, total: event.total });
            } else if (event.type === 'complete') {
              setResult(event.result);
              const { total, inserted, duplicates, errors } = event.result;
              addHistory(file.name || '未知文件', total, inserted, duplicates, errors.length);
              if (errors.length === 0) {
                toast.success('导入完成', {
                  description: `成功导入 ${inserted} 道题${duplicates > 0 ? `，跳过 ${duplicates} 道重复` : ''}`,
                });
              } else if (inserted > 0) {
                toast.warning('导入部分成功', {
                  description: `成功 ${inserted} 道，失败 ${errors.length} 道${duplicates > 0 ? `，重复 ${duplicates} 道` : ''}`,
                });
              } else {
                toast.error('导入失败', {
                  description: `全部 ${errors.length} 条记录导入失败，请检查文件格式`,
                });
              }
            } else if (event.type === 'error') {
              throw new Error(event.message);
            }
          } catch {
            // ignore malformed events
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '请检查文件格式后重试';
      if (err instanceof Error && err.name === 'AbortError') {
        log.info('Import aborted');
        toast.info('导入已取消');
      } else {
        log.error('Import failed:', err);
        toast.error('导入失败', { description: message });
        setResult({ total: 0, inserted: 0, duplicates: 0, errors: [{ row: 0, reason: message }] });
      }
    } finally {
      setUploading(false);
      abortRef.current = null;
    }
  }, [uploading]);

  // ── File selection handler ────────────────────────────────────────

  const handleFile = useCallback(async (file: File) => {
    setPreview(null);
    setResult(null);

    const lowerName = file.name.toLowerCase();
    // PDF, images, and Word go directly; others try local preview first
    if (
      lowerName.endsWith('.pdf') ||
      lowerName.endsWith('.png') ||
      lowerName.endsWith('.jpg') ||
      lowerName.endsWith('.jpeg') ||
      lowerName.endsWith('.docx')
    ) {
      uploadFile(file);
      return;
    }

    const parsed = await parsePreview(file);
    if (parsed) {
      setPreview({ entries: parsed.entries, errors: parsed.rawErrors, file });
    } else {
      uploadFile(file);
    }
  }, [parsePreview, uploadFile]);

  const handleConfirm = useCallback(() => {
    if (!preview) return;
    setPreview(null);
    uploadFile(preview.file);
  }, [preview, uploadFile]);

  const handleCancelPreview = useCallback(() => {
    setPreview(null);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const stageLabel = (stage?: string) => {
    switch (stage) {
      case 'parsing': return '解析中...';
      case 'inserting': return '入库中...';
      default: return '处理中...';
    }
  };

  return (
    <div className="container mx-auto py-6 px-4 max-w-3xl">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/sky/question-bank">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">批量导入题库</h1>
      </div>

      {/* Upload zone */}
      <Card className={`mb-6 border-2 border-dashed transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-muted'}`}>
        <CardContent className="pt-6">
          <div
            className="flex flex-col items-center justify-center py-12 cursor-pointer"
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <Upload className="w-10 h-10 text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-1">点击或拖拽文件到此处</p>
            <p className="text-xs text-muted-foreground">支持 JSON、CSV、Excel、PDF、图片、Word 格式，单个文件最大 50MB</p>
            <input
              id="file-input"
              type="file"
              className="hidden"
              accept=".json,.csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.docx"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {preview && (
        <ImportPreview
          entries={preview.entries}
          errors={preview.errors}
          fileName={preview.file.name}
          onConfirm={handleConfirm}
          onCancel={handleCancelPreview}
        />
      )}

      {/* Progress */}
      {uploading && progress && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">{stageLabel(progress.stage)}</p>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-destructive"
                onClick={() => {
                  abortRef.current?.abort();
                }}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                取消
              </Button>
            </div>
            <Progress value={progress.total > 0 ? (progress.processed / progress.total) * 100 : 0} />
            <p className="text-xs text-muted-foreground mt-2">
              {progress.processed} / {progress.total}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Result */}
      {result && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {result.errors.length === 0 ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : result.inserted > 0 ? (
                <AlertCircle className="w-5 h-5 text-yellow-500" />
              ) : (
                <XCircle className="w-5 h-5 text-red-500" />
              )}
              导入结果
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Badge variant="secondary">总计: {result.total}</Badge>
              <Badge variant="default" className="bg-green-600">成功: {result.inserted}</Badge>
              {result.duplicates > 0 && <Badge variant="outline">重复: {result.duplicates}</Badge>}
              {result.errors.length > 0 && <Badge variant="destructive">失败: {result.errors.length}</Badge>}
            </div>

            {result.errors.length > 0 && (
              <div className="rounded-md border bg-muted/50 p-3">
                <p className="text-sm font-medium mb-2">错误详情</p>
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  {result.errors.map((err, idx) => (
                    <div key={idx} className="text-xs text-red-600">
                      {err.row > 0 ? `第 ${err.row} 行: ` : ''}{err.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Link href="/sky/question-bank">
                <Button>查看题库</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">导入历史</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((h, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm truncate">{h.fileName}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(h.date).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="default" className="bg-green-600 text-[10px] h-5">{h.inserted}</Badge>
                    {h.duplicates > 0 && <Badge variant="outline" className="text-[10px] h-5">重复 {h.duplicates}</Badge>}
                    {h.errors > 0 && <Badge variant="destructive" className="text-[10px] h-5">失败 {h.errors}</Badge>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
