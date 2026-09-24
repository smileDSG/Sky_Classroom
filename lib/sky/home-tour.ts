import type { TourStep } from '@/lib/sky/tour';

export const HOME_TOUR_SEEN_KEY = 'homeTourSeen';

export const HOME_TOUR_STEPS: TourStep[] = [
  {
    id: 'hero-input',
    title: '输入想学的知识',
    description:
      '在这里输入一个知识点或课程主题，例如「从零学 Python」。点一下即可开始打字，也可以直接拖拽 PDF 进来。',
  },
  {
    id: 'home-pdf-upload',
    title: '上传资料（可选）',
    description: '点「上传 PDF」把课本或讲义喂给 AI，它会结合你的资料讲解，边讲边引用原文。',
  },
  {
    id: 'home-websearch',
    title: '联网搜索（可选）',
    description:
      '想让 AI 在网上查最新资料来补充讲解，就打开「联网搜索」，找到的内容会一并讲给你听。',
  },
  {
    id: 'home-interactive',
    title: '互动模式（可选）',
    description: '开启「互动模式」后，讲解会更像上课：AI 老师会停顿提问、等你答完再继续。',
  },
  {
    id: 'home-submit',
    title: '开始讲解',
    description:
      '填好后点「开始讲解」（或按 Cmd/Ctrl + Enter），AI 老师和同学会为你生成一堂互动课。',
  },
  {
    id: 'workspace-portals',
    title: '按身份进入对应工作区',
    description:
      '学习、资源、备课三个入口，按你的角色选择：学生进「学习」，做题刷题进「资源」，老师进「备课」。',
  },
];
