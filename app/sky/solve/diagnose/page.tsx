'use client';

import { useState } from 'react';

type OcrResult = {
  text: string;
  latex: string;
  problemCount?: number;
  usedModel?: string;
  error?: string;
};

type SolveResult = {
  answer?: string;
  steps?: { title: string; content: string }[];
  knowledgePoints?: string[];
  similarQuestions?: string[];
  solvingTime?: number;
  error?: string;
};

export default function DiagnosePage() {
  // --- OCR state ---
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);

  // --- Solve state ---
  const [problemText, setProblemText] = useState('');
  const [solveLoading, setSolveLoading] = useState(false);
  const [solveResult, setSolveResult] = useState<SolveResult | null>(null);

  // --- Manual solve state ---
  const [manualText, setManualText] = useState('');
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResult, setManualResult] = useState<SolveResult | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setOcrResult(null);
    setSolveResult(null);
  };

  const handleRecognize = async () => {
    if (!image) return;
    setOcrLoading(true);
    setOcrResult(null);
    try {
      const fd = new FormData();
      fd.append('image', image);
      const res = await fetch('/api/sky/solve/recognize', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'OCR failed');
      setOcrResult(data);
      setProblemText(data.text || '');
    } catch (err: any) {
      setOcrResult({ text: '', latex: '', error: err.message });
    } finally {
      setOcrLoading(false);
    }
  };

  const handleSolve = async (text: string, isManual: boolean) => {
    if (!text.trim()) return;
    const setLoading = isManual ? setManualLoading : setSolveLoading;
    const setResult = isManual ? setManualResult : setSolveResult;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/sky/solve/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ problem: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Solve failed');
      setResult(data);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setLoading(false);
    }
  };

  const verdict = (solveRes: SolveResult | null): string => {
    if (!solveRes) return '';
    if (solveRes.error) return '❌ 解题失败';
    if (solveRes.answer) return '✅ 解题成功';
    return '⚠️ 结果不完整';
  };

  return (
    <div
      style={{ maxWidth: 1200, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>🔍 识图与解题检查</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>
        上传同一道题的图片，对比 OCR 识别文字和解题结果，一眼看出问题在哪一环。
      </p>

      {/* ====== 上半部分：图片识别 ====== */}
      <section
        style={{
          border: '2px solid #e5e7eb',
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
          background: '#f9fafb',
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
          📷 第一步：图片识题（OCR）
        </h2>

        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          {/* 上传区 */}
          <div style={{ flex: '0 0 280px' }}>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ marginBottom: 12 }}
            />
            {preview && (
              <img
                src={preview}
                alt="preview"
                style={{ width: '100%', borderRadius: 8, border: '1px solid #ddd' }}
              />
            )}
            <button
              onClick={handleRecognize}
              disabled={!image || ocrLoading}
              style={{
                marginTop: 12,
                width: '100%',
                padding: '10px 0',
                fontSize: 16,
                background: ocrLoading ? '#93c5fd' : '#3b82f6',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: image ? 'pointer' : 'not-allowed',
              }}
            >
              {ocrLoading ? '识别中...' : '🔍 开始识别'}
            </button>
          </div>

          {/* 识别结果 */}
          <div style={{ flex: 1, minWidth: 300 }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>
              识别结果
              {ocrResult?.usedModel && (
                <span style={{ fontWeight: 400, color: '#888', fontSize: 13, marginLeft: 8 }}>
                  model: {ocrResult.usedModel}
                </span>
              )}
            </div>
            {ocrResult?.error && (
              <div
                style={{
                  padding: 12,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  color: '#dc2626',
                  marginBottom: 8,
                }}
              >
                {ocrResult.error}
              </div>
            )}
            <textarea
              value={ocrResult?.text ?? ''}
              onChange={(e) => {
                setOcrResult((prev) => (prev ? { ...prev, text: e.target.value } : null));
                setProblemText(e.target.value);
              }}
              placeholder="OCR 识别文字会出现在这里..."
              rows={8}
              style={{
                width: '100%',
                padding: 12,
                fontSize: 14,
                border: '1px solid #d1d5db',
                borderRadius: 8,
                resize: 'vertical',
                fontFamily: 'monospace',
              }}
            />
            {ocrResult?.text && (
              <button
                onClick={() => handleSolve(ocrResult.text!, false)}
                disabled={solveLoading}
                style={{
                  marginTop: 8,
                  padding: '8px 20px',
                  fontSize: 14,
                  background: solveLoading ? '#86efac' : '#22c55e',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                {solveLoading ? '解题中...' : '➡️ 用这段文字解题'}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ====== 下半部分：解题结果对比 ====== */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* 图片→OCR→解题 */}
        <section
          style={{
            border: '2px solid #e5e7eb',
            borderRadius: 12,
            padding: 20,
            background: '#f9fafb',
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
            🅰️ 图片 → 解题（完整链路）
          </h2>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
            {verdict(solveResult)}
            {solveResult?.solvingTime != null && <span> · {solveResult.solvingTime}ms</span>}
          </div>
          {solveResult?.error && (
            <div
              style={{
                padding: 12,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 8,
                color: '#dc2626',
                marginBottom: 8,
              }}
            >
              {solveResult.error}
            </div>
          )}
          {solveResult?.answer && (
            <>
              <div style={{ marginBottom: 8 }}>
                <strong>答案：</strong>
                <span style={{ fontSize: 18, color: '#2563eb' }}>{solveResult.answer}</span>
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>知识点：</strong>
                {(solveResult.knowledgePoints || []).map((kp: string, i: number) => (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      margin: '2px 4px',
                      padding: '2px 8px',
                      background: '#dbeafe',
                      borderRadius: 12,
                      fontSize: 12,
                      color: '#1e40af',
                    }}
                  >
                    {kp}
                  </span>
                ))}
              </div>
              {solveResult.steps && solveResult.steps.length > 0 && (
                <details>
                  <summary style={{ cursor: 'pointer', color: '#6b7280' }}>
                    解题步骤 ({solveResult.steps.length} 步)
                  </summary>
                  {solveResult.steps.map((s: { title: string; content: string }, i: number) => (
                    <div
                      key={i}
                      style={{
                        marginTop: 8,
                        padding: 8,
                        background: '#fff',
                        borderRadius: 6,
                        border: '1px solid #e5e7eb',
                      }}
                    >
                      <strong>{s.title}</strong>
                      <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: 13 }}>
                        {s.content}
                      </p>
                    </div>
                  ))}
                </details>
              )}
            </>
          )}
          {!solveResult && <p style={{ color: '#9ca3af' }}>先上传图片识别，再点"用这段文字解题"</p>}
        </section>

        {/* 手动输入→解题（对照组） */}
        <section
          style={{
            border: '2px solid #e5e7eb',
            borderRadius: 12,
            padding: 20,
            background: '#f9fafb',
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12 }}>
            🅱️ 手动输入 → 解题（对照组）
          </h2>
          <textarea
            value={manualText}
            onChange={(e) => setManualText(e.target.value)}
            placeholder="在这里手动输入题目文字（从图片手动抄，或者直接打字），测试解题能力..."
            rows={5}
            style={{
              width: '100%',
              padding: 12,
              fontSize: 14,
              border: '1px solid #d1d5db',
              borderRadius: 8,
              resize: 'vertical',
              fontFamily: 'monospace',
            }}
          />
          <button
            onClick={() => handleSolve(manualText, true)}
            disabled={!manualText.trim() || manualLoading}
            style={{
              marginTop: 8,
              padding: '8px 20px',
              fontSize: 14,
              background: manualLoading ? '#86efac' : '#22c55e',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: manualText.trim() ? 'pointer' : 'not-allowed',
            }}
          >
            {manualLoading ? '解题中...' : '✍️ 手动输入解题'}
          </button>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
              {verdict(manualResult)}
              {manualResult?.solvingTime != null && <span> · {manualResult.solvingTime}ms</span>}
            </div>
            {manualResult?.error && (
              <div
                style={{
                  padding: 12,
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 8,
                  color: '#dc2626',
                  marginBottom: 8,
                }}
              >
                {manualResult.error}
              </div>
            )}
            {manualResult?.answer && (
              <>
                <div style={{ marginBottom: 8 }}>
                  <strong>答案：</strong>
                  <span style={{ fontSize: 18, color: '#2563eb' }}>{manualResult.answer}</span>
                </div>
                <div style={{ marginBottom: 8 }}>
                  <strong>知识点：</strong>
                  {(manualResult.knowledgePoints || []).map((kp: string, i: number) => (
                    <span
                      key={i}
                      style={{
                        display: 'inline-block',
                        margin: '2px 4px',
                        padding: '2px 8px',
                        background: '#dbeafe',
                        borderRadius: 12,
                        fontSize: 12,
                        color: '#1e40af',
                      }}
                    >
                      {kp}
                    </span>
                  ))}
                </div>
                {manualResult.steps && manualResult.steps.length > 0 && (
                  <details>
                    <summary style={{ cursor: 'pointer', color: '#6b7280' }}>
                      解题步骤 ({manualResult.steps.length} 步)
                    </summary>
                    {manualResult.steps.map((s: { title: string; content: string }, i: number) => (
                      <div
                        key={i}
                        style={{
                          marginTop: 8,
                          padding: 8,
                          background: '#fff',
                          borderRadius: 6,
                          border: '1px solid #e5e7eb',
                        }}
                      >
                        <strong>{s.title}</strong>
                        <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', fontSize: 13 }}>
                          {s.content}
                        </p>
                      </div>
                    ))}
                  </details>
                )}
              </>
            )}
          </div>
        </section>
      </div>

      {/* ====== 诊断结论 ====== */}
      {solveResult && manualResult && (
        <section
          style={{
            marginTop: 24,
            padding: 20,
            borderRadius: 12,
            background: solveResult.answer === manualResult.answer ? '#f0fdf4' : '#fef2f2',
            border: `2px solid ${solveResult.answer === manualResult.answer ? '#bbf7d0' : '#fecaca'}`,
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>📊 检查结论</h2>
          {solveResult.answer === manualResult.answer ? (
            <p style={{ color: '#166534' }}>
              ✅ 图片链路和手动输入链路<strong>答案一致</strong>— 识图和解题都没问题。
            </p>
          ) : (
            <div style={{ color: '#991b1b' }}>
              <p>
                <strong>⚠️ 两条链路答案不一致，需要进一步判断：</strong>
              </p>
              <ul style={{ paddingLeft: 20, lineHeight: 2 }}>
                <li>
                  如果 <strong>B 组（手动输入）答案正确</strong>，而 A 组（图片）错误 →{' '}
                  <strong>OCR 识别有误</strong>，对比 A 组上方显示的 OCR 文字和原图
                </li>
                <li>
                  如果 <strong>B 组答案也错了</strong> → <strong>解题能力不足</strong>，跟图片无关
                </li>
                <li>
                  如果 <strong>两个都正确</strong>但答案不同 → 可能是题目表述差异导致的正常变化
                </li>
              </ul>
            </div>
          )}
        </section>
      )}

      {/* 快速提示 */}
      <details style={{ marginTop: 24, color: '#6b7280', fontSize: 13 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 500 }}>💡 检查技巧</summary>
        <ul style={{ paddingLeft: 20, lineHeight: 2, marginTop: 8 }}>
          <li>
            <strong>OCR 文字乱码？</strong>检查 API Key（ANTHROPIC_API_KEY / QWEN_API_KEY /
            GLM_API_KEY），或尝试更清晰的图片
          </li>
          <li>
            <strong>OCR 文字正确但解题错？</strong>检查 solver 的 LLM API Key，查看浏览器 Console /
            服务端日志
          </li>
          <li>
            <strong>公式识别不准？</strong>视觉模型对 LaTeX 公式的识别能力有限，这是已知瓶颈
          </li>
          <li>
            <strong>解题很慢？</strong>正常，首次解题需调 LLM；同一题第二次会命中缓存，秒出
          </li>
        </ul>
      </details>
    </div>
  );
}
