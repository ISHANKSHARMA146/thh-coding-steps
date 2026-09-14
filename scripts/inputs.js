#!/usr/bin/env node
'use strict';
// Prints exactly the inputs a step is allowed to see, for `!` injection at the top of its SKILL.md.
// Usage: inputs.js <step> [fix|crosscheck]
// Big things (repo trees, diffs) are written to the task dir and summarised, so the prompt stays bounded.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const L = require('./lib');

const n = Number(process.argv[2]); const role = process.argv[3] || 'main';
const slug = L.currentSlug(); const st = L.readStatus(slug); if (!st) process.exit(0);
const td = L.taskDir(slug); const ws = L.workspaceRoot();
const plugin = process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..');
const out = [];
const section = (title, body) => out.push('\n<<<<< ' + title + ' >>>>>\n' + (body || '(none)').trim());
const file = (name, label) => { const f = path.join(td, name); section(label || name, fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '(missing: ' + name + ')'); };
const sh = (c, cwd) => { try { return execSync(c, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return (e.stdout || '') + '\n(command failed: ' + c + ')'; } };
const standards = () => { const f = path.join(plugin, 'references', 'THH-CODE-STANDARDS.md'); section('THH-CODE-STANDARDS.md (' + f + ')', fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '(missing)'); };
const vendor = (rel) => { const f = path.join(plugin, 'vendor', rel); section('vendored: ' + rel, fs.existsSync(f) ? fs.readFileSync(f, 'utf8').replace(/^---[\s\S]*?---\s*/, '') : '(missing)'); };
const bounded = (label, text, name, keep) => {
  const lines = text.split('\n');
  if (lines.length <= keep) return section(label, text);
  fs.writeFileSync(path.join(td, name), text);
  section(label + ' (first ' + keep + ' of ' + lines.length + ' lines; full copy at ' + path.join(td, name) + ')', lines.slice(0, keep).join('\n'));
};
const repoTree = () => {
  for (const repo of st.repos) {
    const dir = path.join(ws, repo); if (!fs.existsSync(dir)) continue;
    const tree = sh('git ls-files', dir).split('\n').filter(l => l && !/^(graphify-out|audit-reports|docs\/|prompts\/|.*\.(png|jpg|svg|ico|lock|snap))/.test(l)).join('\n');
    bounded('repo tree: ' + repo + ' (git ls-files, noise filtered)', tree, 'repo-tree-' + repo + '.txt', 400);
  }
};
const diff = () => {
  for (const [repo, wt] of Object.entries(st.worktrees || {})) {
    if (!fs.existsSync(wt)) continue;
    const base = sh('git merge-base HEAD ' + (sh('git show-ref --verify --quiet refs/heads/dev && echo dev || echo HEAD~0', wt).trim() || 'HEAD'), wt).trim() || 'HEAD';
    const stat = sh('git status --short', wt) + '\n' + sh('git diff --stat ' + base, wt);
    section('diff stat: ' + repo + ' (worktree ' + wt + ', base ' + base.slice(0, 10) + ')', stat);
    const full = sh('git diff ' + base, wt) + '\n' + sh('git ls-files --others --exclude-standard', wt).split('\n').filter(Boolean).map(f => '### NEW FILE ' + f + '\n' + (fs.existsSync(path.join(wt, f)) && fs.statSync(path.join(wt, f)).size < 60000 ? fs.readFileSync(path.join(wt, f), 'utf8') : '(large or binary, read it in the worktree)')).join('\n');
    bounded('full diff: ' + repo, full, 'diff-' + repo + '.patch', 1500);
  }
};
const worktrees = () => section('task worktrees (all code reads/writes happen here)', Object.entries(st.worktrees || {}).map(([r, w]) => r + ' -> ' + w + ' (branch ' + st.branch + ')').join('\n') || '(none created yet; step 6 creates them)');
const hasRepo = (re) => (st.repos || []).some(r => re.test(r));
const changeNotes = () => { const c = st.steps[n] && st.steps[n].change_notes; if (c) section('CHANGE NOTES from the human for this re-run', c); };

section('task', 'slug: ' + slug + '\ntitle: ' + st.title + '\nui: ' + st.ui + '\nrepos: ' + st.repos.join(', ') + '\ntask dir: ' + td + '\nworkspace: ' + ws);
changeNotes();
switch (n) {
  case 1: file('brief.md'); break;
  case 2: file('brief.md'); file('research.md'); repoTree(); standards(); vendor('mattpocock/to-tickets.SKILL.md'); vendor('ponytail/ponytail.SKILL.md'); break;
  case 3: file('brief.md'); file('plan.md'); section('graph hint', 'Each repo has graphify-out/GRAPH_REPORT.md and graphify-out/graph.json (2026-08-20 snapshot; calls_api edges = frontend -> backend handler). Confirm in source.'); break;
  case 4: file('brief.md'); file('plan.md'); file('impact.md'); file('research.md'); break;
  case 5: {
    file('brief.md'); file('plan.md');
    const fe = path.join(ws, 'thh-frontend');
    section('design system entry points (thh-frontend)', ['src/app/globals.css', 'components.json', 'tailwind.config.ts', 'src/components/ui'].map(p => p + ': ' + (fs.existsSync(path.join(fe, p)) ? 'exists' : 'absent')).join('\n') + '\n' + sh('git ls-files src/components/ui src/app/globals.css', fe));
    vendor('ponytail/ponytail.SKILL.md'); break;
  }
  case 6: file('plan.md'); file('impact.md'); file('mockup.html'); standards(); worktrees(); vendor('ponytail/ponytail.SKILL.md'); vendor('superpowers/verification-before-completion.SKILL.md'); break;
  case 7: file('plan.md'); if (role === 'fix') file('review.md'); standards(); worktrees(); diff(); vendor('ponytail/ponytail-review.SKILL.md');
    if (role !== 'fix') {
      vendor('open-code-review/review-dimensions.md'); vendor('anthropic-security-review/security-audit-prompt.md'); vendor('microsoft-playbook/reviewer-guidance.md');
      if (hasRepo(/backend/)) { vendor('open-code-review/python-rules.md'); vendor('microsoft-playbook/python-review-recipe.md'); }
      if (hasRepo(/frontend/)) { vendor('open-code-review/ts-react-rules.md'); vendor('microsoft-playbook/ts-review-recipe.md'); }
    }
    break;
  case 8: file('brief.md'); file('mockup.html'); if (role === 'fix') { file('test-report.md'); file('plan.md'); file('impact.md'); } worktrees();
    section('how to run', 'Backend: C:\\thhvenv\\Scripts\\python.exe app.py in the backend worktree (port 5000). Frontend: npm run dev in the frontend worktree (port 3000). Backend first. Local DB is a staging clone; APP_ENV must stay development, BACKGROUND_WORKERS false.'); break;
  case 9: file('brief.md'); file('plan.md'); file('impact.md'); file('gaps.md'); file('review.md'); file('test-report.md'); file('execution-log.md'); if (role === 'crosscheck') file('audit.md'); worktrees(); diff();
    vendor('open-code-review/review-dimensions.md'); vendor('anthropic-security-review/security-audit-prompt.md'); vendor('superpowers/verification-before-completion.SKILL.md');
    if (hasRepo(/backend/)) vendor('open-code-review/python-rules.md'); if (hasRepo(/frontend/)) vendor('open-code-review/ts-react-rules.md');
    break;
}
process.stdout.write(out.join('\n') + '\n');
