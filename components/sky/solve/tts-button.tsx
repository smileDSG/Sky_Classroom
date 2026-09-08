'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface TTSButtonProps {
  text: string;
  className?: string;
}

export function TTSButton({ text, className }: TTSButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  const handlePlay = async () => {
    if (isPlaying) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsPlaying(false);
      }
      return;
    }

    if (isLoading) return;

    setIsLoading(true);

    try {
      // Clean text for TTS (remove LaTeX and markdown)
      const cleanText = text
        .replace(/\$\$[\s\S]*?\$\$/g, '公式') // Replace display math
        .replace(/\$[^$]*?\$/g, '公式') // Replace inline math
        .replace(/#{1,6}\s/g, '') // Remove headers
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
        .replace(/\*([^*]+)\*/g, '$1') // Remove italic
        .replace(/`([^`]+)`/g, '$1') // Remove code
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
        .replace(/\n+/g, '。') // Replace newlines with periods
        .trim();

      if (!cleanText) {
        toast.error('没有可朗读的内容');
        setIsLoading(false);
        return;
      }

      // Call TTS API
      const response = await fetch('/api/audio/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: cleanText }),
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || '语音合成失败');
      }

      const data = await response.json();

      if (!data.audio) {
        throw new Error('没有返回音频数据');
      }

      // Create audio from base64
      const audioBlob = base64ToBlob(data.audio, data.format || 'mp3');
      const audioUrl = URL.createObjectURL(audioBlob);

      // Cleanup previous audio
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
      }
      audioUrlRef.current = audioUrl;

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => {
        setIsPlaying(false);
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
      };
      audio.onerror = () => {
        setIsPlaying(false);
        toast.error('音频播放失败');
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
          audioUrlRef.current = null;
        }
      };

      await audio.play();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '语音合成失败';
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handlePlay}
      disabled={isLoading}
      className={cn('h-7 w-7 p-0', isPlaying && 'text-sky-500', className)}
      title={isPlaying ? '停止朗读' : '朗读内容'}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isPlaying ? (
        <VolumeX className="h-3.5 w-3.5" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

function base64ToBlob(base64: string, format: string): Blob {
  const mimeType = format === 'mp3' ? 'audio/mpeg' : `audio/${format}`;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
