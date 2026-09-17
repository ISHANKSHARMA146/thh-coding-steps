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

// ---- two sessions, two tasks, one workspace -------------------------------
// The regression this guards: `.thh/current` used to be a single machine-global
// pointer, so whichever session ran `init` last owned every later command. Two
// sessions in one workspace would silently write each other's status.json,
// inject each other's brief into step agents, and tear down each other's worktrees.
console.log('\n--- concurrent sessions ---');
const asSession = (sid, script, args, extraEnv) => spawnSync(process.execPath, [path.join(S, script), ...args],
  { encoding: 'utf8', env: { ...process.env, CLAUDE_CODE_SESSION_ID: sid, ...(extraEnv || {}) } });

const A_SID = 'sess-aaaa', B_SID = 'sess-bbbb';
const slugA = asSession(A_SID, 'status.js', ['init', 'Alpha task one']).stdout.trim();
const slugB = asSession(B_SID, 'status.js', ['init', 'Beta task two']).stdout.trim();
expect('two sessions get two distinct tasks', Boolean(slugA && slugB && slugA !== slugB), slugA + ' / ' + slugB);

// B init'd last, so the legacy pointer names B. A must still resolve to its own task.
fs.writeFileSync(path.join(ws, '.thh', slugA, 'brief.md'), '# A\n');
asSession(A_SID, 'status.js', ['set', '0', 'done']);
const stA = JSON.parse(fs.readFileSync(path.join(ws, '.thh', slugA, 'status.json'), 'utf8'));
const stB = JSON.parse(fs.readFileSync(path.join(ws, '.thh', slugB, 'status.json'), 'utf8'));
expect("A's write lands in A", stA.steps[0].status === 'done', JSON.stringify(stA.steps[0]));
expect("A's write does NOT touch B", stB.steps[0].status === 'running', JSON.stringify(stB.steps[0]));

// Ownership guard: A may not mutate B's task even when pointed straight at it.
const forced = asSession(A_SID, 'status.js', ['set', '1', 'blocked'], { THH_TASK: slugB });
expect("A refused when acting on B's task", forced.status === 2 && /owned by session/.test(forced.stderr), forced.stderr);

// Explicit handover is allowed, recorded, and needs --force while the owner is live.
const nofor = asSession(A_SID, 'status.js', ['use', slugB]);
expect('use without --force refuses a live owner', nofor.status === 2 && /owned by session/.test(nofor.stderr), nofor.stderr);
const took = asSession(A_SID, 'status.js', ['use', slugB, '--force']);
const stB2 = JSON.parse(fs.readFileSync(path.join(ws, '.thh', slugB, 'status.json'), 'utf8'));
expect('use --force transfers ownership', took.status === 0 && stB2.owner_session === A_SID, took.stdout + took.stderr);

// gate refuses a task this session no longer owns.
const gB = asSession(B_SID, 'gate.js', ['1'], { THH_TASK: slugB });
expect('gate blocks a session that lost the task', gB.status === 2 && /owned by session/.test(gB.stdout), gB.stdout);

// ---- absolute repo paths --------------------------------------------------
// Needed for a task whose repos are not siblings under one workspace root.
const absRepo = path.join(ws, 'thh-backend');
const slugC = asSession('sess-cccc', 'status.js', ['init', 'Gamma absolute repos', absRepo]).stdout.trim();
const stC = JSON.parse(fs.readFileSync(path.join(ws, '.thh', slugC, 'status.json'), 'utf8'));
expect('init accepts an absolute repo path', stC.repos[0] === absRepo, JSON.stringify(stC.repos));
const L = require('./lib');
expect('repoPath passes an absolute repo through', L.repoPath(absRepo, path.join(ws, 'nowhere')) === absRepo);
expect('repoPath still joins a bare repo name', L.repoPath('thh-frontend', ws) === path.join(ws, 'thh-frontend'));
expect('repoName strips the directory', L.repoName(absRepo) === 'thh-backend');

fs.rmSync(ws, { recursive: true, force: true });
console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASSED');
process.exit(fails ? 1 : 0);
