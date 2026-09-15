#!/usr/bin/env node
'use strict';
// Hard gate, run by `!` injection at the top of every step skill BEFORE the model reads it.
// Exit 2 aborts the skill (exit 1 is treated as normal output by Claude Code, so it must be 2).
// Usage: gate.js <n>
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const argv = process.argv.slice(2);
const sessIx = argv.indexOf('--session');
const SID = L.sessionId(sessIx >= 0 ? argv[sessIx + 1] : '');
if (sessIx >= 0) argv.splice(sessIx, 2);
const n = Number(argv[0]);
const slug = L.currentSlug(SID);
const st = L.readStatus(slug);
function fail(msg) { console.log('GATE BLOCKED step ' + n + ': ' + msg); process.exit(2); }
if (!slug || !st) fail('no active task for this session. Run /thh-coding-steps:step-0 "<task>" first, or bind an existing one with status.js use <slug>.');
if (L.ownedByOther(st, SID)) fail('task "' + slug + '" is owned by session ' + L.ownerOf(st) + ', not this one. Run status.js use ' + slug + ' --force only if that session has stopped.');
if (st.stopped_at) fail('task "' + slug + '" was stopped. Run /thh-coding-steps:step-reset <n> to reopen.');

const p = L.prevStep(n, st);
const prev = st.steps[p];
const prevFile = path.join(L.taskDir(slug), L.STEPS[p].output);
if (n === 5 && st.ui === false) fail('task has no UI (brief says ui: no). Step 5 is skipped; run step 6.');
if (!fs.existsSync(prevFile)) fail(L.STEPS[p].output + ' is missing. Run /thh-coding-steps:step-' + p + ' first.');
if (prev.status === 'escalated') fail('step ' + p + ' escalated an unanswered question: "' + prev.question + '". Answer it (edit ' + L.STEPS[p].output + ' or the brief) and re-run step ' + p + '.');
if (L.STEPS[p].gate === 'human' && prev.status !== 'approved') fail('step ' + p + ' needs human approval (status: ' + prev.status + '). Review ' + L.STEPS[p].output + ' then run /thh-coding-steps:step-approve.');
if (!['done', 'approved'].includes(prev.status)) fail('step ' + p + ' is ' + prev.status + ', not done. Run /thh-coding-steps:step-' + p + ' first.');

st.steps[n].status = 'running'; st.steps[n].started_at = L.nowIso(); st.current_step = n;
L.writeStatus(st, slug);
const notes = st.steps[n].change_notes ? '\nCHANGE NOTES from the human for this re-run: ' + st.steps[n].change_notes : '';
console.log('GATE OK. task=' + slug + ' step=' + n + ' (' + L.STEPS[n].name + '). task dir: ' + L.taskDir(slug) + notes);
