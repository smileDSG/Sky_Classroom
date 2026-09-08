'use client';

import { useEffect, useState, useMemo } from 'react';
import { X, ArrowRight } from 'lucide-react';

interface QAIssue {
  pageNum: number;
  severity: string;
  type: string;
  detail: string;
}

interface QAReport {
  totalScore: number;
  pass: boolean;
  issues: QAIssue[];
}

interface QaReportModalProps {
  report: QAReport;
  onClose: () => void;
  onNavigate: (pageNum: number) => void;
}

const T = {
  ink: '#1a1a1a',
  inkLight: '#525252',
  inkMuted: '#a3a3a3',
  line: '#e5e5e5',
  lineLight: '#f5f5f5',
  surface: '#ffffff',
  backdrop: 'rgba(255,255,255,0.93)',
  pass: '#166534',
  passBg: '#f0fdf4',
  warn: '#a16207',
  warnBg: '#fefce8',
  fail: '#991b1b',
  failBg: '#fef2f2',
} as const;

function statusTone(score: number, pass: boolean) {
  if (pass) return { color: T.pass, bg: T.passBg, label: '通过' };
  if (score >= 60) return { color: T.warn, bg: T.warnBg, label: '待优化' };
  return { color: T.fail, bg: T.failBg, label: '需整改' };
}

function severityTone(sev: string) {
  if (sev === 'high') return { color: T.fail, label: '严重' };
  if (sev === 'medium') return { color: T.warn, label: '一般' };
  return { color: T.inkMuted, label: '建议' };
}

function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      setN(Math.round((1 - Math.pow(1 - t, 3)) * value));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span className="tabular-nums">{n}</span>;
}

export function QaReportModalLight({ report, onClose, onNavigate }: QaReportModalProps) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  const tone = useMemo(() => statusTone(report.totalScore, report.pass), [report]);

  const high = report.issues.filter((i) => i.severity === 'high').length;
  const medium = report.issues.filter((i) => i.severity === 'medium').length;
  const low = report.issues.filter((i) => i.severity === 'low').length;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3">
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: T.backdrop,
          backdropFilter: 'blur(16px)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 300ms ease',
        }}
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full max-w-[340px]"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 350ms ease, transform 450ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            backgroundColor: T.surface,
            border: `1px solid ${T.line}`,
            boxShadow: '0 16px 48px -8px rgba(0,0,0,0.1)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-0">
            <span className="text-[10px] font-medium" style={{ color: T.inkMuted }}>
              质检报告
            </span>
            <button
              onClick={onClose}
              className="flex h-5 w-5 items-center justify-center"
              style={{ color: T.inkMuted }}
              onMouseEnter={(e) => (e.currentTarget.style.color = T.ink)}
              onMouseLeave={(e) => (e.currentTarget.style.color = T.inkMuted)}
            >
              <X className="h-3 w-3" strokeWidth={1.5} />
            </button>
          </div>

          {/* Score */}
          <div className="px-4 pt-3 pb-4 flex items-center gap-4">
            <div>
              <span
                className="text-[40px] font-light leading-none tracking-tight block"
                style={{
                  color: T.ink,
                  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
                }}
              >
                <CountUp value={report.totalScore} />
              </span>
              <span
                className="text-[9px] font-medium tracking-wider mt-1 block"
                style={{ color: T.inkMuted }}
              >
                总分
              </span>
            </div>

            <div className="h-8 w-px" style={{ backgroundColor: T.line }} />

            <div className="flex flex-col gap-1.5">
              <span
                className="inline-flex self-start border px-1.5 py-[1px] text-[9px] font-semibold tracking-wide"
                style={{
                  color: tone.color,
                  borderColor: tone.color + '50',
                  backgroundColor: tone.bg,
                }}
              >
                {tone.label}
              </span>
              {report.issues.length > 0 ? (
                <span className="text-[9px]" style={{ color: T.inkLight }}>
                  {high > 0 && `${high}严重 `}
                  {medium > 0 && `${medium}一般 `}
                  {low > 0 && `${low}建议`}
                </span>
              ) : (
                <span className="text-[9px]" style={{ color: T.inkMuted }}>
                  无问题
                </span>
              )}
            </div>
          </div>

          {/* Issues */}
          {report.issues.length > 0 && (
            <>
              <div className="px-4 py-1" style={{ backgroundColor: T.lineLight }}>
                <span className="text-[9px] font-medium" style={{ color: T.inkMuted }}>
                  问题（{report.issues.length}）
                </span>
              </div>

              <div className="max-h-[180px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                {report.issues.map((issue, idx) => {
                  const st = severityTone(issue.severity);
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        onNavigate(issue.pageNum);
                        onClose();
                      }}
                      className="group flex w-full items-start gap-2.5 px-4 py-2.5 text-left"
                      style={{
                        borderBottom:
                          idx < report.issues.length - 1 ? `1px solid ${T.lineLight}` : 'none',
                        backgroundColor: T.surface,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#fafafa')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = T.surface)}
                    >
                      <div className="flex flex-col items-center pt-0.5 flex-shrink-0 w-4">
                        <span
                          className="text-[9px] font-semibold tabular-nums leading-none"
                          style={{ color: T.ink }}
                        >
                          {issue.pageNum}
                        </span>
                        <span className="text-[7px]" style={{ color: T.inkMuted }}>
                          页
                        </span>
                      </div>

                      <div
                        className="mt-0.5 h-4 w-[1.5px] flex-shrink-0"
                        style={{ backgroundColor: st.color }}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-semibold" style={{ color: st.color }}>
                            {st.label}
                          </span>
                          <span className="text-[8px]" style={{ color: T.inkMuted }}>
                            {issue.type}
                          </span>
                        </div>
                        <p
                          className="mt-0.5 text-[10px] leading-[1.5]"
                          style={{ color: T.inkLight }}
                        >
                          {issue.detail}
                        </p>
                      </div>

                      <div className="pt-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight
                          className="h-3 w-3"
                          strokeWidth={1.5}
                          style={{ color: T.inkMuted }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {report.issues.length === 0 && (
            <div className="px-4 py-5 text-center">
              <div
                className="mx-auto mb-2 flex h-6 w-6 items-center justify-center"
                style={{ border: `1px solid ${T.line}` }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={tone.color}
                  strokeWidth="1.5"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <p className="text-[11px] font-medium" style={{ color: T.ink }}>
                全部通过
              </p>
              <p className="mt-0.5 text-[9px]" style={{ color: T.inkMuted }}>
                课件质量达到发布标准
              </p>
            </div>
          )}

          {/* Footer */}
          <div
            className="flex items-center justify-between px-4 py-2"
            style={{ borderTop: `1px solid ${T.lineLight}`, backgroundColor: '#fafafa' }}
          >
            <span className="text-[8px] tracking-wide" style={{ color: T.inkMuted }}>
              AI 检测
            </span>
            <span className="text-[8px] tracking-wide" style={{ color: T.inkMuted }}>
              点击跳转
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
