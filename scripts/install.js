#!/usr/bin/env node
'use strict';
// One-time workspace setup, run from the workspace root (the folder that holds thh-backend and thh-frontend):
//   node <plugin>/scripts/install.js
// 1. Drops a one-line pointer to the single standards copy into each repo's CLAUDE.md (idempotent).
// 2. Adds `.thh/` and `worktrees/` to each repo's .gitignore as a safety net.
// 3. Creates <workspace>/.thh/ and <workspace>/worktrees/.
const fs = require('fs');
const path = require('path');

const ws = process.env.THH_WORKSPACE || process.cwd();
const plugin = path.resolve(__dirname, '..');
const stdPath = path.join(plugin, 'references', 'THH-CODE-STANDARDS.md');
const pointer = '\n## Code standards\n\nThe single source of truth is `' + stdPath.replace(/\\/g, '/') + '` (thh-coding-steps plugin). Read it before writing or reviewing code; do not copy it here.\n';
const MARK = 'thh-coding-steps plugin';
for (const repo of ['thh-backend', 'thh-frontend']) {
  const dir = path.join(ws, repo);
  if (!fs.existsSync(dir)) { console.log(repo + ': not found under ' + ws + ', skipped'); continue; }
  const cm = path.join(dir, 'CLAUDE.md');
  const cur = fs.existsSync(cm) ? fs.readFileSync(cm, 'utf8') : '';
  if (cur.includes(MARK)) console.log(repo + ': CLAUDE.md pointer already present');
  else { fs.writeFileSync(cm, cur.replace(/\s*$/, '\n') + pointer); console.log(repo + ': CLAUDE.md pointer added'); }
  const gi = path.join(dir, '.gitignore');
  let g = fs.existsSync(gi) ? fs.readFileSync(gi, 'utf8') : '';
  let added = [];
  for (const line of ['.thh/', 'worktrees/']) if (!g.split(/\r?\n/).includes(line)) { g = g.replace(/\s*$/, '\n') + line + '\n'; added.push(line); }
  if (added.length) { fs.writeFileSync(gi, g); console.log(repo + ': .gitignore += ' + added.join(' ')); }
}
for (const d of ['.thh', 'worktrees']) fs.mkdirSync(path.join(ws, d), { recursive: true });
console.log('workspace ready: ' + ws + '\nstandards: ' + stdPath + (fs.existsSync(stdPath) ? '' : '  (MISSING: merge not done yet)'));
