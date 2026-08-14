import { ScanLine, Search, Bot, FileText, LayoutPanelLeft, Clapperboard } from 'lucide-react';
import { useSettingsStore } from '@/lib/store/settings';
import type {
  SceneOutline,
  UserRequirements,
  PdfImage,
  ImageMapping,
} from '@/lib/types/generation';

// Session state stored in sessionStorage
export interface GenerationSessionState {
  sessionId: string;
  requirements: UserRequirements;
  pdfText: string;
  pdfImages?: PdfImage[];
  imageStorageIds?: string[];
  imageMapping?: ImageMapping;
  sceneOutlines?: SceneOutline[] | null;
  currentStep: 'generating' | 'complete';
  previewPhase?: 'preparing' | 'outline-ready' | 'review' | 'generating-content';
  // PDF deferred parsing fields
  pdfStorageKey?: string;
  pdfFileName?: string;
  pdfProviderId?: string;
  pdfProviderConfig?: { apiKey?: string; baseUrl?: string };
  // Web search context
  researchContext?: string;
  researchSources?: Array<{ title: string; url: string }>;
  // Language directive inferred from outline generation
  languageDirective?: string;
  // Selected agents from homepage
  agentIds?: string[];
}

export type GenerationStep = {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  type: 'analysis' | 'writing' | 'visual';
};

export const ALL_STEPS: GenerationStep[] = [
  {
    id: 'pdf-analysis',
    title: '正在分析文档',
    description: '解析 PDF 文档内容和图片...',
    icon: ScanLine,
    type: 'analysis',
  },
  {
    id: 'web-search',
    title: '正在搜索资料',
    description: '搜索相关背景资料...',
    icon: Search,
    type: 'analysis',
  },
  {
    id: 'outline',
    title: '正在生成大纲',
    description: '分析知识体系，构建场景大纲...',
    icon: FileText,
    type: 'writing',
  },
  {
    id: 'agent-generation',
    title: '正在生成角色',
    description: '为课堂生成AI角色...',
    icon: Bot,
    type: 'writing',
  },
  {
    id: 'slide-content',
    title: '正在生成内容',
    description: '为每个场景生成教学内容...',
    icon: LayoutPanelLeft,
    type: 'visual',
  },
  {
    id: 'actions',
    title: '正在生成交互',
    description: '为场景添加交互动作...',
    icon: Clapperboard,
    type: 'visual',
  },
];

export const getActiveSteps = (session: GenerationSessionState | null) => {
  return ALL_STEPS.filter((step) => {
    if (step.id === 'pdf-analysis') return !!session?.pdfStorageKey;
    if (step.id === 'web-search') return !!session?.requirements?.webSearch;
    if (step.id === 'agent-generation') return useSettingsStore.getState().agentMode === 'auto';
    return true;
  });
};
