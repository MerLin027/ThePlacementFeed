import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const TEST = require('../lib/env.cjs');
import { describeAcademicRequirement as d } from '../../client/src/utils/eligibility.js';
const cases = [
  [{ cgpa: 6.5 }, 'Min. CGPA 6.5'],
  [{ cgpa: 6.5, backlog: null }, 'Min. CGPA 6.5'],
  [{ cgpa: 7, backlog: 0 }, 'Min. CGPA 7 · No active backlogs allowed'],
  [{ backlog: 2 }, 'Up to 2 active backlogs'],
  [{ backlog: 1 }, 'Up to 1 active backlog'],
  [{}, 'No CGPA or backlog cutoff'],
  [undefined, 'No CGPA or backlog cutoff'],
  [{ cgpa: 0, backlog: 0 }, 'Min. CGPA 0 · No active backlogs allowed'],
];
let f = 0;
for (const [input, want] of cases) { const got = d(input); if (got !== want) { f++; console.log('FAIL', JSON.stringify(input), got); } }
console.log(`${cases.length - f}/${cases.length} passed`); process.exit(f ? 1 : 0);
