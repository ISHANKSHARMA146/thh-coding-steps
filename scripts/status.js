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
//   status.js use <slug>                       bind THIS session to an existing task
//   status.js tasks                            list tasks with their owning session
// Every command takes an optional `--session <id>` (defaults to CLAUDE_CODE_SESSION_ID)
// and `--force` (act on a task another session owns). Which task a command hits is
// resolved per session, not from a machine-global pointer — see lib.js.
const fs = require('fs');
const path = require('path');
const L = require('./lib');

// --session <id> lets a caller that knows its session id (a hook, a preamble on a
// Claude Code build that does not export CLAUDE_CODE_SESSION_ID) name it explicitly.
const argv = process.argv.slice(2);
const sessIx = argv.indexOf('--session');
const SID = L.sessionId(sessIx >= 0 ? argv[sessIx + 1] : '');
if (sessIx >= 0) argv.splice(sessIx, 2);
const forceIx = argv.indexOf('--force');
const FORCE = forceIx >= 0;
if (FORCE) argv.splice(forceIx, 1);
const [cmd, ...args] = argv;

function die(msg) { console.error(msg); process.exit(2); }
function load() {
  const slug = L.currentSlug(SID);
  const st = slug ? L.readStatus(slug) : null;
  if (!st) die('No active task for this session. Run /thh-coding-steps:step-0 "<task>" to start one, '
    + 'or /thh-coding-steps:step-status to list tasks and bind with `status.js use <slug>`.');
  // The guard that makes concurrent sessions safe: refuse to mutate a task that
  // another live session owns, rather than silently writing its status.json.
  if (L.ownedByOther(st, SID) && !FORCE) {
    die('Task "' + st.task + '" is owned by session ' + L.ownerOf(st) + ', not this one (' + (SID || 'unknown') + ').\n'
      + 'Refusing to act on another session\'s task. Run `status.js use ' + st.task + '` to take it over, '
      + 'or pass --force for a one-off.');
  }
  return st;
}
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
    const st = { task: slug, title, created: L.nowIso(), owner_session: SID || null,
      ui: null, repos: repos.length ? repos : ['thh-backend', 'thh-frontend'],
      worktrees: {}, current_step: 0, steps: {} };
    for (const n of Object.keys(L.STEPS)) st.steps[n] = { status: 'pending', output: L.STEPS[n].output, tokens_approx: 0 };
    st.steps[0].status = 'running'; st.steps[0].started_at = L.nowIso();
    fs.mkdirSync(L.taskDir(slug), { recursive: true });
    L.writeStatus(st, slug);
    L.bindSession(slug, SID);
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
    L.writeStatus(st); console.log('[' + st.task + '] step ' + n + ' -> ' + state);
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
      const r = require('child_process').spawnSync(process.execPath,
        [path.join(__dirname, 'worktree.js'), 'remove', '--session', SID], { encoding: 'utf8', env: process.env });
      console.log((r.stdout || '') + (r.stderr || ''));
      console.log('[' + st.task + '] step 9 approved. Task complete: open the PR from branch '
        + (st.branch || 'feat/' + st.task) + ' using ' + path.join(L.taskDir(st.task), 'pr-body.md'));
    } else {
      console.log('[' + st.task + '] step ' + n + ' approved. Next: /thh-coding-steps:step-' + (n + 1 === 5 && st.ui === false ? 6 : n + 1));
    }
    break;
  }
  case 'change': {
    const st = load(); const notes = args[0]; const n = args[1] !== undefined ? Number(args[1]) : latestDone(st);
    if (!notes || n === undefined) die('usage: change "<notes>" [n]');
    st.steps[n].status = 'changes-requested'; st.steps[n].change_notes = notes;
    L.writeStatus(st); console.log('[' + st.task + '] step ' + n + ' -> changes-requested. Re-run /thh-coding-steps:step-' + n);
    break;
  }
  case 'question': {
    const st = load(); const n = Number(args[0]); const q = args[1];
    if (!(n in st.steps) || !q) die('usage: question <n> "<text>"');
    st.steps[n].status = 'escalated'; st.steps[n].question = q;
    L.writeStatus(st); console.log('[' + st.task + '] step ' + n + ' escalated: ' + q);
    break;
  }
  case 'ui': {
    const st = load(); st.ui = args[0] === 'true';
    st.steps[5].status = st.ui ? 'pending' : 'skipped';
    L.writeStatus(st); console.log('[' + st.task + '] ui=' + st.ui); break;
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
    st.current_step = n; L.writeStatus(st); console.log('[' + st.task + '] reopened from step ' + n); break;
  }
  case 'stop': { const st = load(); st.stopped_at = L.nowIso(); L.writeStatus(st); console.log('[' + st.task + '] task stopped'); break; }
  case 'use': {
    const slug = args[0]; if (!slug) die('usage: use <slug>');
    const st = L.readStatus(slug); if (!st) die('No task "' + slug + '" in ' + L.thhDir());
    const prev = L.ownerOf(st);
    if (prev && SID && prev !== SID && !FORCE) {
      die('Task "' + slug + '" is owned by session ' + prev + '. Pass --force to take it over '
        + '(do that only if that session has stopped, or both will fight over the same status.json).');
    }
    st.owner_session = SID || null;
    L.writeStatus(st, slug);
    L.bindSession(slug, SID);
    console.log('[' + slug + '] bound to session ' + (SID || 'unknown') + (prev && prev !== SID ? ' (taken over from ' + prev + ')' : ''));
    break;
  }
  case 'tasks': {
    const dir = L.thhDir();
    const slugs = fs.existsSync(dir) ? fs.readdirSync(dir).filter(d => fs.existsSync(L.statusPath(d))) : [];
    if (!slugs.length) { console.log('No tasks in ' + dir); break; }
    const mine = L.currentSlug(SID);
    for (const s of slugs) {
      const st = L.readStatus(s);
      const owner = L.ownerOf(st);
      const who = !owner ? 'unowned' : (owner === SID ? 'this session' : owner);
      console.log((s === mine ? '* ' : '  ') + s.padEnd(50) + ' step ' + st.current_step
        + '  ' + (st.steps[st.current_step] || {}).status + '  owner: ' + who + (st.stopped_at ? '  STOPPED' : ''));
    }
    console.log('\n* = bound to this session. Bind another with: status.js use <slug>');
    break;
  }
  case 'show': {
    const slug = L.currentSlug(SID);
    if (!slug || !L.readStatus(slug)) {
      console.log('No active task for this session. Start one with /thh-coding-steps:step-0 "<task in one sentence>",');
      console.log('or list existing tasks with `status.js tasks` and bind one with `status.js use <slug>`.');
      break;
    }
    const st = L.readStatus(slug);
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
