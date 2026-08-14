import { z } from 'zod';

export const virtualStudentProfileSchema = z
  .object({
    profileId: z.enum([
      'cold-start',
      'struggling',
      'careless',
      'impatient',
      'high-achiever',
      'questioner',
    ]),
    label: z.string().min(1),
    initialMastery: z.number().min(0).max(1),
    patience: z.number().min(0).max(1),
    questionRate: z.number().min(0).max(1),
    carelessRate: z.number().min(0).max(1),
    difficultyTolerance: z.number().min(0).max(1),
    hintRecovery: z.number().min(0).max(1),
  })
  .strict();

export type VirtualStudentProfile = z.infer<typeof virtualStudentProfileSchema>;

export const VIRTUAL_STUDENT_PROFILES: VirtualStudentProfile[] = [
  {
    profileId: 'cold-start',
    label: '冷启动型',
    initialMastery: 0.5,
    patience: 0.7,
    questionRate: 0.2,
    carelessRate: 0.1,
    difficultyTolerance: 0.5,
    hintRecovery: 0.6,
  },
  {
    profileId: 'struggling',
    label: '畏难型',
    initialMastery: 0.25,
    patience: 0.45,
    questionRate: 0.35,
    carelessRate: 0.1,
    difficultyTolerance: 0.25,
    hintRecovery: 0.8,
  },
  {
    profileId: 'careless',
    label: '粗心型',
    initialMastery: 0.7,
    patience: 0.7,
    questionRate: 0.15,
    carelessRate: 0.4,
    difficultyTolerance: 0.65,
    hintRecovery: 0.45,
  },
  {
    profileId: 'impatient',
    label: '厌学低耐心型',
    initialMastery: 0.55,
    patience: 0.2,
    questionRate: 0.1,
    carelessRate: 0.2,
    difficultyTolerance: 0.35,
    hintRecovery: 0.5,
  },
  {
    profileId: 'high-achiever',
    label: '学霸型',
    initialMastery: 0.9,
    patience: 0.9,
    questionRate: 0.25,
    carelessRate: 0.05,
    difficultyTolerance: 0.95,
    hintRecovery: 0.3,
  },
  {
    profileId: 'questioner',
    label: '追问型',
    initialMastery: 0.55,
    patience: 0.75,
    questionRate: 0.75,
    carelessRate: 0.1,
    difficultyTolerance: 0.6,
    hintRecovery: 0.7,
  },
];

export type SimulationAction =
  | 'present-question'
  | 'give-hint'
  | 'explain'
  | 'lower-difficulty'
  | 'raise-difficulty'
  | 'ask-question'
  | 'end-session';

export interface SimulationTurn {
  turn: number;
  actor: 'director' | 'virtual-student';
  action: SimulationAction;
  correct?: boolean;
  difficulty?: 'easy' | 'medium' | 'hard';
  message: string;
}

export const simulationRunResultSchema = z
  .object({
    runId: z.string().min(1),
    profileId: virtualStudentProfileSchema.shape.profileId,
    topic: z.string().min(1),
    modelMode: z.enum(['mock', 'cheap-llm']),
    turns: z.array(
      z.object({
        turn: z.number().int().positive(),
        actor: z.enum(['director', 'virtual-student']),
        action: z.enum([
          'present-question',
          'give-hint',
          'explain',
          'lower-difficulty',
          'raise-difficulty',
          'ask-question',
          'end-session',
        ]),
        correct: z.boolean().optional(),
        difficulty: z.enum(['easy', 'medium', 'hard']).optional(),
        message: z.string(),
      }),
    ),
    events: z.array(z.string().min(1)),
    completed: z.boolean(),
    exited: z.boolean(),
    failureReasons: z.array(z.string()),
    metrics: z
      .object({
        turns: z.number().int().min(0),
        correctRate: z.number().min(0).max(1),
        hintsRequested: z.number().int().min(0),
        repeatedActions: z.number().int().min(0),
        questionsAsked: z.number().int().min(0),
      })
      .strict(),
    source: z.literal('simulation'),
  })
  .strict();

export type SimulationRunResult = z.infer<typeof simulationRunResultSchema>;

