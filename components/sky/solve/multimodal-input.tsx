'use client';

import { useState, useRef, useCallback } from 'react';
import { Camera, Mic, Type, Upload, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

interface MultimodalInputProps {
  onSubmit: (input: { type: 'image' | 'voice' | 'text'; content: string | File }) => void;
  onGrade?: (input: { problem: string; userAnswer: string }) => void;
  isLoading?: boolean;
  className?: string;
}

export function MultimodalInput({ onSubmit, onGrade, isLoading, className }: MultimodalInputProps) {
  const [activeTab, setActiveTab] = useState<'camera' | 'voice' | 'text'>('camera');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [userAnswer, setUserAnswer] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setSelectedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const clearImage = useCallback(() => {
    setSelectedImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const startRecording = useCallback(() => {
    setIsRecording(true);
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    const mockTranscription = '请计算：3x + 5 = 20，求 x 的值';
    setTextInput(mockTranscription);
    setActiveTab('text');
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleSubmit = useCallback(() => {
    if (activeTab === 'camera' && selectedImage) {
      fetch(selectedImage)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], 'problem.jpg', { type: 'image/jpeg' });
          onSubmit({ type: 'image', content: file });
        });
    } else if (activeTab === 'text' && textInput.trim()) {
      onSubmit({ type: 'text', content: textInput.trim() });
    }
  }, [activeTab, selectedImage, textInput, onSubmit]);

  const handleGrade = useCallback(() => {
    if (textInput.trim() && userAnswer.trim() && onGrade) {
      onGrade({ problem: textInput.trim(), userAnswer: userAnswer.trim() });
    }
  }, [textInput, userAnswer, onGrade]);

  const canSubmit =
    (activeTab === 'camera' && selectedImage) ||
    (activeTab === 'text' && textInput.trim());

  const canGrade = textInput.trim() && userAnswer.trim();

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="camera" className="gap-2">
            <Camera className="h-4 w-4" />
            <span className="hidden sm:inline">拍照</span>
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-2">
            <Mic className="h-4 w-4" />
            <span className="hidden sm:inline">语音</span>
          </TabsTrigger>
          <TabsTrigger value="text" className="gap-2">
            <Type className="h-4 w-4" />
            <span className="hidden sm:inline">文字</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === 'camera' && (
        <div className="space-y-4">
          {!selectedImage ? (
            <div
              onClick={triggerFileInput}
              className="cursor-pointer rounded-xl border-2 border-dashed border-[#4A90D9]/30 bg-[#4A90D9]/5 p-8 transition-colors hover:border-[#4A90D9]/50 hover:bg-[#4A90D9]/10"
            >
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#4A90D9]/10">
                  <Camera className="h-8 w-8 text-[#4A90D9]" />
                </div>
                <div>
                  <p className="font-medium text-foreground">点击拍照或上传图片</p>
                  <p className="text-sm text-muted-foreground">支持 JPG、PNG 格式</p>
                </div>
                <Button variant="outline" size="sm" className="mt-2 gap-2">
                  <Upload className="h-4 w-4" />
                  选择文件
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleImageSelect}
              />
            </div>
          ) : (
            <div className="relative overflow-hidden rounded-xl border border-border">
              <img src={selectedImage} alt="Selected problem" className="w-full object-contain" />
              <button
                onClick={clearImage}
                className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white transition-opacity hover:bg-black/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'voice' && (
        <div className="space-y-4">
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-4 rounded-xl border-2 p-8 transition-all',
              isRecording
                ? 'border-red-400 bg-red-50 dark:border-red-900 dark:bg-red-900/20'
                : 'border-[#4A90D9]/30 bg-[#4A90D9]/5'
            )}
          >
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={cn(
                'flex h-20 w-20 items-center justify-center rounded-full transition-all',
                isRecording
                  ? 'animate-pulse bg-red-500 text-white'
                  : 'bg-[#4A90D9] text-white hover:bg-[#4A90D9]/90'
              )}
            >
              {isRecording ? (
                <span className="text-2xl font-bold">{formatTime(recordingTime)}</span>
              ) : (
                <Mic className="h-8 w-8" />
              )}
            </button>
            <p className="text-center font-medium text-foreground">
              {isRecording ? '点击停止录音' : '点击开始录音'}
            </p>
            <p className="text-center text-sm text-muted-foreground">
              {isRecording ? '正在识别语音内容...' : '支持数学题目语音输入'}
            </p>
          </div>
        </div>
      )}

      {activeTab === 'text' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">题目内容</label>
            <Textarea
              placeholder="请输入题目内容，支持数学公式（如：$x^2 + 2x + 1 = 0$）..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="min-h-[120px] resize-none"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">你的答案（选填，用于批改）</label>
            <Textarea
              placeholder="请输入你的答案..."
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit || isLoading}
          className="w-full gap-2 bg-[#4A90D9] hover:bg-[#4A90D9]/90"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              正在识别...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              搜题讲解
            </>
          )}
        </Button>
        {onGrade && (
          <Button
            variant="outline"
            onClick={handleGrade}
            disabled={!canGrade || isLoading}
            className="w-full gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                正在批改...
              </>
            ) : (
              <>批改答案</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
