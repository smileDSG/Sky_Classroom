import { NextRequest, NextResponse } from 'next/server';
import { readTeachingJob, updateTeachingJob } from '@/lib/server/teaching-job-store';
import { callLLM } from '@/lib/ai/llm';
import { getModel } from '@/lib/ai/providers';
import { resolveSolverModel } from '@/lib/solve/solver-constants';
import { createLogger } from '@/lib/logger';
import { requireQuota, recordUsage } from '@/lib/server/billing/require-quota';
import type { ContentChunk } from '@/lib/teaching/content-types';

const log = createLogger('TeachingChatAPI');

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatRequest {
  message: string;
  sectionId?: string;
  history?: ChatMessage[];
}

/**
 * POST /api/sky/teaching/[jobId]/chat
 *
 * Multi-turn conversational teaching: student can ask questions about the lesson content.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  try {
    const { jobId } = await params;

    const quota = await requireQuota('llmCalls');
    if ('error' in quota) return quota.error;
    const userId = quota.userId;

    // Get job data
    const job = await readTeachingJob(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }
    if (job.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!job.plan || !job.sections) {
      return NextResponse.json({ error: 'Job not completed yet' }, { status: 400 });
    }

    const body: ChatRequest = await request.json();
    const { message, sectionId, history = [] } = body;

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // Find the specific section if sectionId provided
    let sectionContext = '';
    if (sectionId) {
      const sectionData = job.sections.find((s) => s.section.id === sectionId);
      if (sectionData) {
        const chunksText = sectionData.chunks.map((c) => c.content).join('\n\n');
        sectionContext = `
## 当前章节内容
标题：${sectionData.section.title}
知识点：${sectionData.section.knowledgePoints.join('、')}

${chunksText}
`;
      }
    }

    // Build lesson context
    const lessonContext = `
## 教案信息
标题：${job.plan.title}
主题：${job.topic}

## 章节结构
${job.plan.sections.map((s, i) => `${i + 1}. ${s.title} (${s.contentType})`).join('\n')}
`;

    // Build conversation history
    const conversationHistory = history.map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    }));

    // Build prompt
    const systemPrompt = `你是一位专业的AI教师助手，正在为学生提供个性化的教学辅导。

你的职责：
1. 解答学生关于教学内容的疑问
2. 用简单易懂的语言解释复杂概念
3. 提供具体的例子和类比来帮助理解
4. 鼓励学生思考，引导他们自己发现答案
5. 如果学生问的问题超出了当前教学范围，礼貌地引导他们回到当前主题

回答要求：
- 使用中文回答
- 保持友好、耐心的语气
- 如果涉及数学公式，使用 LaTeX 格式：行内公式用 $...$，独立公式用 $$...$$
- 回答要简洁明了，避免冗长
`;

    const userPrompt = `${lessonContext}
${sectionContext}

## 对话历史
${conversationHistory.map((msg) => `${msg.role === 'user' ? '学生' : 'AI教师'}：${msg.content}`).join('\n')}

## 学生问题
${message}

请回答学生的问题。如果问题与当前教学内容相关，请结合教学内容进行解答。如果问题不太清楚，请先澄清学生的问题。`;

    // Call LLM
    const modelConfig = resolveSolverModel('universal');
    const { model } = getModel(modelConfig);

    const result = await callLLM(
      {
        model,
        messages: [{ role: 'user', content: userPrompt }] as any,
        temperature: 0.7,
        maxOutputTokens: 2048,
      },
      'teaching-chat',
      { retries: 1 },
      undefined,
      systemPrompt,
    );

    const reply = result.text || '抱歉，我无法回答这个问题。请尝试重新表述你的问题。';
    await recordUsage(quota.userId, quota.planType, 'llmCalls');

    // Append follow-up chunk to the section if sectionId is provided
    if (sectionId) {
      try {
        const sectionData = job.sections?.find((s) => s.section.id === sectionId);
        if (sectionData && job.sections) {
          const maxOrder = sectionData.chunks.reduce((max, c) => Math.max(max, c.order), 0);
          const followUpChunk: ContentChunk = {
            sectionId,
            type: 'text',
            content: reply,
            order: maxOrder + 1,
            isFollowUp: true,
          };
          sectionData.chunks.push(followUpChunk);
          await updateTeachingJob(jobId, { sections: job.sections });
        }
      } catch (appendErr) {
        log.warn('Failed to append follow-up chunk:', appendErr);
        // Non-critical: reply is still returned to client
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        reply,
        sectionId,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error('Teaching chat failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
