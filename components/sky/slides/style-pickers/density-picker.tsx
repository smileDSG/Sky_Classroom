'use client';

import type { Density } from '@/lib/slides/hooks/use-cover-draft';

interface DensityPickerProps {
  selectedDensity: Density;
  onSelect: (density: Density) => void;
}

const DENSITY_META: { value: Density; label: string; desc: string; bars: number[] }[] = [
  { value: 'sparse', label: '简约', desc: '大量留白，极简克制', bars: [25, 40, 20] },
  { value: 'moderate', label: '标准', desc: '均衡布局，适度装饰', bars: [45, 65, 50, 70, 40] },
  { value: 'rich', label: '丰富', desc: '元素充实，视觉饱满', bars: [60, 80, 55, 90, 70, 85, 45] },
];

export function DensityPicker({ selectedDensity, onSelect }: DensityPickerProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">装饰密度</span>
      <div className="flex gap-2">
        {DENSITY_META.map(({ value, label, desc, bars }) => {
          const isSelected = selectedDensity === value;
          return (
            <button
              key={value}
              onClick={() => onSelect(value)}
              className={`group relative flex flex-col items-center gap-1.5 rounded-xl px-3 py-2.5 flex-1 transition-all duration-200 ${
                isSelected
                  ? 'bg-sky-50/80 dark:bg-sky-900/20'
                  : 'hover:bg-slate-50 dark:hover:bg-gray-800'
              }`}
              title={desc}
            >
              {/* Animated bar chart */}
              <div className="flex gap-[3px] items-end h-5">
                {bars.map((h, i) => (
                  <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-500 ${
                      isSelected
                        ? 'bg-sky-400 dark:bg-sky-500'
                        : 'bg-slate-300 dark:bg-gray-600 group-hover:bg-slate-400 dark:group-hover:bg-gray-500'
                    }`}
                    style={{
                      height: `${h}%`,
                      transitionDelay: `${i * 40}ms`,
                      opacity: isSelected ? 1 : 0.7,
                    }}
                  />
                ))}
              </div>
              <span className={`text-[9px] font-semibold ${
                isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-slate-500 dark:text-gray-500'
              }`}>
                {label}
              </span>
              {isSelected && (
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-sky-400" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
