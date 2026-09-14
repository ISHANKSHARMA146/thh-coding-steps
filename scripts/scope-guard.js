#!/usr/bin/env node
'use strict';
// PreToolUse hook: confines each step agent to its own inputs.
// Applies only when hook input agent_type is one of this plugin's step agents
// (e.g. "thh-coding-steps:step-6-execute"); every other agent passes through.
// Decision is logged to .thh/<slug>/scope-guard.log. Denies via JSON permissionDecision.
// Bash is not path-gated here (out of reach for a path filter); reviewers get no Edit/Write by hook rule instead.
const fs = require('fs');
const path = require('path');
const L = require('./lib');

let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', main);
setTimeout(() => process.exit(0), 3000).unref(); // never stall the session

function deny(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
  process.exit(0);
}

const SECRET = /(^|\/)(env-backups|db-dumps|mysql-data)(\/|$)|(^|\/)\.env(\..*)?$|(^|\/)my\.(ini|cnf)$/i;
const TESTISH = /(^|\/)tests?(\/|$)|\.test\.[jt]sx?$|(^|\/)test_[^\/]*\.py$|_test\.py$|(^|\/)vitest\.setup\.ts$/i;
const WRITE_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

function main() {
  let h; try { h = JSON.parse(input.replace(/^﻿/, '')); } catch (_) { process.exit(0); }
  const agent = String(h.agent_type || '');
  const m = agent.match(/(?:^|:)step-(\d)(?:-([a-z-]+))?$/);
  if (!m) process.exit(0); // not one of ours
  const n = Number(m[1]);
  const role = (m[2] || '').includes('fix') ? 'fix' : (m[2] || '').includes('crosscheck') ? 'crosscheck' : 'main';
  const tool = h.tool_name; const ti = h.tool_input || {};
  let target = ti.file_path || ti.notebook_path || ti.path || '';
  if (!target && (tool === 'Glob' || tool === 'Grep')) target = h.cwd || process.cwd();
  if (!target) process.exit(0);
  const abs = path.isAbsolute(target) ? target : path.join(h.cwd || process.cwd(), target);
  const p = L.norm(abs);

  const slug = L.currentSlug(); const st = L.readStatus(slug);
  const log = (decision, reason) => L.appendLog(slug || '_no-task', [L.nowIso(), agent, tool, decision, p, reason].join('\t'));
  if (!st) { log('deny', 'no active task'); return deny('scope-guard: no active task in .thh/current; step agents cannot run without one.'); }

  const ws = L.norm(L.workspaceRoot());
  const task = L.norm(L.taskDir(slug));
  const plugin = L.norm(process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..'));
  const under = (root) => p === root || p.startsWith(root + '/');
  const base = path.basename(p);

  if (SECRET.test(p)) { log('deny', 'secret path'); return deny('scope-guard: ' + target + ' is a secrets/data path. Never read or write it.'); }
  if (under(task) || under(plugin) || under(ws + '/.thh') || ['claude.md', 'agents.md', 'thh-code-standards.md'].includes(base)) { log('allow', 'always-allowed'); process.exit(0); }

  // Roots: worktrees for this task first, then the main repo checkouts.
  const roots = [];
  for (const [repo, wt] of Object.entries(st.worktrees || {})) roots.push({ repo, root: L.norm(wt), kind: 'worktree' });
  for (const repo of st.repos || []) roots.push({ repo, root: L.norm(path.join(L.workspaceRoot(), repo)), kind: 'repo' });
  let hit = null;
  for (const r of roots) if (under(r.root)) { hit = { ...r, rel: p.slice(r.root.length + 1) }; break; }

  // Files the plan and impact map name, keyed "repo/rel" (lowercase). Entries ending in "/" cover subtrees.
  const listed = [...L.listedPaths(path.join(L.taskDir(slug), 'plan.md')), ...L.listedPaths(path.join(L.taskDir(slug), 'impact.md'))]
    .map(s => s.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase());
  const inPlan = () => {
    if (!hit) return false;
    const key = hit.repo.toLowerCase() + '/' + hit.rel;
    return listed.some(e => e.endsWith('/') ? (key.startsWith(e) || hit.rel.startsWith(e)) : (key === e || hit.rel === e));
  };
  const isWrite = WRITE_TOOLS.has(tool);
  const planHint = 'Add it to the "## Files" section of plan.md (or impact.md) and re-run the step.';

  // ---- write rules ----
  if (isWrite) {
    if (n === 6 || role === 'fix') {
      if (!hit || hit.kind !== 'worktree') { log('deny', 'write outside worktree'); return deny('scope-guard: writes for step ' + n + ' must land inside the task worktree, not ' + target + '.'); }
      if (!inPlan()) { log('deny', 'write not in plan'); return deny('scope-guard: ' + target + ' is not in the plan file list. ' + planHint); }
      log('allow', 'plan file in worktree'); process.exit(0);
    }
    if (n === 8 && role === 'main' && hit && hit.kind === 'worktree' && TESTISH.test(hit.rel)) { log('allow', 'tester writes tests'); process.exit(0); }
    log('deny', 'reviewer/planner write'); return deny('scope-guard: step ' + n + ' agents write only their report in ' + L.taskDir(slug) + '. Refused: ' + target);
  }

  // ---- read rules ----
  switch (n) {
    case 1: log('deny', 'research reads task dir only'); return deny('scope-guard: step 1 works from brief.md and the web only. Refused: ' + target);
    case 2: case 3:
      if (hit) { log('allow', 'planner/impact repo read'); process.exit(0); }
      break;
    case 4:
      if (inPlan()) { log('allow', 'gap audit plan file'); process.exit(0); }
      break;
    case 5:
      if (hit && /frontend/i.test(hit.repo)) { log('allow', 'mockup reads frontend'); process.exit(0); }
      break;
    case 6: case 7: case 9:
      if (inPlan()) { log('allow', 'plan file'); process.exit(0); }
      break;
    case 8:
      if (role === 'fix' && inPlan()) { log('allow', 'fixer plan file'); process.exit(0); }
      if (role === 'main' && hit && TESTISH.test(hit.rel)) { log('allow', 'tester test file'); process.exit(0); }
      break;
  }
  log('deny', 'out of scope');
  return deny('scope-guard: ' + target + ' is outside step ' + n + "'s allowed inputs. " + (n >= 4 ? planHint : 'Use only the inputs injected into your prompt.'));
}
