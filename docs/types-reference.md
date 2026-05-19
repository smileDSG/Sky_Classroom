# 天空课堂类型参考文档

## 1. 解题模块 (`lib/solve/types.ts`)

### SolverAgentType

```ts
type SolverAgentType = 'universal' | 'science' | 'humanities';
```

### SolveState

```ts
interface SolveState {
  problemText: string;
  problemImage: string | null;
  userAnswer: string | null;
  agentId: SolverAgentType;
  selectedAgentId: string | null;
  agentRoute: SolverAgentType | null;
  solution: string | null;
  gradeResult: GradeResult | null;
  votingResults: VotingResult[];
  fourPartOutput: FourPartOutput | null;
  fromQuestionBank: boolean;
  error: string | null;
}
```

### GradeResult

```ts
interface GradeResult {
  isCorrect: boolean;
  score: number;           // 0-1
  cause: MistakeCause;
  causeLabel: string;      // "计算错误" 等
  explanation: string;
  partialCredit: { step: number; score: number; comment: string }[];
}
```

### MistakeCause

```ts
type MistakeCause =
  | 'concept-unclear'    // 概念不清
  | 'calculation-error'  // 计算错误
  | 'misreading'         // 看错题
  | 'method-wrong'       // 方法错误
  | 'careless'           // 粗心
  | 'format-error';      // 格式错误
```

### FourPartOutput

```ts
interface FourPartOutput {
  answer: string;
  steps: { label: string; content: string; keyPoints: string[] }[];
  knowledgePoints: { name: string; description: string; difficulty: string }[];
  similarQuestions: { problem: string; difficulty: number; knowledgePoint: string }[];
}
```

### GradedFourPartOutput

```ts
interface GradedFourPartOutput extends FourPartOutput {
  gradeResult: GradeResult;
  mistakeAnalysis: {
    cause: string;
    causeLabel: string;
    explanation: string;
  };
  recommendedPractice: string;
}
```

### QuestionBankEntry

```ts
interface QuestionBankEntry {
  id: string;
  problemHash: string;
  problemText: string;
  answer: string;
  steps: string[];
  knowledgePoints: string[];
  agentId: SolverAgentType;
  solvedAt: number;
  verified: boolean;
  _similarity?: number;
}
```

## 2. 幻灯片模块 (`lib/slides/types.ts`)

### AvatarConfig

```ts
interface AvatarConfig {
  id: string;
  name: string;
  description: string;
  style: 'serious' | 'gentle' | 'humorous';
  speechRate: number;       // 语速 (0.5-2.0)
  voice: string;            // TTS voice ID
}
```

### AvatarSpeech

```ts
interface AvatarSpeech {
  avatarId: string;
  avatarName: string;
  scripts: {
    slideId: string;
    text: string;
    audioUrl: string;
    highlights: string[];
  }[];
  totalDuration: number;
}
```

### SlideGenerationOptions

```ts
interface SlideGenerationOptions {
  topic: string;
  difficulty?: 'junior' | 'senior' | 'college';
  slideCount?: number;
}
```

### SlideGenerationResult

```ts
interface SlideGenerationResult {
  slides: Slide[];
}
```

## 3. 错题本模块 (`lib/mistakes/types.ts`)

### MistakeRecord

```ts
interface MistakeRecord {
  id: string;
  problem: string;
  userAnswer: string;
  correctAnswer: string;
  cause: MistakeCause;
  solvedAt: Date;
  reviewed: boolean;
  reviewCount: number;
  knowledgePoints: string[];
}
```

### MistakeFilter

```ts
interface MistakeFilter {
  cause?: MistakeCause;
  knowledgePoint?: string;
  reviewed?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}
```

### KnowledgeNode

```ts
interface KnowledgeNode {
  id: string;
  name: string;
  category: string;
  mastery: number;         // 0-100
  problemCount: number;
  mistakeCount: number;
  reviewCount: number;
  children: string[];
}
```

### KnowledgeEdge

```ts
interface KnowledgeEdge {
  from: string;
  to: string;
  relation: 'prerequisite' | 'related' | 'extension';
}
```

### KnowledgeGraph

```ts
interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  weakPoints: string[];
}
```

## 4. 状态管理 (`lib/store/use-sky-classroom-store.ts`)

### SkyClassroomStore

```ts
type SkyClassroomStore = SolveSlice & SlidesSlice & MistakesSlice & AssistantSlice;
```

### SolveSlice

```ts
interface SolveSlice {
  currentSolveState: SolveState | null;
  solveHistory: SolveState[];
  isSolving: boolean;
  setSolveState: (state: SolveState) => void;
  addToHistory: (state: SolveState) => void;
  setSolving: (solving: boolean) => void;
  clearSolveHistory: () => void;
}
```

### SlidesSlice

```ts
interface SlidesSlice {
  selectedAvatarId: string;
  availableAvatars: AvatarConfig[];
  currentSpeech: AvatarSpeech | null;
  isGenerating: boolean;
  generationOptions: SlideGenerationOptions;
  slides: Slide[];
  generationResult: SlideGenerationResult | null;
  generationError: string | null;
}
```

### MistakesSlice

```ts
interface MistakesSlice {
  mistakes: MistakeRecord[];
  knowledgeGraph: KnowledgeGraph | null;
  activeFilter: MistakeFilter | null;
  addMistake: (mistake: MistakeRecord) => void;
  markReviewed: (id: string) => void;
  setFilter: (filter: MistakeFilter | null) => void;
  setKnowledgeGraph: (graph: KnowledgeGraph) => void;
  deleteMistake: (id: string) => void;
}
```

### AssistantSlice

```ts
interface AssistantSlice {
  isOpen: boolean;
  subject: string;
  style: string;
  difficulty: string;
  toggleOpen: () => void;
  setSubject: (subject: string) => void;
  setStyle: (style: string) => void;
  setDifficulty: (difficulty: string) => void;
}
```

## 5. 导出模块

### CourseExportConfig

```ts
interface CourseExportConfig {
  slides: Slide[];
  avatarId: string;
  avatarName: string;
  includeSpeakerNotes: boolean;
  includeKnowledgePoints: boolean;
  fileName: string;
}
```
