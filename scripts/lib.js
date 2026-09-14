'use strict';
// Shared helpers for thh-coding-steps scripts. Node only, no dependencies.
// State root: <workspace>/.thh/<slug>/ where <workspace> is THH_WORKSPACE,
// else CLAUDE_PROJECT_DIR, else the nearest ancestor of cwd that has .thh/, else cwd.
const fs = require('fs');
const path = require('path');

const STEPS = {
  0: { name: 'brief',    output: 'brief.md',          gate: 'human' },
  1: { name: 'research', output: 'research.md',       gate: 'auto'  },
  2: { name: 'plan',     output: 'plan.md',           gate: 'auto'  },
  3: { name: 'impact',   output: 'impact.md',         gate: 'auto'  },
  4: { name: 'gaps',     output: 'gaps.md',           gate: 'human' },
  5: { name: 'mockup',   output: 'mockup.html',       gate: 'human', uiOnly: true },
  6: { name: 'execute',  output: 'execution-log.md',  gate: 'auto'  },
  7: { name: 'review',   output: 'review.md',         gate: 'auto'  },
  8: { name: 'test',     output: 'test-report.md',    gate: 'auto'  },
  9: { name: 'audit',    output: 'audit.md',          gate: 'human' },
};

function norm(p) { return path.resolve(p).replace(/\\/g, '/').toLowerCase(); }

function workspaceRoot() {
  if (process.env.THH_WORKSPACE) return path.resolve(process.env.THH_WORKSPACE);
  if (process.env.CLAUDE_PROJECT_DIR) return path.resolve(process.env.CLAUDE_PROJECT_DIR);
  let d = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(d, '.thh'))) return d;
    const up = path.dirname(d);
    if (up === d) return process.cwd();
    d = up;
  }
}
function thhDir() { return path.join(workspaceRoot(), '.thh'); }
function currentSlug() {
  const f = path.join(thhDir(), 'current');
  return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim() : '';
}
function taskDir(slug) { return path.join(thhDir(), slug || currentSlug()); }
function statusPath(slug) { return path.join(taskDir(slug), 'status.json'); }
function readStatus(slug) {
  const f = statusPath(slug);
  if (!fs.existsSync(f)) return null;
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
function writeStatus(st, slug) {
  fs.mkdirSync(taskDir(slug || st.task), { recursive: true });
  fs.writeFileSync(statusPath(slug || st.task), JSON.stringify(st, null, 2) + '\n');
}
function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'task';
}
function nowIso() { return new Date().toISOString(); }

// The step that gates step n: 6 depends on 5 only when the task has UI.
function prevStep(n, st) {
  if (n === 6) return st && st.ui === false ? 4 : 5;
  return n - 1;
}

// Paths listed under a "## Files" heading in a task file: any backticked token,
// or the first token of a "- " bullet that contains a slash. Entries ending in "/" cover a subtree.
function listedPaths(file) {
  if (!fs.existsSync(file)) return [];
  const text = fs.readFileSync(file, 'utf8');
  const out = new Set();
  let inFiles = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^##\s/.test(line)) { inFiles = /^##\s+files\b/i.test(line); continue; }
    if (!inFiles) continue;
    for (const m of line.matchAll(/`([^`]+)`/g)) out.add(m[1].trim());
    const bare = line.replace(/^[-*]\s+/, '').split(/\s+/)[0];
    if (bare && /[\/\\]/.test(bare) && !/`/.test(bare)) out.add(bare.replace(/[,:]$/, ''));
  }
  return [...out];
}

function appendLog(slug, line) {
  try {
    fs.mkdirSync(taskDir(slug), { recursive: true });
    fs.appendFileSync(path.join(taskDir(slug), 'scope-guard.log'), line + '\n');
  } catch (_) { /* logging must never fail a hook */ }
}

module.exports = { STEPS, norm, workspaceRoot, thhDir, currentSlug, taskDir, statusPath,
  readStatus, writeStatus, slugify, nowIso, prevStep, listedPaths, appendLog };
