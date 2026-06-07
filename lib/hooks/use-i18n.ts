/**
 * Minimal i18n hook — stub for remaining t() calls in stage/roundtable.
 *
 * The project migrated away from full i18n, but a few components still
 * reference `useI18n`. This file provides a simple key→Chinese lookup
 * so those calls don't crash.
 */

'use client';

const TRANSLATIONS: Record<string, string> = {
  // roundtable
  'roundtable.teacher': '老师',
  'roundtable.you': '你',
  'roundtable.noSpeechDetected': '未检测到语音',
  'roundtable.discussionEnded': '讨论已结束',
  'roundtable.qaEnded': '问答已结束',
  'roundtable.inputPlaceholder': '输入你的问题…',
  'roundtable.processing': '处理中…',
  'roundtable.listening': '聆听中…',
  'roundtable.stopRecording': '停止录音',
  'roundtable.startRecording': '开始录音',
  'roundtable.yourTurn': '轮到你了',
  'roundtable.askTeacher': '向老师提问',
  'roundtable.ask': '提问',
  'roundtable.voiceInput': '语音输入',
  'roundtable.voiceInputDisabled': '语音输入未启用',
  'roundtable.inputPlaceholder': '输入你的问题…',

  // stage
  'stage.courseComplete': '课程完成',
  'stage.speakingToTeacher': '正在与老师对话',
  'stage.quickQuestions': '快速提问',
  'stage.confirmSwitchTitle': '确认切换场景',
  'stage.confirmSwitchMessage': '当前讨论正在进行中，切换场景将结束讨论。确定要切换吗？',

  // common
  'common.send': '发送',
  'common.cancel': '取消',
  'common.confirm': '确认',

  // settings
  'settings.agentRoles.student': '学生',
};

function t(key: string): string {
  return TRANSLATIONS[key] ?? key;
}

export function useI18n() {
  return { t };
}
