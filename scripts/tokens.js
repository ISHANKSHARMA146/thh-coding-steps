#!/usr/bin/env node
'use strict';
// SubagentStop hook: approximate token count per step, from the subagent transcript.
// Best effort and labelled approximate: sums message.usage over the agent transcript when the hook
// input names one, else over main-transcript entries stamped after the step started. Never blocks.
const fs = require('fs');
const path = require('path');
const L = require('./lib');

let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => { try { main(); } catch (_) { /* silent */ } process.exit(0); });
setTimeout(() => process.exit(0), 4000).unref();

function main() {
  const h = JSON.parse(input.replace(/^﻿/, ''));
  const m = String(h.agent_type || '').match(/(?:^|:)step-(\d)/);
  if (!m) return;
  const n = Number(m[1]);
  const slug = L.currentSlug(h.session_id);
  const st = slug ? L.readStatus(slug) : null; if (!st) return;
  // Diagnostic: record which fields the hook input carried, so a zero count can be explained.
  fs.appendFileSync(path.join(L.taskDir(slug), 'tokens.log'), [L.nowIso(), h.agent_type, 'input-keys', Object.keys(h).join(','), h.agent_transcript_path || '', h.transcript_path || ''].join('\t') + '\n');
  const own = h.agent_transcript_path && fs.existsSync(h.agent_transcript_path);
  const file = own ? h.agent_transcript_path : h.transcript_path;
  if (!file || !fs.existsSync(file)) return;
  const since = own ? 0 : Date.parse(st.steps[n].started_at || 0);
  let total = 0;
  const br = { input: 0, output: 0, cache_read: 0, cache_create: 0, calls: 0 };
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch (_) { continue; }
    const u = e.message && e.message.usage; if (!u) continue;
    if (!own) {
      const ts = Date.parse(e.timestamp || 0);
      if (ts && ts < since) continue;
      if (h.agent_id && e.agentId && e.agentId !== h.agent_id) continue;
    }
    br.input += u.input_tokens || 0; br.output += u.output_tokens || 0;
    br.cache_read += u.cache_read_input_tokens || 0; br.cache_create += u.cache_creation_input_tokens || 0; br.calls++;
    total += (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
  }
  if (!total) return;
  // total = billed tokens summed over every API call (cache reads count once per call), so it grows with turns, not just with new text.
  st.steps[n].tokens_approx = (st.steps[n].tokens_approx || 0) + total;
  st.steps[n].tokens_breakdown = br;
  st.steps[n].tokens_source = own ? 'agent-transcript' : 'main-transcript-window';
  L.writeStatus(st, slug);
  fs.appendFileSync(path.join(L.taskDir(slug), 'tokens.log'), [L.nowIso(), h.agent_type, total, st.steps[n].tokens_source].join('\t') + '\n');
}
