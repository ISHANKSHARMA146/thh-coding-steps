#!/usr/bin/env node
'use strict';
// status.json helpers. Usage:
//   status.js init "<task title>" [repo ...]   create .thh/<slug>/, set current, print slug
//   status.js set <n> <state> [note]           state: running|done|approved|blocked|escalated|changes-requested
//   status.js approve [n]                      approve step n (default: latest done step)
//   status.js change "<notes>" [n]             request changes on step n (default: latest done step)
//   status.js question <n> "<text>"            record an escalation question, mark step escalated
//   status.js ui true|false                    record whether the task has UI (skips step 5 when false)
//   status.js tokens <n> <count>               add approximate tokens to step n
//   status.js show                             print checklist
//   status.js reset <n>                        reopen from step n (later steps back to pending)
//   status.js stop                             mark task stopped
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const [cmd, ...args] = process.argv.slice(2);
function die(msg) { console.error(msg); process.exit(2); }
function load() { const st = L.readStatus(); if (!st) die('No active task. Run /thh-coding-steps:step-0 "<task>" first.'); return st; }
function latestDone(st) {
  const ns = Object.keys(st.steps).map(Number).filter(n => st.steps[n].status === 'done').sort((a, b) => b - a);
  return ns[0];
}

switch (cmd) {
  case 'init': {
    const title = args[0]; if (!title) die('init needs a task title');
    const repos = args.slice(1);
    let slug = L.slugify(title);
    if (fs.existsSync(L.taskDir(slug))) slug += '-' + Date.now().toString(36).slice(-4);
    const st = { task: slug, title, created: L.nowIso(), ui: null, repos: repos.length ? repos : ['thh-backend', 'thh-frontend'],
      worktrees: {}, current_step: 0, steps: {} };
    for (const n of Object.keys(L.STEPS)) st.steps[n] = { status: 'pending', output: L.STEPS[n].output, tokens_approx: 0 };
    st.steps[0].status = 'running'; st.steps[0].started_at = L.nowIso();
    fs.mkdirSync(L.taskDir(slug), { recursive: true });
    L.writeStatus(st, slug);
    fs.writeFileSync(path.join(L.thhDir(), 'current'), slug + '\n');
    console.log(slug);
    break;
  }
  case 'set': {
    const st = load(); const n = Number(args[0]); const state = args[1];
    if (!(n in st.steps) || !state) die('usage: set <n> <state> [note]');
    Object.assign(st.steps[n], { status: state, updated_at: L.nowIso() });
    if (args[2]) st.steps[n].note = args[2];
    if (state === 'done' || state === 'approved') { st.steps[n].finished_at = L.nowIso(); delete st.steps[n].question; }
    st.current_step = n;
    L.writeStatus(st); console.log('step ' + n + ' -> ' + state);
    break;
  }
  case 'approve': {
    const st = load(); const n = args[0] !== undefined ? Number(args[0]) : latestDone(st);
    if (n === undefined) die('No step is awaiting approval.');
    if (st.steps[n].status !== 'done') die('Step ' + n + ' is ' + st.steps[n].status + ', not done; nothing to approve.');
    st.steps[n].status = 'approved'; st.steps[n].approved_at = L.nowIso(); delete st.steps[n].change_notes;
    L.writeStatus(st);
    if (n === 9) {
      // Ship call accepted: the task worktrees go, the feat/<slug> branches stay for the PR.
      const r = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'worktree.js'), 'remove'], { encoding: 'utf8', env: process.env });
      console.log((r.stdout || '') + (r.stderr || ''));
      console.log('step 9 approved. Task complete: open the PR from branch ' + (st.branch || 'feat/' + st.task) + ' using ' + path.join(L.taskDir(), 'pr-body.md'));
    } else {
      console.log('step ' + n + ' approved. Next: /thh-coding-steps:step-' + (n + 1 === 5 && st.ui === false ? 6 : n + 1));
    }
    break;
  }
  case 'change': {
    const st = load(); const notes = args[0]; const n = args[1] !== undefined ? Number(args[1]) : latestDone(st);
    if (!notes || n === undefined) die('usage: change "<notes>" [n]');
    st.steps[n].status = 'changes-requested'; st.steps[n].change_notes = notes;
    L.writeStatus(st); console.log('step ' + n + ' -> changes-requested. Re-run /thh-coding-steps:step-' + n);
    break;
  }
  case 'question': {
    const st = load(); const n = Number(args[0]); const q = args[1];
    if (!(n in st.steps) || !q) die('usage: question <n> "<text>"');
    st.steps[n].status = 'escalated'; st.steps[n].question = q;
    L.writeStatus(st); console.log('step ' + n + ' escalated: ' + q);
    break;
  }
  case 'ui': {
    const st = load(); st.ui = args[0] === 'true';
    st.steps[5].status = st.ui ? 'pending' : 'skipped';
    L.writeStatus(st); console.log('ui=' + st.ui); break;
  }
  case 'tokens': {
    const st = load(); const n = Number(args[0]);
    st.steps[n].tokens_approx = (st.steps[n].tokens_approx || 0) + Number(args[1] || 0);
    L.writeStatus(st); break;
  }
  case 'reset': {
    const st = load(); const n = Number(args[0]); if (!(n in st.steps)) die('usage: reset <n>');
    for (const k of Object.keys(st.steps).map(Number)) {
      if (k >= n) st.steps[k] = { status: k === 5 && st.ui === false ? 'skipped' : 'pending', output: L.STEPS[k].output, tokens_approx: 0 };
    }
    delete st.stopped_at;
    st.current_step = n; L.writeStatus(st); console.log('reopened from step ' + n); break;
  }
  case 'stop': { const st = load(); st.stopped_at = L.nowIso(); L.writeStatus(st); console.log('task stopped'); break; }
  case 'show': {
    const st = load();
    const mark = { pending: '[ ]', running: '[~]', done: '[d]', approved: '[x]', skipped: '[-]', blocked: '[!]', escalated: '[?]', 'changes-requested': '[c]' };
    console.log('Task: ' + st.task + '  "' + st.title + '"  ui=' + st.ui + '  repos=' + st.repos.join(',') + (st.stopped_at ? '  STOPPED' : ''));
    let total = 0;
    for (const n of Object.keys(L.STEPS)) {
      const s = st.steps[n]; total += s.tokens_approx || 0;
      const gate = L.STEPS[n].gate === 'human' ? 'human' : 'auto ';
      console.log((mark[s.status] || '[ ]') + ' ' + n + ' ' + L.STEPS[n].name.padEnd(9) + ' ' + gate + '  ' + s.status.padEnd(17)
        + String(s.tokens_approx || 0).padStart(8) + ' tok~' + (s.question ? '  Q: ' + s.question : '') + (s.change_notes ? '  CHANGE: ' + s.change_notes : ''));
    }
    console.log('Approximate tokens total: ' + total + '. Legend: [x] approved [d] done, awaiting approval [~] running [?] escalated [c] changes requested [-] skipped');
    break;
  }
  default: die('unknown command: ' + cmd);
}
