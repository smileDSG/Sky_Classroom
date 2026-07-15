'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Mic, Type, Upload, X, Loader2, ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { validateImage } from '@/lib/recognition/image-validator';
import { useAudioRecorder } from '@/lib/hooks/use-audio-recorder';

interface MultimodalInputProps {
  onSubmit: (input: {
    type: 'image' | 'voice' | 'text';
    content: string | File;
    previewUrl?: string;
  }) => void;
  onGrade?: (input: { problem: string; userAnswer: string }) => void;
  isLoading?: boolean;
  className?: string;
  /** Restored preview data URL after page navigation */
  initialPreviewUrl?: string | null;
}

function dataUrlToFile(dataUrl: string, filename = 'photo.png'): File {
  const [header, payload] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new File([bytes], filename, { type: mime });
}

function getInitialImageFile(previewUrl?: string | null): File | null {
  if (!previewUrl) return null;
  try {
    return dataUrlToFile(previewUrl);
  } catch {
    return null;
  }
}

const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp';

export function MultimodalInput({
  onSubmit,
  onGrade,
  isLoading,
  className,
  initialPreviewUrl,
}: MultimodalInputProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'voice' | 'text'>('camera');
  const [selectedImage, setSelectedImage] = useState<string | null>(
    () => initialPreviewUrl ?? null,
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(() =>
    getInitialImageFile(initialPreviewUrl),
  );
  const [textInput, setTextInput] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  /** Shared file processing: validate → read → store */
  const processFile = useCallback((file: File) => {
    setImageError(null);

    const validation = validateImage(file);
    if (!validation.valid) {
      setImageError(validation.error ?? '图片校验失败');
      return;
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  }, []);

  // ── Click to upload ──

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
      e.currentTarget.value = '';
    },
    [processFile],
  );

  const triggerCameraInput = useCallback(() => {
    cameraInputRef.current?.click();
  }, []);

  const triggerGalleryInput = useCallback(() => {
    galleryInputRef.current?.click();
  }, []);

  // ── Drag & drop ──

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingOver(false);

      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  // ── Clipboard paste (Ctrl+V) ──

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            processFile(file);
            return;
          }
        }
      }
    },
    [processFile],
  );

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const clearImage = useCallback(() => {
    setSelectedImage(null);
    setSelectedFile(null);
    setImageError(null);
    if (cameraInputRef.current) {
      cameraInputRef.current.value = '';
    }
    if (galleryInputRef.current) {
      galleryInputRef.current.value = '';
    }
  }, []);

  // ── Voice recording (useAudioRecorder hook) ──

  const { isRecording, isProcessing, recordingTime, startRecording, stopRecording } =
    useAudioRecorder({
      onTranscription: (text) => {
        setTextInput(text);
        setActiveTab('text');
      },
      onError: (error) => {
        setImageError(error);
      },
    });

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleSubmit = useCallback(() => {
    if (activeTab === 'camera' && selectedFile && selectedImage) {
      onSubmit({ type: 'image', content: selectedFile, previewUrl: selectedImage });
    } else if (activeTab === 'text' && textInput.trim()) {
      onSubmit({ type: 'text', content: textInput.trim() });
    }
  }, [activeTab, selectedFile, selectedImage, textInput, onSubmit]);

  const handleGrade = useCallback(() => {
    if (textInput.trim() && userAnswer.trim() && onGrade) {
      onGrade({ problem: textInput.trim(), userAnswer: userAnswer.trim() });
    }
  }, [textInput, userAnswer, onGrade]);

  const canSubmit =
    (activeTab === 'camera' && selectedImage) || (activeTab === 'text' && textInput.trim());

  const canGrade = textInput.trim() && userAnswer.trim();

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as typeof activeTab);
          setImageError(null);
        }}
      >
        <TabsList className="grid w-full grid-cols-3 probe-panel border-[var(--probe-border)] p-1 gap-1">
          <TabsTrigger
            value="camera"
            className="gap-2 data-[state=active]:bg-gradient-to-b data-[state=active]:from-[var(--probe-primary)]/30 data-[state=active]:to-[var(--probe-primary)]/15 data-[state=active]:text-[var(--probe-primary-bright)] data-[state=active]:shadow-[0_0_12px_var(--probe-glow)] data-[state=active]:border data-[state=active]:border-[var(--probe-border-strong)]"
          >
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">捕获</span>
          </TabsTrigger>
          <TabsTrigger
            value="voice"
            className="gap-2 data-[state=active]:bg-gradient-to-b data-[state=active]:from-[var(--probe-primary)]/30 data-[state=active]:to-[var(--probe-primary)]/15 data-[state=active]:text-[var(--probe-primary-bright)] data-[state=active]:shadow-[0_0_12px_var(--probe-glow)] data-[state=active]:border data-[state=active]:border-[var(--probe-border-strong)]"
          >
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">声纳</span>
          </TabsTrigger>
          <TabsTrigger
            value="text"
            className="gap-2 data-[state=active]:bg-gradient-to-b data-[state=active]:from-[var(--probe-primary)]/30 data-[state=active]:to-[var(--probe-primary)]/15 data-[state=active]:text-[var(--probe-primary-bright)] data-[state=active]:shadow-[0_0_12px_var(--probe-glow)] data-[state=active]:border data-[state=active]:border-[var(--probe-border-strong)]"
          >
            <Type className="h-4 w-4" />
            <span className="hidden sm:inline">手输</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {imageError && (
        <div className="rounded-lg border border-[var(--probe-error)]/30 bg-[var(--probe-error)]/10 px-3 py-2 text-sm text-[var(--probe-error)]">
          ⚠ {imageError}
        </div>
      )}

      {activeTab === 'camera' && (
        <div className="space-y-3">
          {!selectedImage ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'relative overflow-hidden rounded-xl border-2 border-dashed p-5 transition-all sm:p-8',
                isDraggingOver
                  ? 'border-[var(--probe-primary)] bg-gradient-to-br from-[var(--probe-primary)]/15 to-[var(--probe-accent)]/10 scale-[1.02] shadow-[0_0_24px_var(--probe-glow)]'
                  : 'border-[var(--probe-border-strong)] bg-gradient-to-br from-[var(--probe-primary)]/5 to-transparent hover:border-[var(--probe-primary)] hover:bg-[var(--probe-primary)]/10 hover:shadow-[0_0_12px_var(--probe-glow)]',
              )}
            >
              {/* Scan-frame corner markers — thicker and more visible */}
              <div className="pointer-events-none absolute inset-3">
                <div className="absolute left-0 top-0 h-6 w-6 border-l-[3px] border-t-[3px] border-[var(--probe-primary-bright)] rounded-tl-sm shadow-[0_0_6px_var(--probe-glow)]" />
                <div className="absolute right-0 top-0 h-6 w-6 border-r-[3px] border-t-[3px] border-[var(--probe-primary-bright)] rounded-tr-sm shadow-[0_0_6px_var(--probe-glow)]" />
                <div className="absolute left-0 bottom-0 h-6 w-6 border-l-[3px] border-b-[3px] border-[var(--probe-primary-bright)] rounded-bl-sm shadow-[0_0_6px_var(--probe-glow)]" />
                <div className="absolute right-0 bottom-0 h-6 w-6 border-r-[3px] border-b-[3px] border-[var(--probe-primary-bright)] rounded-br-sm shadow-[0_0_6px_var(--probe-glow)]" />
              </div>

              <div className="flex flex-col items-center gap-3 text-center">
                <div
                  className={cn(
                    'flex h-16 w-16 items-center justify-center rounded-2xl transition-all border',
                    isDraggingOver
                      ? 'bg-gradient-to-br from-[var(--probe-primary)]/30 to-[var(--probe-accent)]/20 border-[var(--probe-border-strong)] shadow-[0_0_16px_var(--probe-glow)]'
                      : 'bg-gradient-to-br from-[var(--probe-primary)]/15 to-[var(--probe-primary)]/5 border-[var(--probe-border)]',
                  )}
                >
                  {isDraggingOver ? (
                    <ImagePlus className="h-8 w-8 text-[var(--probe-primary-bright)] animate-bounce" />
                  ) : (
                    <Camera className="h-8 w-8 text-[var(--probe-primary-bright)]" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-[var(--probe-text)]">
                    {isDraggingOver ? '松开放入题目照片' : '拍照识题'}
                  </p>
                  <p className="text-sm text-[var(--probe-muted)]">也可以从相册选择已有照片</p>
                </div>
                <div className="mt-2 grid w-full gap-2 sm:grid-cols-[1fr_auto]">
                  <Button
                    type="button"
                    onClick={triggerCameraInput}
                    className="h-11 gap-2 probe-button-primary text-[var(--probe-primary-bright)] font-medium"
                  >
                    <Camera className="h-4 w-4" />
                    拍照识题
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={triggerGalleryInput}
                    className="h-11 gap-2 border-[var(--probe-border-strong)] text-[var(--probe-text)] hover:bg-[var(--probe-primary)]/15 hover:border-[var(--probe-primary)] hover:shadow-[0_0_8px_var(--probe-glow)]"
                  >
                    <Upload className="h-4 w-4" />
                    从相册选
                  </Button>
                </div>
                <p className="text-xs text-[var(--probe-muted)]">
                  支持 JPEG、PNG、WebP，最大 10MB；桌面端可拖拽或粘贴图片
                </p>
              </div>
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-[var(--probe-border-strong)] bg-[var(--probe-surface)] shadow-[0_0_12px_var(--probe-glow)]">
              <img src={selectedImage} alt="Selected problem" className="w-full object-contain" />
              <button
                type="button"
                aria-label="移除题目照片"
                onClick={clearImage}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-all hover:bg-[var(--probe-error)]/80 hover:shadow-[0_0_8px_rgba(248,113,113,0.3)]"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="grid gap-2 border-t border-[var(--probe-border)] bg-[var(--probe-surface-elevated)]/70 p-3 sm:grid-cols-2">
                <Button
                  type="button"
                  onClick={triggerCameraInput}
                  className="h-10 gap-2 probe-button-primary text-[var(--probe-primary-bright)] font-medium"
                >
                  <Camera className="h-4 w-4" />
                  重新拍照
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={triggerGalleryInput}
                  className="h-10 gap-2 border-[var(--probe-border-strong)] text-[var(--probe-text)] hover:bg-[var(--probe-primary)]/15 hover:border-[var(--probe-primary)]"
                >
                  <Upload className="h-4 w-4" />
                  更换照片
                </Button>
              </div>
            </div>
          )}

          <input
            ref={cameraInputRef}
            aria-label="拍照识题"
            type="file"
            accept={ACCEPTED_TYPES}
            capture="environment"
            className="hidden"
            onChange={handleImageSelect}
          />
          <input
            ref={galleryInputRef}
            aria-label="从相册选择题目照片"
            type="file"
            accept={ACCEPTED_TYPES}
            className="hidden"
            onChange={handleImageSelect}
          />
        </div>
      )}

      {activeTab === 'voice' && (
        <div className="space-y-4">
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-4 rounded-xl border-2 p-8 transition-all probe-panel',
              isRecording
                ? 'border-[var(--probe-primary)] shadow-[0_0_24px_var(--probe-glow-strong)]'
                : '',
            )}
          >
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isProcessing}
              className={cn(
                'relative flex h-20 w-20 items-center justify-center rounded-full transition-all',
                isProcessing
                  ? 'cursor-not-allowed bg-[var(--probe-surface-elevated)] text-[var(--probe-muted)] border border-[var(--probe-border)]'
                  : isRecording
                    ? 'bg-gradient-to-br from-[var(--probe-primary)] to-[#8B5CF6] text-white animate-signal-pulse shadow-[0_0_24px_var(--probe-glow-strong)]'
                    : 'bg-gradient-to-br from-[var(--probe-primary)]/25 to-[var(--probe-primary)]/10 text-[var(--probe-primary-bright)] border-2 border-[var(--probe-border-strong)] hover:from-[var(--probe-primary)]/35 hover:to-[var(--probe-primary)]/20 hover:shadow-[0_0_16px_var(--probe-glow)]',
              )}
            >
              {/* Outer pulse rings when recording */}
              {isRecording && (
                <>
                  <span className="absolute inset-0 rounded-full border-2 border-[var(--probe-primary)] animate-ping opacity-25" />
                  <span className="absolute -inset-3 rounded-full border border-[var(--probe-primary)]/30 animate-pulse" />
                  <span
                    className="absolute -inset-6 rounded-full border border-[var(--probe-primary)]/15 animate-pulse"
                    style={{ animationDelay: '0.5s' }}
                  />
                </>
              )}
              {isProcessing ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : isRecording ? (
                <span className="text-2xl font-bold">{formatTime(recordingTime)}</span>
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </button>
            <p className="text-center font-medium text-[var(--probe-text)]">
              {isProcessing
                ? '正在解码声纳信号...'
                : isRecording
                  ? '点击停止声纳捕获'
                  : '点击启动声纳捕获'}
            </p>
            <p className="text-center text-sm text-[var(--probe-muted)]">
              {isProcessing
                ? '正在将声纳信号转换为文字...'
                : isRecording
                  ? '声纳捕获中，再次点击停止并解码'
                  : '语音转文字声纳输入'}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'text' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--probe-primary-bright)]">
              题目信号内容
            </label>
            <Textarea
              placeholder="请输入题目内容，支持数学公式（如：$x^2 + 2x + 1 = 0$）..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="min-h-[120px] resize-none probe-panel border-[var(--probe-border)] text-[var(--probe-text)] placeholder:text-[var(--probe-muted)] focus-visible:ring-[var(--probe-glow)] focus-visible:border-[var(--probe-primary)] focus-visible:shadow-[0_0_12px_var(--probe-glow)]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-[var(--probe-primary-bright)]">
              你的答案（选填，用于批改校验）
            </label>
            <Textarea
              placeholder="请输入你的答案..."
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              className="min-h-[80px] resize-none probe-panel border-[var(--probe-border)] text-[var(--probe-text)] placeholder:text-[var(--probe-muted)] focus-visible:ring-[var(--probe-glow)] focus-visible:border-[var(--probe-primary)] focus-visible:shadow-[0_0_12px_var(--probe-glow)]"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || isLoading}
          className="w-full gap-2 probe-button-primary text-[var(--probe-primary-bright)] font-medium h-11"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              信号解码中...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              启动探测
            </>
          )}
        </Button>
        {onGrade && (
          <Button
            variant="outline"
            onClick={handleGrade}
            disabled={!canGrade || isLoading}
            className="w-full gap-2 border-[var(--probe-border-strong)] text-[var(--probe-text)] hover:bg-[var(--probe-primary)]/15 hover:border-[var(--probe-primary)] hover:shadow-[0_0_8px_var(--probe-glow)]"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                批改校验中...
              </>
            ) : (
              <>批改校验</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
