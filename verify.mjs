// verify.mjs — ad-hoc assert-based check (no framework): drives the real quiz
// script from index.html against a stub DOM, plus the real api/leads.js handler.
// Run: npm test
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const repo = dirname(fileURLToPath(import.meta.url));
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + name); if (!cond) fails++; };

// --- stub DOM good enough to run the real page script
const created = []; const byId = {};
const mkEl = () => ({ style:{}, children:[], handlers:{}, value:'', textContent:'', innerHTML:'',
  appendChild(c){ this.children.push(c); }, addEventListener(ev,fn){ this.handlers[ev]=fn; } });
globalThis.document = {
  getElementById: id => byId[id] ??= mkEl(),
  createElement: () => { const el = mkEl(); created.push(el); return el; },
};
globalThis.window = { scrollTo(){} };
let fetchShouldFail = false; const fetchCalls = [];
globalThis.fetch = async (url, opts) => { fetchCalls.push({url, opts});
  if (fetchShouldFail) throw new Error('mock network down');
  return { ok: true }; };
const $ = id => document.getElementById(id);

const html = readFileSync(join(repo, 'index.html'), 'utf8');
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];
const api = new Function(script +
  '\n;return {ARCHETYPES, QUESTIONS, startQuiz, goBack, get answers(){return answers}, get resultArchetype(){return resultArchetype}};')();
const completeQuiz = () => { api.startQuiz(); for (let q = 0; q < 12; q++) created.slice(-4)[q % 4].onclick(); };

// 1. data integrity
ok('12 archetypes', api.ARCHETYPES.length === 12);
ok('12 unique archetype ids', new Set(api.ARCHETYPES.map(a=>a.id)).size === 12);
ok('12 questions', api.QUESTIONS.length === 12);
const ids = new Set(api.ARCHETYPES.map(a=>a.id));
ok('every question has 4 options', api.QUESTIONS.every(q => q.a.length === 4));
ok('every option maps to a real archetype id',
   api.QUESTIONS.every(q => q.a.every(([, id]) => ids.has(id))));
ok('every archetype has body + next step',
   api.ARCHETYPES.every(a => a.body.length > 20 && a.next.length > 20));

// 2. full quiz flow via real renderQuestion + option onclick closures
api.startQuiz();
for (let q = 0; q < 12; q++) {
  const btns = created.slice(-4);
  if (btns.length !== 4) { ok('question ' + (q+1) + ' rendered 4 options', false); break; }
  btns[q % 4].onclick();
}
ok('all 12 answers recorded', api.answers.length === 12);
ok('gate shown after last question', $('gate').style.display === 'block');
ok('quiz hidden after last question', $('quiz').style.display === 'none');
ok('progress bar at 100%', $('bar').style.width === '100%');
ok('result archetype resolved', !!api.resultArchetype && ids.has(api.resultArchetype.id));

// 3. back button mid-quiz (answered Q1, goes back to Q1)
api.startQuiz();
created.slice(-4)[0].onclick();
api.goBack();
ok('back button returns to Q1', $('qnum').textContent === 'Question 1 of 12');

// 4. gate submit with fetch FAILING — fallback must still reveal results
fetchShouldFail = true;
completeQuiz();
$('fname').value = 'Test'; $('femail').value = 'test@example.com';
await $('leadForm').handlers.submit({ preventDefault(){} });
await new Promise(r => setTimeout(r, 50));
ok('result shown despite failed lead POST', $('rName').textContent === api.resultArchetype.name);
ok('result body includes next step', $('rBody').innerHTML.includes('Your next step:'));

// 5. successful POST shape
fetchShouldFail = false;
completeQuiz();
$('fname').value = 'Test'; $('femail').value = 'test@example.com';
await $('leadForm').handlers.submit({ preventDefault(){} });
const call = fetchCalls.at(-1);
ok('lead POSTed to api/leads', !!(call && call.url === 'api/leads'));
const sent = JSON.parse(call.opts.body);
ok('lead payload carries archetype + answers + email',
   sent.email === 'test@example.com' && sent.archetype === api.resultArchetype.id &&
   Array.isArray(sent.answers) && sent.answers.length === 12);

// 6. api/leads.js handler
const mod = await import('file://' + join(repo, 'api', 'leads.js').replaceAll('\\', '/'));
const mkRes = () => ({ status: 0, body: null, status(c){ this.status = c; return this; }, json(b){ this.body = b; } });
const r400 = mkRes();
await mod.default({ body: { name:'T', email:'not-an-email' } }, r400);
ok('leads.js rejects invalid email with 400', r400.status === 400 && r400.body.ok === false);
const r200 = mkRes();
await mod.default({ body: { name:'T', email:'t@example.com', archetype:'tinkerer', answers:['a'] } }, r200);
ok('leads.js accepts valid lead with 200 (log fallback)', r200.status === 200 && r200.body.ok === true && r200.body.stored === 'logged-only');

// 7. package.json
const pkg = JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8'));
ok('package.json valid, type=module, @vercel/blob dep',
   pkg.type === 'module' && !!pkg.dependencies['@vercel/blob']);

console.log(fails === 0 ? 'ALL CHECKS PASSED' : fails + ' CHECK(S) FAILED');
process.exit(fails === 0 ? 0 : 1);