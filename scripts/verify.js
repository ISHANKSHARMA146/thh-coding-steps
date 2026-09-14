#!/usr/bin/env node
'use strict';
// verify-before-review: run each repo's own checks inside the task worktrees and print PASS/FAIL.
// Frontend: npm run typecheck, npm run lint, npm test. Backend: pytest for the test areas that
// match the services the plan touches (the full backend suite is not green by baseline, see thh-backend/CLAUDE.md).
// Always exits 0; the summary is what the calling step acts on. Also appends to execution-log.md when asked (--log).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const L = require('./lib');

const st = L.readStatus(); if (!st) { console.log('verify: no active task'); process.exit(0); }
const PY = process.env.THH_PYTHON || 'C:\\thhvenv\\Scripts\\python.exe';
const results = [];
function run(label, cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: 'utf8', shell: process.platform === 'win32', timeout: 600000 });
  const out = ((r.stdout || '') + (r.stderr || '')).trim();
  const ok = r.status === 0;
  results.push({ label, ok, tail: out.split('\n').slice(-25).join('\n') });
  console.log('--- ' + label + ': ' + (ok ? 'PASS' : 'FAIL (exit ' + r.status + ')'));
  if (!ok) console.log(out.split('\n').slice(-40).join('\n'));
}
const planFiles = [...L.listedPaths(path.join(L.taskDir(), 'plan.md'))].map(s => s.replace(/\\/g, '/'));
for (const [repo, wt] of Object.entries(st.worktrees || {})) {
  if (!fs.existsSync(wt)) { console.log(repo + ': worktree missing at ' + wt); continue; }
  if (fs.existsSync(path.join(wt, 'package.json'))) {
    run(repo + ' typecheck', 'npm', ['run', 'typecheck', '--silent'], wt);
    run(repo + ' lint', 'npm', ['run', 'lint', '--silent'], wt);
    run(repo + ' test', 'npm', ['test', '--silent', '--', '--reporter=dot'], wt);
  } else if (fs.existsSync(path.join(wt, 'app.py'))) {
    const areas = new Set();
    for (const f of planFiles) { const m = f.match(/services\/([^\/]+)\//); if (m && fs.existsSync(path.join(wt, 'tests', m[1]))) areas.add('tests/' + m[1]); }
    if (!areas.size) console.log(repo + ': no tests/<area> matches the plan files; nothing run. Name test paths in plan.md "## Files" if there are any.');
    for (const a of areas) run(repo + ' pytest ' + a, PY, ['-m', 'pytest', a, '-q', '-p', 'no:cacheprovider'], wt);
  }
}
const failed = results.filter(r => !r.ok);
const summary = results.length ? (failed.length ? 'RESULT: FAIL (' + failed.map(f => f.label).join(', ') + ')' : 'RESULT: PASS (' + results.length + ' checks)') : 'RESULT: NO CHECKS RAN';
console.log('=== ' + summary);
if (process.argv.includes('--log')) {
  fs.appendFileSync(path.join(L.taskDir(), 'execution-log.md'), '\n### verify ' + L.nowIso() + '\n' + summary + '\n' + results.map(r => '- ' + r.label + ': ' + (r.ok ? 'PASS' : 'FAIL')).join('\n') + '\n');
}
