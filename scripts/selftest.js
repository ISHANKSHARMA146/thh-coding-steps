#!/usr/bin/env node
'use strict';
// Self-test for gate.js, status.js and scope-guard.js against a throwaway workspace.
// Run: node scripts/selftest.js   (exit 1 on any failed expectation)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const S = __dirname;
const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'thh-selftest-'));
process.env.THH_WORKSPACE = ws;
const node = (script, args, input) => spawnSync(process.execPath, [path.join(S, script), ...args], { input, encoding: 'utf8', env: process.env });
let fails = 0;
function expect(label, cond, extra) { console.log((cond ? 'ok   ' : 'FAIL ') + label + (cond ? '' : '  ' + (extra || ''))); if (!cond) fails++; }

for (const d of ['thh-backend/services/jobs', 'thh-frontend/src', 'env-backups']) fs.mkdirSync(path.join(ws, d), { recursive: true });
const slug = node('status.js', ['init', 'Job board config screen']).stdout.trim();
const td = path.join(ws, '.thh', slug);
expect('init creates task dir', fs.existsSync(path.join(td, 'status.json')));

// gate: step 1 needs brief.md approved
let g = node('gate.js', ['1']);
expect('gate 1 blocked without brief.md (exit 2)', g.status === 2 && /brief\.md is missing/.test(g.stdout), g.stdout);
fs.writeFileSync(path.join(td, 'brief.md'), '# Brief\nui: yes\n');
node('status.js', ['set', '0', 'done']);
g = node('gate.js', ['1']);
expect('gate 1 blocked when brief not approved', g.status === 2 && /human approval/.test(g.stdout), g.stdout);
node('status.js', ['approve']);
g = node('gate.js', ['1']);
expect('gate 1 ok after approval', g.status === 0 && /GATE OK/.test(g.stdout), g.stdout);
g = node('gate.js', ['2']);
expect('gate 2 blocked without research.md', g.status === 2, g.stdout);
node('status.js', ['ui', 'false']);
fs.writeFileSync(path.join(td, 'gaps.md'), 'x'); node('status.js', ['set', '4', 'done']); node('status.js', ['approve', '4']);
g = node('gate.js', ['6']);
expect('gate 6 skips step 5 when ui=false', g.status === 0, g.stdout);
node('status.js', ['ui', 'true']);
g = node('gate.js', ['6']);
expect('gate 6 needs mockup when ui=true', g.status === 2 && /mockup/.test(g.stdout), g.stdout);
g = node('gate.js', ['5']);
expect('gate 5 ok after step 4 approved', g.status === 0, g.stdout);

