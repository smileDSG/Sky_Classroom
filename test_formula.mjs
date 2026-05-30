import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const temml = require('temml');
const { mml2omml } = require('mathml2omml');

function latexToOmml(latex) {
  try {
    const mathml = temml.renderToString(latex);
    console.log('  mathml length:', mathml.length);
    const omml = String(mml2omml(mathml));
    console.log('  omml length:', omml.length);
    return omml;
  } catch (e) {
    console.log('  ERROR:', e.message);
    return null;
  }
}

const tests = [
  '\text{see textbook}',
  'Zn^{2+} + Cu \rightarrow Zn + Cu^{2+}',
  'E = E^\circ - (RT/nF)\ln Q',
  '\Delta G = -nFE',
  '\text{见教材详细方程式}',
];

for (const latex of tests) {
  console.log('Testing:', latex);
  const omml = latexToOmml(latex);
  console.log('  Result:', omml ? 'SUCCESS' : 'NULL');
}
