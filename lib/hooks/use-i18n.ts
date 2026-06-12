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

  // classroomComplete
  'classroomComplete.title': '课程完成',
  'classroomComplete.trailLabels.slide': '页',
  'classroomComplete.trailLabels.quiz': '小测',
  'classroomComplete.trailLabels.interactive': '互动',
  'classroomComplete.trailLabels.pbl': '项目',
  'classroomComplete.quizScoreLabel': '答对 {{correct}} / {{total}}',
  'classroomComplete.encouragement.high': '太棒了，完美发挥！',
  'classroomComplete.encouragement.mid': '表现不错，继续加油！',
  'classroomComplete.encouragement.low': '万事开头难，回去再练练吧。',

  // toolbar
  'toolbar.default': '默认',
  'toolbar.on': '开启',
  'toolbar.off': '关闭',
  'toolbar.auto': '自动',
  'toolbar.dynamic': '动态',

  // export
  'export.exportFailed': '导出失败',
  'export.exportSuccess': '导出成功',

  // settings
  'settings.mediaGenerationDisabled': '已在设置中关闭生成',
  'settings.mediaContentSensitive': '抱歉，该内容触发了安全检查',
  'settings.mediaRetry': '重试',
  'settings.ttsTestTextDefault': '你好，这是一段测试语音。',
};

function t(key: string): string {
  return TRANSLATIONS[key] ?? key;
}

export function useI18n() {
  return { t, locale: 'zh-CN' };
}
