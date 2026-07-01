'use client';

import { cn } from '@/lib/utils';
import { Camera, Upload } from 'lucide-react';

interface MobileUploadButtonProps {
  onChange: (files: FileList | null) => void;
  accept?: string;
  capture?: boolean | 'user' | 'environment';
  multiple?: boolean;
  variant?: 'camera' | 'upload' | 'default';
  label?: string;
  className?: string;
}

export function MobileUploadButton({
  onChange,
  accept = 'image/*',
  capture,
  multiple,
  variant = 'default',
  label,
  className,
}: MobileUploadButtonProps) {
  const icon =
    variant === 'camera' ? (
      <Camera className="size-5" />
    ) : variant === 'upload' ? (
      <Upload className="size-5" />
    ) : (
      <Upload className="size-5" />
    );

  return (
    <label
      className={cn(
        'flex min-h-[6rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-slate-600 transition-colors hover:border-sky-400 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-sky-600 dark:hover:bg-sky-950/30',
        className,
      )}
    >
      {icon}
      {label && <span className="text-sm font-medium">{label}</span>}
      <input
        type="file"
        accept={accept}
        capture={capture}
        multiple={multiple}
        onChange={(e) => onChange(e.target.files)}
        className="sr-only"
      />
    </label>
  );
}
