/**
 * Personalization Utilities for AI Agents
 *
 * Builds personalized prompts based on user preferences.
 */

import type { PersonalizationSliceState } from '@/lib/store/settings/personalization';

/**
 * Build a system prompt modifier based on user personalization settings.
 * This should be prepended to agent system prompts.
 */
export function buildPersonalizationPrompt(
  personalization: Partial<PersonalizationSliceState>,
): string {
  const parts: string[] = [];

  // Education level context
  if (personalization.educationLevel) {
    const levelMap: Record<string, string> = {
      primary: '小学',
      middle: '初中',
      high: '高中',
      undergraduate: '大学本科',
      graduate: '研究生',
    };
    const level = levelMap[personalization.educationLevel] || personalization.educationLevel;
    parts.push(`用户教育阶段：${level}`);
    if (personalization.grade) {
      parts.push(`年级：${personalization.grade}`);
    }
  }

  // Learning style
  if (personalization.learningStyle) {
    const styleMap: Record<string, string> = {
      visual: '视觉型学习者，偏好图表、图示和视觉化内容',
      auditory: '听觉型学习者，偏好讲解、讨论和音频内容',
      reading: '阅读型学习者，偏好文字说明和详细文档',
      kinesthetic: '实践型学习者，偏好动手操作和实际案例',
      balanced: '平衡型学习者，综合多种学习方式',
    };
    parts.push(`学习风格：${styleMap[personalization.learningStyle] || personalization.learningStyle}`);
  }

  // Detail level
  if (personalization.detailLevel) {
    const detailMap: Record<string, string> = {
      concise: '简洁回答，直击要点，避免冗余',
      standard: '标准详细程度，适当展开解释',
      detailed: '详细回答，充分展开每个概念',
      comprehensive: '全面深入，提供完整背景和扩展知识',
    };
    parts.push(`回答风格：${detailMap[personalization.detailLevel] || personalization.detailLevel}`);
  }

  // Language preference
  if (personalization.preferredLanguage === 'en') {
    parts.push('请使用英文回答');
  } else {
    parts.push('请使用中文回答');
  }

  // AI personality
  if (personalization.aiPersonality) {
    const personalityMap: Record<string, string> = {
      friendly: '友善亲切，像朋友一样交流',
      professional: '专业严谨，用词准确规范',
      encouraging: '鼓励引导，积极正面，帮助建立信心',
      strict: '严格要求，指出错误并督促改进',
      humorous: '幽默风趣，让学习过程轻松愉快',
    };
    parts.push(`交流风格：${personalityMap[personalization.aiPersonality] || personalization.aiPersonality}`);
  }

  // AI name
  if (personalization.aiName) {
    parts.push(`你的名称是"${personalization.aiName}"，请在适当的时候使用这个名字与用户互动`);
  }

  // Favorite subjects
  if (personalization.favoriteSubjects && personalization.favoriteSubjects.length > 0) {
    const enabledSubjects = personalization.favoriteSubjects
      .filter((s) => s.enabled)
      .map((s) => s.name);
    if (enabledSubjects.length > 0) {
      parts.push(`用户感兴趣的学科：${enabledSubjects.join('、')}`);
    }
  }

  // Custom instructions
  if (personalization.customInstructions) {
    parts.push(`用户特殊要求：${personalization.customInstructions}`);
  }

  // Feature preferences
  if (personalization.showStepByStep === false) {
    parts.push('用户不需要分步解答，直接给出答案即可');
  } else if (personalization.showStepByStep === true) {
    parts.push('请提供详细的分步解答过程');
  }

  if (parts.length === 0) return '';

  return `\n\n【用户个性化设置】\n${parts.map((p) => `- ${p}`).join('\n')}`;
}

/**
 * Get personalization settings from the store (client-side).
 * Returns a partial state that can be passed to buildPersonalizationPrompt.
 */
export function getPersonalizationFromStore(): Partial<PersonalizationSliceState> {
  // This is a client-side helper - will be imported in client components
  // For server-side, personalization should be passed as parameter
  return {};
}

/**
 * Build a user context string for RAG retrieval queries.
 * Helps tailor retrieval to user's education level and interests.
 */
export function buildRAGContext(
  personalization: Partial<PersonalizationSliceState>,
): string {
  const parts: string[] = [];

  if (personalization.educationLevel) {
    parts.push(`教育阶段：${personalization.educationLevel}`);
  }
  if (personalization.grade) {
    parts.push(`年级：${personalization.grade}`);
  }

  if (parts.length === 0) return '';

  return `用户背景：${parts.join('，')}`;
}
