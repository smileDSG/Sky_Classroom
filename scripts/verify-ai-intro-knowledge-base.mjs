import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const courseRoot = path.join(root, 'data', 'course-knowledge', 'ai-intro');

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(courseRoot, file), 'utf8'));
}

function readText(file) {
  return fs.readFileSync(path.join(courseRoot, file), 'utf8');
}

const chapterDir = path.join(courseRoot, 'chapters');
const chapters = fs
  .readdirSync(chapterDir)
  .filter((file) => file.endsWith('.md'))
  .sort();
const graph = readJson('knowledge-graph.json');
const bank = readJson('question-bank.json');

const checks = [
  ['chapters >= 12', chapters.length >= 12],
  ['knowledge nodes >= 40', graph.nodes.length >= 40],
  ['knowledge edges >= 50', graph.edges.length >= 50],
  ['questions >= 120', bank.questions.length >= 120],
];

const searchableCorpus = chapters
  .map((file) => ({
    file,
    text: fs.readFileSync(path.join(chapterDir, file), 'utf8'),
  }))
  .concat([
    { file: 'knowledge-graph.json', text: JSON.stringify(graph) },
    { file: 'question-bank.json', text: JSON.stringify(bank) },
    { file: 'readings.md', text: readText('readings.md') },
  ]);

function hits(query) {
  return searchableCorpus
    .map((doc) => ({
      file: doc.file,
      score: doc.text.toLowerCase().includes(query.toLowerCase()) ? 1 : 0,
    }))
    .filter((hit) => hit.score > 0)
    .map((hit) => hit.file);
}

const queryChecks = [
  [
    'search 过拟合 includes chapter 04',
    hits('过拟合').some((file) => file.includes('04-machine-learning-basics')),
  ],
  [
    'search RAG includes chapter 10 or case',
    hits('RAG').some((file) => /10-large-models|rag-course-assistant|knowledge-graph/.test(file)),
  ],
  ['search 智能体 has hit', hits('智能体').length > 0],
];

let failed = false;
for (const [label, passed] of [...checks, ...queryChecks]) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
  if (!passed) failed = true;
}

console.log(
  JSON.stringify(
    {
      chapters: chapters.length,
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      questions: bank.questions.length,
    },
    null,
    2,
  ),
);

if (failed) {
  process.exitCode = 1;
}
