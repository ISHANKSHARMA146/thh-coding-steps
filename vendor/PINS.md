# Vendored third-party sources (all MIT)

| Source | Commit | Files | Used by |
|---|---|---|---|
| https://github.com/mattpocock/skills | 3cca18b368ae95cdbdebbff572ccafa662551015 | grilling, grill-me, to-tickets, implement, code-review SKILL.md | steps 0, 2, 6, 7 |
| https://github.com/dietrichgebert/ponytail | 356918eba965ee1eac64bd3a7f0dd02108350de5 (plugin v4.9.0) | ponytail, ponytail-review, ponytail-debt SKILL.md | steps 2, 5, 6, 7, 4 (debt ledger) |
| https://github.com/matthews-wong/claude-code-plugins | 0c6de569dfa442393daa2fdfbb345a4f53acb71d | verify-before-review/scripts/verify.sh (pattern only; scripts/verify.js is the THH-specific rewrite) | step 6 exit |

Copied verbatim on 2026-09-14. Re-vendor by checking out the pinned commit, not the default branch.
| https://github.com/alibaba/open-code-review | 1f5caf4d5b7d5324c6e4c836c971136e4010192e (release v1.12.0, Apache-2.0) | rule_docs/default.md -> review-dimensions.md, python.md -> python-rules.md, ts_js_tsx_jsx.md -> ts-react-rules.md, github_workflows.md, skills/open-code-review-delegate/SKILL.md -> delegate.SKILL.md, plugins/.../qca/system-prompt.md -> reviewer-system-prompt.md | steps 7, 9 (dimensions, per-language checklists, severity/category taxonomy, coverage accounting, precision-over-recall) |
| https://github.com/anthropics/claude-code-security-review | 0c6a49f1fa56a1d472575da86a94dbc1edb78eda (MIT) | .claude/commands/security-review.md, claudecode/prompts.py, claudecode/findings_filter.py (kept verbatim for provenance); security-audit-prompt.md is our markdown extraction | step 7 security axis, step 9 cross-check |
| https://github.com/microsoft/code-with-engineering-playbook | 016770e43d8a75be87b98c000c049f07c4a6e6f8 (MIT code, CC-BY-4.0 docs) | docs/code-reviews/recipes/python.md, javascript-and-typescript.md, process-guidance/reviewer-guidance.md | step 7 |
| https://github.com/obra/superpowers | b36e0829c6d0140e93cfef2ca599b1b07d4a7797 (v6.3.0, MIT) | skills/requesting-code-review/SKILL.md, skills/verification-before-completion/SKILL.md | steps 6, 9 |
