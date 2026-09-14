# Review and audit sources

What drives the reviewer (step 7), the tester (step 8) and the auditors (step 9), and where each piece came from. Verified 2026-09-14 by fetching each repository; licences quoted from the repo.

## Vendored (permissive licences, text lives in `vendor/`)

| Source | Licence | Pinned | What we use | Where |
|---|---|---|---|---|
| alibaba/open-code-review | Apache-2.0 | v1.12.0, `1f5caf4` | five review dimensions; Python and TS/React defect checklists; severity and category taxonomy; coverage accounting (every file reviewed or skipped with reason); precision over recall | steps 7, 9 |
| anthropics/claude-code-security-review | MIT | `0c6a49f` (2026-02-11) | security audit method: categories, three-phase methodology, confidence bar (report only at 0.8 and above), hard exclusions | step 7 security axis, step 9 cross-check |
| microsoft/code-with-engineering-playbook | MIT (code) + CC-BY-4.0 (docs) | `016770e` (2025-09-26) | Python and JavaScript/TypeScript review recipes; reviewer guidance | step 7 |
| obra/superpowers | MIT | v6.3.0, `b36e082` | verification-before-completion (no claim of done without fresh evidence); requesting-code-review severity gating | steps 6 exit, 9 |
| mattpocock/skills | MIT | `3cca18b` | two-axis review (standards, spec), Fowler smell baseline; grilling; tracer-bullet tickets | steps 0, 2, 7 |
| dietrichgebert/ponytail | MIT | v4.9.0, `356918e` | YAGNI ladder; ponytail-review over-engineering pass; debt ledger | steps 2, 5, 6, 7, 4 |

## Reference only (share-alike or restrictive licence; not copied into the plugin)

Agents may consult these by URL when a finding touches their area. Their text is not vendored because CC-BY-SA would license our artifacts virally, and the Semgrep rules licence forbids redistribution.

| Source | Licence | Why it matters | Use |
|---|---|---|---|
| trailofbits/skills | CC-BY-SA-4.0 | differential-review (diff-scoped audit), variant-analysis (find the other instances of a bug), post-patch-validation, vulnerability triage | step 9 cross-check: after confirming a bug, look for its variants |
| OWASP/CheatSheetSeries | CC-BY-SA-4.0 | SQL injection, mass assignment, CSRF, authorization, Next.js cheat sheets | step 7 security axis when a finding needs a canonical fix |
| OWASP/ASVS 5.0 | CC-BY-SA-4.0 | machine-readable requirement list (CSV) usable as a coverage matrix | step 9 for auth-heavy tasks |
| semgrep/semgrep-rules | Semgrep Rules License v1.0 | `python/flask/security/*` rule packs (injection, XSS, open redirect, deserialization) | internal use only; may be run locally with `semgrep`, never redistributed |

## Skipped

- google/eng-practices: archived 2025-11-21; its content is echoed by the Microsoft playbook.
- anthropics/skills: no review or audit skill in the repo.
- github/awesome-copilot: generic review instructions only, duplicates mattpocock.
- matthews-wong token-budget-tracker: a session nudge, not a counter.

## How the pieces combine in step 7

1. Coverage checklist of every diff file (open-code-review).
2. Standards axis (THH-CODE-STANDARDS) and spec axis (mattpocock) with the Fowler smell baseline.
3. Defects axis: five dimensions plus the per-language checklists (open-code-review, Microsoft recipes), precision over recall.
4. Security axis: Anthropic method, confidence at 0.8 or above, hard exclusions.
5. Ponytail-review for over-engineering.
6. Findings carry severity and category; critical, high and medium go to the fixer; max three rounds.

Step 9 repeats the dimensions over the whole task, then a fresh agent hunts false positives (Anthropic confidence bar) and misses (dimensions as the list; Trail of Bits variant analysis by reference), and verification-before-completion gates the ship call on fresh evidence.