function seededRandom(seed: number): () => number {
  let value = Math.abs(seed) || 1;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function pickDifficulty(
  profile: VirtualStudentProfile,
  current: number,
): 'easy' | 'medium' | 'hard' {
  if (profile.profileId === 'high-achiever') return current === 1 ? 'hard' : 'medium';
  if (profile.profileId === 'struggling' || profile.profileId === 'impatient') return 'easy';
  return current === 1 ? 'medium' : 'easy';
}

export function simulateVirtualStudent(input: {
  profile: VirtualStudentProfile;
  topic: string;
  maxTurns?: number;
  seed?: number;
  modelMode?: 'mock' | 'cheap-llm';
}): SimulationRunResult {
  const profile = virtualStudentProfileSchema.parse(input.profile);
  const maxTurns = Math.min(30, Math.max(1, input.maxTurns ?? 12));
  const random = seededRandom(input.seed ?? 1);
  const turns: SimulationTurn[] = [];
  const events: string[] = [];
  const failureReasons: string[] = [];
  let difficulty: 'easy' | 'medium' | 'hard' = 'medium';
  let correctCount = 0;
  let questionCount = 0;
  let hintsRequested = 0;
  let questionsAsked = 0;
  let repeatedActions = 0;
  let previousAction: SimulationAction | null = null;
  let exited = false;
  let completed = false;

  const addTurn = (turn: SimulationTurn) => {
    if (previousAction === turn.action) repeatedActions += 1;
    previousAction = turn.action;
    turns.push(turn);
  };

  for (let turn = 1; turn <= maxTurns; turn += 1) {
    const questionDifficulty = pickDifficulty(profile, turn);
    difficulty = questionDifficulty;
    addTurn({
      turn,
      actor: 'director',
      action: 'present-question',
      difficulty,
      message: `present ${input.topic}`,
    });
    events.push('question-presented');
    questionCount += 1;

    const difficultyPressure = difficulty === 'hard' ? 0.25 : difficulty === 'medium' ? 0.1 : 0;
    const correct =
      random() < profile.initialMastery - difficultyPressure - profile.carelessRate * 0.25;
    if (correct) correctCount += 1;
    addTurn({
      turn,
      actor: 'virtual-student',
      action: 'present-question',
      correct,
      difficulty,
      message: correct ? 'answer-correct' : 'answer-incorrect',
    });
    events.push('answer-submitted');

    if (!correct && random() < profile.questionRate) {
      questionsAsked += 1;
      addTurn({ turn, actor: 'virtual-student', action: 'ask-question', message: 'why?' });
      events.push('question-asked');
    }
    if (!correct && random() < profile.hintRecovery) {
      hintsRequested += 1;
      addTurn({ turn, actor: 'director', action: 'give-hint', message: 'hint' });
      events.push('hint-requested');
    }
    if (!correct && random() > profile.patience) {
      exited = true;
      addTurn({ turn, actor: 'virtual-student', action: 'end-session', message: 'exit' });
      events.push('session-exited');
      break;
    }
    if (turn === maxTurns || (questionCount >= 3 && correctCount / questionCount >= 0.8)) {
      completed = true;
      addTurn({ turn, actor: 'director', action: 'end-session', message: 'complete' });
      events.push('session-completed');
      break;
    }
    addTurn({
      turn,
      actor: 'director',
      action: correct ? 'raise-difficulty' : 'explain',
      message: correct ? 'try next level' : 'explain error',
    });
  }

  if (!completed && !exited) failureReasons.push('max-turns-without-terminal-event');
  if (turns.some((turn) => turn.action === 'give-hint') && profile.profileId === 'impatient') {
    failureReasons.push('impatient-profile-received-hint-but-did-not-exit');
  }

  return simulationRunResultSchema.parse({
    runId: `sim:${profile.profileId}:${input.seed ?? 1}:${input.topic}`,
    profileId: profile.profileId,
    topic: input.topic,
    modelMode: input.modelMode ?? 'mock',
    turns,
    events,
    completed,
    exited,
    failureReasons,
    metrics: {
      turns: turns.length,
      correctRate: questionCount > 0 ? correctCount / questionCount : 0,
      hintsRequested,
      repeatedActions,
      questionsAsked,
    },
    source: 'simulation',
  });
}
