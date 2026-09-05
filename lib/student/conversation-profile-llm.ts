import { z } from 'zod';

import { callLLM } from '@/lib/ai/llm';
import { parseJsonResponseWithSchema } from '@/lib/generation/json-repair';
import type { ResolvedModel } from '@/lib/server/resolve-model';
import type {
  ConversationProfileExtractionResult,
  ConversationProfileStage,
  ConversationalProfilePatch,
} from '@/lib/student/conversation-profile';

export const PROFILE_EXTRACTION_SOURCE = 'student-profile-conversation';
export const PROFILE_EXTRACTION_TIMEOUT_MS = 25_000;

const stringDimensionSchema = z.object({
  value: z.string().min(1),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).default([]),
});

const stringListDimensionSchema = z.object({
  value: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).default([]),
});

const knowledgeBaseSchema = z.object({
  strongPoints: z.array(z.string()).default([]),
  weakPoints: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  evidence: z.array(z.string()).default([]),
});

const llmExtractionSchema = z.object({
  majorBackground: stringDimensionSchema.optional(),
  learningGoal: stringDimensionSchema.optional(),
  knowledgeBase: knowledgeBaseSchema.optional(),
  cognitiveStyle: stringDimensionSchema.optional(),
  errorPatternPreference: stringListDimensionSchema.optional(),
  resourcePreference: stringListDimensionSchema.optional(),
  interactionPreference: stringDimensionSchema.optional(),
  learningPace: stringDimensionSchema.optional(),
  currentLearningState: stringDimensionSchema.optional(),
  nextQuestion: z.string().min(1),
  needsConfirmation: z.boolean(),
});

const SYSTEM_PROMPT = `你是学习画像抽取器。从学生的一条消息中抽取画像信息，stage 表示对话阶段（onboarding 破冰 / learning 学习中 / review 复习）。
只输出一个 JSON 对象，不要输出任何其他内容。字段：
- majorBackground: { value, confidence, evidence } 专业/年级/课程背景
- learningGoal: { value, confidence, evidence } 学习目标
- knowledgeBase: { strongPoints, weakPoints, confidence, evidence } 已会与薄弱知识点列表
- cognitiveStyle: { value, confidence, evidence } 认知风格（如具象化理解、抽象推理）
- errorPatternPreference: { value: string[], confidence, evidence } 易错模式
- resourcePreference: { value: string[], confidence, evidence } 资源偏好，取值仅限：例题拆解、代码案例、图解、练习题、视频、文字总结
- interactionPreference: { value, confidence, evidence } 讲解偏好（如步骤优先、原理优先、先例题后总结）
- learningPace: { value, confidence, evidence } 学习节奏与时间压力
- currentLearningState: { value, confidence, evidence } 当前状态（焦虑、赶进度、刚入门等）
- nextQuestion: string，根据已抽取内容提出的下一个追问，中文一句话
- needsConfirmation: boolean，当目标、薄弱点、偏好已基本齐全时为 true，用于触发画像确认
规则：confidence 取 0-1；evidence 填学生原话片段；消息里没提到的维度一律省略，不要编造。`;

export async function extractConversationProfileWithLLM(input: {
  message: string;
  stage: ConversationProfileStage;
  model: ResolvedModel;
}): Promise<ConversationProfileExtractionResult> {
  const result = await callLLM(
    {
      model: input.model.model,
      system: SYSTEM_PROMPT,
      prompt: `学生消息（stage=${input.stage}）：\n${input.message}`,
      temperature: 0.2,
      maxOutputTokens: 800,
    },
    PROFILE_EXTRACTION_SOURCE,
    { retries: 1, timeoutMs: PROFILE_EXTRACTION_TIMEOUT_MS },
    input.model.thinkingConfig,
  );

  const parsed = parseJsonResponseWithSchema(result.text, llmExtractionSchema);
  if (!parsed) {
    throw new Error('LLM profile extraction returned invalid JSON');
  }

  const profilePatch: ConversationalProfilePatch = {
    majorBackground: parsed.majorBackground,
    learningGoal: parsed.learningGoal,
    knowledgeBase: parsed.knowledgeBase,
    cognitiveStyle: parsed.cognitiveStyle,
    errorPatternPreference: parsed.errorPatternPreference,
    resourcePreference: parsed.resourcePreference,
    interactionPreference: parsed.interactionPreference,
    learningPace: parsed.learningPace,
    currentLearningState: parsed.currentLearningState,
  };
  for (const key of Object.keys(profilePatch) as (keyof ConversationalProfilePatch)[]) {
    if (!profilePatch[key]) delete profilePatch[key];
  }

  const evidence = Array.from(
    new Set(
      Object.values(profilePatch).flatMap((dimension) =>
        dimension && 'evidence' in dimension ? dimension.evidence : [],
      ),
    ),
  );

  return {
    stage: input.stage,
    profilePatch,
    evidence,
    nextQuestion: parsed.nextQuestion,
    needsConfirmation: parsed.needsConfirmation,
  };
}
