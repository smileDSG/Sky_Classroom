/**
 * Phase 3 (B-001): Generator template migration tests
 *
 * Validates:
 * - All 11 generator templates exist and contain required sections
 * - Generators integrate with the composability engine
 * - Variable interpolation works correctly
 * - Conditional blocks and snippet references are valid
 * - Content is well-formed for each generator type
 */
import { describe, test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { PromptComposer, resetPromptComposer } from '@/lib/prompts/composability';
import type { PromptFragment } from '@/lib/prompts/types';

const promptsDir = path.join(process.cwd(), 'lib', 'prompts');
const generatorsDir = path.join(promptsDir, 'generators');

// ─── Helpers ───

function loadGenerator(filename: string): string {
  return fs.readFileSync(path.join(generatorsDir, filename), 'utf-8');
}

function makeComposer(): PromptComposer {
  resetPromptComposer();
  return new PromptComposer();
}

function registerFragment(composer: PromptComposer, id: string, content: string) {
  composer.register({
    id,
    category: 'generator',
    content,
    priority: 20,
  });
}

// ─── Existence & Structure ───

const GENERATOR_FILES = [
  'outline.md',
  'interactive-outlines.md',
  'slide-content.md',
  'slide-actions.md',
  'quiz.md',
  'quiz-actions.md',
  'widget-teacher-actions.md',
  'interactive-actions.md',
  'pbl-design.md',
  'pbl-actions.md',
  'web-search-query-rewrite.md',
] as const;

describe('Phase 3: Generator templates', () => {
  describe('file existence', () => {
    for (const filename of GENERATOR_FILES) {
      test(`${filename} exists`, () => {
        expect(fs.existsSync(path.join(generatorsDir, filename))).toBe(true);
      });
    }

    test('all 11 generator files are present', () => {
      const files = fs.readdirSync(generatorsDir).filter(f => f.endsWith('.md'));
      expect(files.length).toBeGreaterThanOrEqual(11);
    });
  });

  // ─── Outline generator ───

  describe('outline.md', () => {
    const content = loadGenerator('outline.md');

    test('contains core task description', () => {
      expect(content).toMatch(/course\s*(content)?\s*designer/i);
      expect(content).toContain('Core Task');
    });

    test('specifies language inference rules', () => {
      expect(content).toContain('Language Inference');
      expect(content).toContain('languageDirective');
      expect(content).toContain('Explicit language request wins');
    });

    test('describes all 4 scene types', () => {
      expect(content).toContain('slide');
      expect(content).toContain('quiz');
      expect(content).toContain('interactive');
      expect(content).toContain('pbl');
    });

    test('specifies widget type selection', () => {
      expect(content).toContain('widgetType');
      expect(content).toContain('widgetOutline');
      expect(content).toContain('simulation');
      expect(content).toContain('diagram');
      expect(content).toContain('code');
      expect(content).toContain('game');
      expect(content).toContain('visualization3d');
    });

    test('specifies output format requirements', () => {
      expect(content).toContain('languageDirective');
      expect(content).toContain('outlines');
      expect(content).toContain('NON-NEGOTIABLE');
      expect(content).toContain('Never');
    });

    test('includes conditional snippet blocks', () => {
      expect(content).toContain('{{#if imageEnabled}}');
      expect(content).toContain('{{#if videoEnabled}}');
      expect(content).toContain('{{#if mediaEnabled}}');
      expect(content).toContain('{{#if hasSourceImages}}');
    });

    test('includes default assumption rules', () => {
      expect(content).toContain('Default Assumption Rules');
      expect(content).toContain('15-20 minutes');
    });

    test('includes quizConfig structure', () => {
      expect(content).toContain('quizConfig');
      expect(content).toContain('single');
      expect(content).toContain('multiple');
      expect(content).toContain('short_answer');
    });

    test('includes pblConfig structure', () => {
      expect(content).toContain('pblConfig');
      expect(content).toContain('projectTopic');
      expect(content).toContain('targetSkills');
      expect(content).toContain('issueCount');
    });

    test('forbids teacher identity on slides', () => {
      expect(content).toMatch(/no teacher identity/i);
    });
  });

  // ─── Interactive outlines generator ───

  describe('interactive-outlines.md', () => {
    const content = loadGenerator('interactive-outlines.md');

    test('describes all 5 widget types', () => {
      expect(content).toContain('Simulation');
      expect(content).toContain('Diagram');
      expect(content).toContain('Code Playground');
      expect(content).toContain('Game Widget');
      expect(content).toContain('3D Visualization');
    });

    test('includes widget selection guide', () => {
      expect(content).toContain('Widget Selection Guide');
      expect(content).toContain('Recommended Widget');
    });

    test('includes widget distribution guidelines', () => {
      expect(content).toContain('Widget Distribution Guidelines');
      expect(content).toContain('Opening scenes');
      expect(content).toContain('Middle scenes');
      expect(content).toContain('Closing scenes');
    });

    test('includes content generation guidelines for each widget', () => {
      expect(content).toContain('Simulation Content');
      expect(content).toContain('Diagram Content');
      expect(content).toContain('Code Content');
      expect(content).toContain('Game Content');
      expect(content).toContain('3D Visualization Content');
    });

    test('emphasizes games over quizzes', () => {
      expect(content).toMatch(/NOT boring quizzes/i);
      expect(content).toMatch(/PLAYER SKILL/i);
    });

    test('includes fair start requirement for games', () => {
      expect(content).toContain('Fair Start');
      expect(content).toContain('3-5 seconds');
    });

    test('includes 3D visualization requirements', () => {
      expect(content).toContain('Three.js');
      expect(content).toContain('Zoom buttons');
      expect(content).toContain('Proper lighting');
      expect(content).toContain('WebGL');
    });

    test('specifies output format', () => {
      expect(content).toContain('languageDirective');
      expect(content).toContain('NON-NEGOTIABLE');
    });
  });

  // ─── Slide content generator ───

  describe('slide-content.md', () => {
    const content = loadGenerator('slide-content.md');

    test('contains slide content philosophy', () => {
      expect(content).toContain('visual aids');
      expect(content).toContain('NOT lecture scripts');
    });

    test('describes all element types', () => {
      expect(content).toContain('TextElement');
      expect(content).toContain('ShapeElement');
      expect(content).toContain('LineElement');
      expect(content).toContain('ChartElement');
      expect(content).toContain('LatexElement');
      expect(content).toContain('TableElement');
    });

    test('includes text height lookup table', () => {
      expect(content).toContain('Text Height Lookup Table');
      expect(content).toContain('Font Size');
      expect(content).toContain('1 line');
      expect(content).toContain('14px');
      expect(content).toContain('36px');
    });

    test('includes canvas dimension variables', () => {
      expect(content).toContain('{{canvas_width}}');
      expect(content).toContain('{{canvas_height}}');
    });

    test('specifies LineElement width is stroke thickness', () => {
      expect(content).toContain('STROKE THICKNESS');
      expect(content).toContain('NOT line length');
    });

    test('includes pre-output checklist with P0 and P1', () => {
      expect(content).toContain('P0 — Critical');
      expect(content).toContain('P1 — Serious');
      expect(content).toContain('text-height');
      expect(content).toContain('text-width');
      expect(content).toContain('latex-fields');
      expect(content).toContain('line-stroke');
    });

    test('includes 8 design rules', () => {
      expect(content).toContain('Rule 1');
      expect(content).toContain('Rule 8');
      expect(content).toContain('Text Width Calculation');
      expect(content).toContain('Symmetry and Parallel Layout');
      expect(content).toContain('Spacing Standards');
      expect(content).toContain('Font Size Guidelines');
    });

    test('includes LatexElement height guide', () => {
      expect(content).toContain('Height guide by formula category');
      expect(content).toContain('Inline equations');
      expect(content).toContain('Matrices');
      expect(content).toContain('50-80');
      expect(content).toContain('100-180');
    });

    test('forbids LaTeX in TextElement', () => {
      expect(content).toMatch(/no.*latex.*text/i);
    });

    test('has conditional image/video blocks', () => {
      expect(content).toContain('{{#if imageElementEnabled}}');
      expect(content).toContain('{{#if generatedImageEnabled}}');
      expect(content).toContain('{{#if generatedVideoEnabled}}');
    });
  });

  // ─── Slide actions generator ───

  describe('slide-actions.md', () => {
    const content = loadGenerator('slide-actions.md');

    test('describes spotlight, laser, play_video, discussion actions', () => {
      expect(content).toContain('spotlight');
      expect(content).toContain('laser');
      expect(content).toContain('play_video');
      expect(content).toContain('discussion');
    });

    test('specifies discussion must be last action', () => {
      expect(content).toMatch(/last.*action/i);
    });

    test('specifies same-session continuity', () => {
      expect(content).toContain('Same-session continuity');
      expect(content).toContain('same class session');
    });

    test('specifies output format as JSON array', () => {
      expect(content).toContain('JSON array');
      expect(content).toContain('type');
      expect(content).toContain('action');
      expect(content).toContain('text');
    });
  });

  // ─── Quiz generator ───

  describe('quiz.md', () => {
    const content = loadGenerator('quiz.md');

    test('describes 3 question types', () => {
      expect(content).toContain('single');
      expect(content).toContain('multiple');
      expect(content).toContain('short_answer');
    });

    test('requires analysis and points for every question', () => {
      expect(content).toContain('analysis');
      expect(content).toContain('points');
    });

    test('includes xml-output-rules snippet', () => {
      expect(content).toContain('{{snippet:json-output-rules}}');
    });

    test('specifies option design principles', () => {
      expect(content).toContain('Option Design');
      expect(content).toContain('Distractors');
    });

    test('includes difficulty guidelines', () => {
      expect(content).toContain('easy');
      expect(content).toContain('medium');
      expect(content).toContain('hard');
    });

    test('specifies commentPrompt for short answer', () => {
      expect(content).toContain('commentPrompt');
      expect(content).toContain('grading rubric');
    });
  });

  // ─── Quiz actions generator ───

  describe('quiz-actions.md', () => {
    const content = loadGenerator('quiz-actions.md');

    test('describes discussion action', () => {
      expect(content).toContain('discussion');
    });

    test('specifies quiz flow design', () => {
      expect(content).toContain('Quiz Flow Design');
      expect(content).toContain('Opening Introduction');
      expect(content).toContain('Answer Explanation');
    });

    test('specifies same-session continuity', () => {
      expect(content).toContain('same class session');
    });
  });

  // ─── Widget teacher actions generator ───

  describe('widget-teacher-actions.md', () => {
    const content = loadGenerator('widget-teacher-actions.md');

    test('describes 5 action types for widgets', () => {
      expect(content).toContain('speech');
      expect(content).toContain('highlight');
      expect(content).toContain('annotation');
      expect(content).toContain('reveal');
      expect(content).toContain('setState');
    });

    test('includes target element conventions for all widget types', () => {
      expect(content).toContain('#angle-slider');
      expect(content).toContain('#n1');
      expect(content).toContain('#game-container');
      expect(content).toContain('#code-editor');
      expect(content).toContain('#camera-controls');
    });

    test('includes 3D visualization state examples', () => {
      expect(content).toContain('cameraTarget');
      expect(content).toContain('cameraPosition');
    });

    test('specifies 3-7 actions per widget', () => {
      expect(content).toMatch(/3-7 actions/);
    });
  });

  // ─── Interactive actions generator ───

  describe('interactive-actions.md', () => {
    const content = loadGenerator('interactive-actions.md');

    test('specifies speech-only actions for interactive scenes', () => {
      expect(content).toContain('speech only');
      expect(content).toContain('text');
    });

    test('specifies 3-6 segments', () => {
      expect(content).toMatch(/3-6 segments/);
    });

    test('specifies same-session continuity', () => {
      expect(content).toContain('same class session');
    });
  });

  // ─── PBL design generator ───

  describe('pbl-design.md', () => {
    const content = loadGenerator('pbl-design.md');

    test('contains variable placeholders', () => {
      expect(content).toContain('{{projectTopic}}');
      expect(content).toContain('{{projectDescription}}');
      expect(content).toContain('{{targetSkills}}');
      expect(content).toContain('{{issueCount}}');
      expect(content).toContain('{{languageDirective}}');
    });

    test('describes 4 modes', () => {
      expect(content).toContain('project_info');
      expect(content).toContain('agent');
      expect(content).toContain('issueboard');
      expect(content).toContain('idle');
    });

    test('specifies agent design guidelines', () => {
      expect(content).toContain('2-4');
      expect(content).toContain('development roles');
    });

    test('specifies issue design guidelines', () => {
      expect(content).toContain('Issue Design Guidelines');
      expect(content).toContain('sequential');
    });
  });

  // ─── PBL actions generator ───

  describe('pbl-actions.md', () => {
    const content = loadGenerator('pbl-actions.md');

    test('specifies 1-2 speech segments for PBL intro', () => {
      expect(content).toMatch(/1-2 speech segments/);
    });

    test('specifies same-session continuity', () => {
      expect(content).toContain('same class session');
    });

    test('output format is JSON array', () => {
      expect(content).toContain('JSON array');
    });
  });

  // ─── Web search query rewrite generator ───

  describe('web-search-query-rewrite.md', () => {
    const content = loadGenerator('web-search-query-rewrite.md');

    test('specifies single query field output', () => {
      expect(content).toContain('query');
    });

    test('includes 320 char limit', () => {
      expect(content).toContain('320');
    });

    test('includes json-output-rules snippet', () => {
      expect(content).toContain('{{snippet:json-output-rules}}');
    });
  });
});

// ─── Composition Integration Tests ───

describe('Phase 3: Generator composition integration', () => {
  test('composer can register and compose all generators', () => {
    const composer = makeComposer();

    for (const filename of GENERATOR_FILES) {
      const id = filename.replace('.md', '');
      const content = loadGenerator(filename);
      registerFragment(composer, id, content);
    }

    const result = composer.compose({
      fragments: ['outline', 'slide-content', 'slide-actions'],
      variables: { canvas_width: 1000, canvas_height: 562 },
    });

    expect(result.system).toContain('Scene Outline Generator');
    expect(result.system).toContain('Slide Content Generator');
    expect(result.system).toContain('Slide Action Generator');
    expect(result.meta.resolvedFragments).toBe(3);
    expect(result.meta.missingFragments).toHaveLength(0);
  });

  test('outline generator resolves canvas variables', () => {
    const composer = makeComposer();
    const content = loadGenerator('outline.md');
    registerFragment(composer, 'outline', content);

    // Register the image-instructions snippet so it resolves
    const snippetsDir = path.join(promptsDir, 'snippets');
    const imageSnippet = fs.readFileSync(path.join(snippetsDir, 'image-instructions.md'), 'utf-8');
    composer.register({ id: 'image-instructions', category: 'snippet', content: imageSnippet, priority: 5 });

    const result = composer.compose({
      fragments: ['outline'],
      variables: { imageEnabled: true, videoEnabled: false },
    });

    // imageEnabled=true → snippet content is included
    expect(result.system).toContain('image generation');
    // videoEnabled=false → the video-instructions block (including snippet ref) is stripped
    expect(result.system).not.toContain('video-instructions');
  });

  test('slide-content generator interpolates canvas dimensions', () => {
    const composer = makeComposer();
    const content = loadGenerator('slide-content.md');
    registerFragment(composer, 'slide-content', content);

    const result = composer.compose({
      fragments: ['slide-content'],
      variables: { canvas_width: 1280, canvas_height: 720 },
    });

    expect(result.system).toContain('1280');
    expect(result.system).toContain('720');
    expect(result.system).not.toContain('{{canvas_width}}');
    expect(result.system).not.toContain('{{canvas_height}}');
  });

  test('quiz generator resolves json-output-rules snippet', () => {
    const composer = makeComposer();
    // Register the quiz generator
    registerFragment(composer, 'quiz', loadGenerator('quiz.md'));

    // Register the json-output-rules snippet
    const snippetsDir = path.join(promptsDir, 'snippets');
    const jsonRules = fs.readFileSync(path.join(snippetsDir, 'json-output-rules.md'), 'utf-8');
    composer.register({
      id: 'json-output-rules',
      category: 'snippet',
      content: jsonRules,
      priority: 5,
    });

    const result = composer.compose({
      fragments: ['quiz'],
      variables: {},
    });

    // Snippet content should be resolved
    expect(result.system).not.toContain('{{snippet:json-output-rules}}');
    // Should contain content from the snippet
    expect(result.system).toContain('Do NOT wrap');
  });

  test('pbl-design generator interpolates all variables', () => {
    const composer = makeComposer();
    registerFragment(composer, 'pbl-design', loadGenerator('pbl-design.md'));

    const result = composer.compose({
      fragments: ['pbl-design'],
      variables: {
        projectTopic: 'Build a Weather Dashboard',
        projectDescription: 'Create a real-time dashboard displaying weather data',
        targetSkills: ['React', 'API Integration', 'Data Visualization'],
        issueCount: 4,
        languageDirective: 'Deliver all project content in English. Use clear technical vocabulary.',
      },
    });

    expect(result.system).toContain('Build a Weather Dashboard');
    expect(result.system).toContain('Create a real-time dashboard');
    expect(result.system).toContain('React');
    expect(result.system).toContain('4');
    expect(result.system).toContain('Deliver all project content in English');
    // Variables should be replaced
    expect(result.system).not.toContain('{{projectTopic}}');
    expect(result.system).not.toContain('{{issueCount}}');
  });

  test('composer handles missing fragments gracefully', () => {
    const composer = makeComposer();
    registerFragment(composer, 'outline', loadGenerator('outline.md'));

    const result = composer.compose({
      fragments: ['outline', 'nonexistent-generator'],
      variables: {},
    });

    expect(result.meta.missingFragments).toContain('nonexistent-generator');
    expect(result.meta.resolvedFragments).toBe(1);
  });

  test('all generator fragments can compose together without errors', () => {
    const composer = makeComposer();

    // Register snippets
    const snippetsDir = path.join(promptsDir, 'snippets');
    for (const snippetFile of fs.readdirSync(snippetsDir).filter(f => f.endsWith('.md'))) {
      const snippetId = snippetFile.replace('.md', '');
      const snippetContent = fs.readFileSync(path.join(snippetsDir, snippetFile), 'utf-8');
      composer.register({
        id: snippetId,
        category: 'snippet',
        content: snippetContent,
        priority: 5,
      });
    }

    // Register all generators
    const fragmentIds: string[] = [];
    for (const filename of GENERATOR_FILES) {
      const id = filename.replace('.md', '');
      registerFragment(composer, id, loadGenerator(filename));
      fragmentIds.push(id);
    }

    // Compose all together
    const result = composer.compose({
      fragments: fragmentIds,
      variables: {
        canvas_width: 1000,
        canvas_height: 562,
        imageEnabled: false,
        videoEnabled: false,
        mediaEnabled: false,
        imageElementEnabled: false,
        generatedImageEnabled: false,
        generatedVideoEnabled: false,
        hasSourceImages: false,
        projectTopic: 'Test Project',
        projectDescription: 'A test project description',
        targetSkills: ['Skill A', 'Skill B'],
        issueCount: 3,
        languageDirective: 'Use English for all content.',
      },
    });

    // Should compose without errors
    expect(result.meta.resolvedFragments).toBe(11);
    expect(result.meta.missingFragments).toHaveLength(0);
    expect(result.system.length).toBeGreaterThan(1000);
    // Snippets are resolved inline via processSnippets, not as composed fragments
    // so user may be empty when only generators are in the fragment list
    expect(result.system).not.toContain('{{snippet:');
  });

  test('generators with conditional blocks strip disabled content', () => {
    const composer = makeComposer();
    registerFragment(composer, 'outline', loadGenerator('outline.md'));
    registerFragment(composer, 'slide-content', loadGenerator('slide-content.md'));

    // All media features disabled
    const result = composer.compose({
      fragments: ['outline', 'slide-content'],
      variables: {
        canvas_width: 1000,
        canvas_height: 562,
        imageEnabled: false,
        videoEnabled: false,
        imageElementEnabled: false,
        generatedImageEnabled: false,
        generatedVideoEnabled: false,
        hasSourceImages: false,
      },
    });

    // Conditional blocks for disabled features should be stripped
    // Note: The conditionals {{#if flag}} are stripped when flag is false
    const system = result.system;
    expect(system).not.toMatch(/\{\{#if imageEnabled\}\}/);
  });

  test('outline has no teacher identity content', () => {
    const content = loadGenerator('outline.md');
    // Should not reference specific Chinese teacher names or roles
    expect(content).not.toContain('张老师');
    expect(content).not.toContain('Teacher Wang');
    // Should use generic language
    expect(content).toMatch(/neutral/i);
  });

  test('all generators are non-empty and have meaningful content', () => {
    for (const filename of GENERATOR_FILES) {
      const content = loadGenerator(filename);
      expect(content.length).toBeGreaterThan(200);
      // Should have at least one heading
      expect(content).toMatch(/^# /m);
    }
  });

  test('generator output formats specify no markdown fences', () => {
    const contentGenerators = ['outline.md', 'slide-content.md', 'quiz.md'];
    const actionGenerators = ['slide-actions.md', 'quiz-actions.md', 'interactive-actions.md', 'pbl-actions.md'];

    for (const filename of contentGenerators) {
      const content = loadGenerator(filename);
      expect(content).toMatch(/(?:no|never|do not).*(?:explanation|code fenc|markdown|additional text)/i);
    }
    for (const filename of actionGenerators) {
      const content = loadGenerator(filename);
      expect(content).toMatch(/no.*(explanation|code fences)/i);
    }
  });
});

describe('Phase 3: File size validation', () => {
  test('slide-content.md is the largest generator (most complex)', () => {
    const sizes: [string, number][] = [];
    for (const filename of GENERATOR_FILES) {
      const content = loadGenerator(filename);
      sizes.push([filename, content.length]);
    }
    const max = sizes.reduce((a, b) => (a[1] > b[1] ? a : b));
    expect(max[0]).toBe('slide-content.md');
  });

  test('all generators are between 500 and 12000 bytes', () => {
    for (const filename of GENERATOR_FILES) {
      const content = loadGenerator(filename);
      expect(content.length).toBeGreaterThan(500);
      expect(content.length).toBeLessThan(12000);
    }
  });
});
