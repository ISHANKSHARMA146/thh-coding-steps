#!/usr/bin/env node
'use strict';
// Per-task git worktrees, one per repo the task touches.
//   worktree.js create   -> <workspace>/worktrees/<slug>-<repo> on branch feat/<slug> (base: local `dev` if present, else repo HEAD)
//   worktree.js remove   -> git worktree remove --force; the branch is kept (it carries the PR)
// Copies the repo's gitignored .env / .env.local into the worktree so tests and dev servers run.
// Frontend worktrees get `npm ci` once (node_modules is not shared between worktrees).
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const L = require('./lib');

const argv = process.argv.slice(2);
const sessIx = argv.indexOf('--session');
const SID = L.sessionId(sessIx >= 0 ? argv[sessIx + 1] : '');
if (sessIx >= 0) argv.splice(sessIx, 2);
const cmd = argv[0];
const slug = L.currentSlug(SID);
const st = slug ? L.readStatus(slug) : null;
if (!st) { console.error('no active task for this session'); process.exit(2); }
if (L.ownedByOther(st, SID)) { console.error('task ' + st.task + ' is owned by session ' + L.ownerOf(st) + '; refusing to touch its worktrees'); process.exit(2); }
const ws = L.workspaceRoot();
const sh = (c, cwd) => execSync(c, { cwd, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' }).trim();

if (cmd === 'create') {
  st.worktrees = st.worktrees || {};
  st.branch = 'feat/' + st.task;
  for (const repo of st.repos) {
    const repoDir = L.repoPath(repo, ws);
    const wt = path.join(L.worktreeRoot(ws), st.task + '-' + L.repoName(repo));
    if (fs.existsSync(wt)) { console.log(repo + ': worktree exists at ' + wt); st.worktrees[repo] = wt; continue; }
    let base = 'HEAD';
    try { sh('git show-ref --verify --quiet refs/heads/dev', repoDir); base = 'dev'; } catch (_) { /* no local dev branch */ }
    let branchExists = true;
    try { sh('git show-ref --verify --quiet refs/heads/' + st.branch, repoDir); } catch (_) { branchExists = false; }
    sh(branchExists ? `git worktree add "${wt}" ${st.branch}` : `git worktree add -b ${st.branch} "${wt}" ${base}`, repoDir);
    for (const env of ['.env', '.env.local']) {
      const src = path.join(repoDir, env);
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(wt, env));
    }
    // node_modules is not shared between worktrees; the step-6 agent runs `npm ci` itself
    // (this script runs under the skill's 2-minute `!` budget, npm ci does not fit).
    if (fs.existsSync(path.join(wt, 'package.json'))) console.log(repo + ': fresh worktree has no node_modules; step 6 runs npm ci before the first check.');
    st.worktrees[repo] = wt;
    console.log(repo + ': ' + wt + ' on ' + st.branch + ' (base ' + base + ')');
  }
  L.writeStatus(st, st.task);
} else if (cmd === 'remove') {
  for (const [repo, wt] of Object.entries(st.worktrees || {})) {
    const repoDir = L.repoPath(repo, ws);
    try { sh(`git worktree remove --force "${wt}"`, repoDir); console.log(repo + ': removed ' + wt + ' (branch ' + st.branch + ' kept)'); }
    catch (e) { console.log(repo + ': could not remove ' + wt + ': ' + (e.stderr || e.message)); }
  }
  st.worktrees = {};
  L.writeStatus(st, st.task);
} else {
  console.error('usage: worktree.js create|remove'); process.exit(2);
}
