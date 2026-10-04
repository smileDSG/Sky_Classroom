/** 动画讲解 DSL —— 声明式分镜脚本（spec §3） */

export type SubjectArea = 'algorithm' | 'data-structure' | 'math' | 'physics';

export interface StageSpec {
  /** 逻辑坐标系宽（SVG viewBox），如 1200 */
  width: number;
  /** 逻辑坐标系高，如 675 */
  height: number;
  showGrid?: boolean;
  showAxes?: boolean;
}

export type NodeShape = 'circle' | 'rect';

interface BaseActor {
  id: string;
}

export interface NodeActor extends BaseActor {
  kind: 'node';
  label: string;
  shape: NodeShape;
  /** hex 颜色，如 #4f8ef7 */
  color: string;
  /** circle 半径 */
  r?: number;
  /** rect 宽高 */
  w?: number;
  h?: number;
}

export interface ArrayCellActor extends BaseActor {
  kind: 'array-cell';
  label: string;
  w: number;
  h: number;
  color: string;
}

export interface ArrowActor extends BaseActor {
  kind: 'arrow';
  fromActorId: string;
  toActorId: string;
  label?: string;
  curved?: boolean;
}

export interface PointerActor extends BaseActor {
  kind: 'pointer';
  label: string;
  targetActorId: string;
}

export interface TextActor extends BaseActor {
  kind: 'text';
  content: string;
  size: number;
  color: string;
}

export interface HighlightActor extends BaseActor {
  kind: 'highlight';
  targetActorId: string;
  color: string;
}

export interface BarActor extends BaseActor {
  kind: 'bar';
  label: string;
  w: number;
  color: string;
}

export interface AxesActor extends BaseActor {
  kind: 'axes';
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

export type Actor =
  | NodeActor
  | ArrayCellActor
  | ArrowActor
  | PointerActor
  | TextActor
  | HighlightActor
  | BarActor
  | AxesActor;

export type ActorKind = Actor['kind'];

/** 单步内某演员的完整状态（全量快照，spec §3.2） */
export interface ActorState {
  actorId: string;
  /** 舞台逻辑坐标（中心点） */
  x: number;
  y: number;
  opacity?: number;
  scale?: number;
  labelOverride?: string;
  colorOverride?: string;
  entering?: boolean;
  exiting?: boolean;
}

export interface AnimationStep {
  id: string;
  title: string;
  /** 该步旁白 → TTS；音频时长即该步停留时长 */
  narration: string;
  actorStates: ActorState[];
}

export interface AnimationScript {
  id: string;
  title: string;
  topic: string;
  subjectArea: SubjectArea;
  stage: StageSpec;
  actors: Actor[];
  steps: AnimationStep[];
}

export interface ScriptMeta {
  scriptId: string;
  title: string;
  topic: string;
  subjectArea: SubjectArea;
  stepCount: number;
  createdAt: string;
}