// scope guard
fs.writeFileSync(path.join(td, 'plan.md'), '# Plan\n\n## Files\n- `thh-backend/services/jobs/routes.py` touch\n- `thh-frontend/src/app/jobs/config/page.tsx` create\n- `thh-backend/tests/jobs/` tests\n\n## Other\n- `thh-backend/app.py` is NOT a file entry (outside Files section)\n');
const wt = path.join(ws, 'worktrees', slug + '-thh-backend');
fs.mkdirSync(path.join(wt, 'services', 'jobs'), { recursive: true });
const st = JSON.parse(fs.readFileSync(path.join(td, 'status.json'), 'utf8')); st.worktrees = { 'thh-backend': wt }; fs.writeFileSync(path.join(td, 'status.json'), JSON.stringify(st));
const guard = (agent, tool, file, extra) => {
  const ti = file === null ? {} : { file_path: file };
  const r = node('scope-guard.js', [], JSON.stringify({ agent_type: agent, tool_name: tool, tool_input: Object.assign(ti, extra || {}), cwd: ws, hook_event_name: 'PreToolUse' }));
  return r.stdout.includes('"deny"') ? 'deny' : 'allow';
};
const A = 'thh-coding-steps:';
const cases = [
  ['step-6 reads plan file in repo', guard(A + 'step-6-execute', 'Read', path.join(ws, 'thh-backend/services/jobs/routes.py')), 'allow'],
  ['step-6 reads unlisted file', guard(A + 'step-6-execute', 'Read', path.join(ws, 'thh-backend/app.py')), 'deny'],
  ['step-6 writes plan file in MAIN repo (not worktree)', guard(A + 'step-6-execute', 'Write', path.join(ws, 'thh-backend/services/jobs/routes.py')), 'deny'],
  ['step-6 writes plan file in worktree', guard(A + 'step-6-execute', 'Write', path.join(wt, 'services/jobs/routes.py')), 'allow'],
  ['step-6 writes unlisted file in worktree', guard(A + 'step-6-execute', 'Edit', path.join(wt, 'app.py')), 'deny'],
  ['step-6 writes under listed subtree (tests/jobs/)', guard(A + 'step-6-execute', 'Write', path.join(wt, 'tests/jobs/test_config.py')), 'allow'],
  ['step-6 reads CLAUDE.md', guard(A + 'step-6-execute', 'Read', path.join(ws, 'thh-backend/CLAUDE.md')), 'allow'],
  ['step-6 Grep with no path (cwd)', guard(A + 'step-6-execute', 'Grep', null, { pattern: 'x' }), 'deny'],
  ['step-7 review writes own report', guard(A + 'step-7-review', 'Write', path.join(td, 'review.md')), 'allow'],
  ['step-7 review writes code', guard(A + 'step-7-review', 'Write', path.join(wt, 'services/jobs/routes.py')), 'deny'],
  ['step-7-fix edits plan file in worktree', guard(A + 'step-7-fix', 'Edit', path.join(wt, 'services/jobs/routes.py')), 'allow'],
  ['step-7-fix edits unlisted file', guard(A + 'step-7-fix', 'Edit', path.join(wt, 'app.py')), 'deny'],
  ['step-2 reads anywhere in repo', guard(A + 'step-2-plan', 'Read', path.join(ws, 'thh-backend/app.py')), 'allow'],
  ['step-3 globs the repo', guard(A + 'step-3-impact', 'Glob', null, { pattern: '**/*.py', path: path.join(ws, 'thh-backend') }), 'allow'],
  ['step-1 reads repo', guard(A + 'step-1-research', 'Read', path.join(ws, 'thh-backend/app.py')), 'deny'],
  ['step-1 reads brief', guard(A + 'step-1-research', 'Read', path.join(td, 'brief.md')), 'allow'],
  ['step-8 tester writes a test in worktree', guard(A + 'step-8-test', 'Write', path.join(wt, 'tests/jobs/test_api.py')), 'allow'],
  ['step-8 tester writes app code', guard(A + 'step-8-test', 'Write', path.join(wt, 'services/jobs/routes.py')), 'deny'],
  ['step-8 tester reads app code', guard(A + 'step-8-test', 'Read', path.join(wt, 'services/jobs/routes.py')), 'deny'],
  ['step-9 crosscheck reads audit.md', guard(A + 'step-9-crosscheck', 'Read', path.join(td, 'audit.md')), 'allow'],
  ['any step reads secrets', guard(A + 'step-3-impact', 'Read', path.join(ws, 'env-backups/x.env')), 'deny'],
  ['step-6 reads a parked tool result', guard(A + 'step-6-execute', 'Read', path.join(os.homedir(), '.claude', 'projects', 'C--x', 'sess', 'tool-results', 'abc.txt')), 'allow'],
  ['foreign agent passes through', guard('general-purpose', 'Read', path.join(ws, 'env-backups/x.env')), 'allow'],
  ['main thread (no agent_type) passes through', guard('', 'Read', path.join(ws, 'thh-backend/app.py')), 'allow'],
];
for (const [label, got, want] of cases) expect(label + ' -> ' + want, got === want, 'got ' + got);
const log = fs.readFileSync(path.join(td, 'scope-guard.log'), 'utf8');
expect('denials are logged with agent_type', /step-6-execute\tRead\tdeny/.test(log));
console.log('\nscope-guard.log sample:\n' + log.split('\n').filter(l => /deny/.test(l)).slice(0, 3).join('\n'));
fs.rmSync(ws, { recursive: true, force: true });
console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASSED');
process.exit(fails ? 1 : 0);
