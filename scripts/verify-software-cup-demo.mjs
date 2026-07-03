import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function exists(file) {
  return fs.existsSync(path.join(root, file));
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
}

const checks = [];
function check(label, condition) {
  checks.push([label, Boolean(condition)]);
}

const profile = readJson('data/demo/software-cup/student-profile-sample.json');
const generated = readJson('data/demo/software-cup/generated-resources.json');
const dimensions = Object.keys(profile.dimensions || {});
const resourceTypes = new Set((generated.resources || []).map((resource) => resource.type));

check('software-cup page exists', exists('app/sky/software-cup/page.tsx'));
check('software-cup client component exists', exists('components/sky/software-cup/software-cup-page.tsx'));
check('profile conversation API exists', exists('app/api/sky/student/profile/conversation/route.ts'));
check('course knowledge search API exists', exists('app/api/sky/course-knowledge/search/route.ts'));
check('resource generation API exists', exists('app/api/sky/resource-generation/jobs/route.ts'));
check('content safety API exists', exists('app/api/sky/content-safety/check/route.ts'));
check('academic verification API exists', exists('app/api/sky/content-safety/verify-academic/route.ts'));
check('learning effect API exists', exists('app/api/sky/learning-effect/evaluate/route.ts'));
check('profile dimensions >= 8', dimensions.length >= 8);
check('resource types >= 5', resourceTypes.size >= 5);
check('agent trace >= 6', (generated.agentTrace || []).length >= 6);
check('learning path nodes >= 5', (generated.learningPath || []).length >= 5);
check(
  'every resource has citations and trust',
  (generated.resources || []).every(
    (resource) =>
      Array.isArray(resource.sourceCitations) &&
      resource.sourceCitations.length > 0 &&
      resource.trust &&
      typeof resource.trust.confidence === 'number',
  ),
);
check('open source notice exists', exists('OPEN_SOURCE_NOTICE.md'));
check('third party licenses exists', exists('THIRD_PARTY_LICENSES.md'));
check('safety docs exist', exists('docs/software-cup-safety-and-trust.md'));
check('performance docs exist', exists('docs/software-cup-performance.md'));
check('demo script exists', exists('docs/software-cup-demo-script.md'));

let failed = false;
for (const [label, passed] of checks) {
  console.log(`${passed ? 'PASS' : 'FAIL'} ${label}`);
  if (!passed) failed = true;
}

console.log(
  JSON.stringify(
    {
      profileDimensions: dimensions.length,
      resourceTypes: Array.from(resourceTypes),
      resources: generated.resources.length,
      agentTrace: generated.agentTrace.length,
      learningPath: generated.learningPath.length,
    },
    null,
    2,
  ),
);

if (failed) process.exitCode = 1;
