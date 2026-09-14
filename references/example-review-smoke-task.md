# Review: Plugin smoke test: version endpoint

## Result

**clean after 1 round.**

total_files 6, reviewed_files 6, skipped_files 0, coverage_rate 100%.

Diff: `thh-backend` worktree `C:\thehirehub\worktrees\plugin-smoke-test-version-endpoint-thh-backend`,
branch `feat/plugin-smoke-test-version-endpoint`, base `bc38aec133`, HEAD after review `ff99f6f1`.

No critical, no high, no spec misses, no security findings at or above confidence 0.8. One
medium (test coverage) and three low findings were raised in round 1 and all four were fixed;
the re-review of the changed hunks is clean.

### Coverage checklist (built before reviewing)

| # | file | status | outcome |
|---|---|---|---|
| 1 | `app.py` | modified (+2) | reviewed |
| 2 | `env.example` | modified (+12) | reviewed |
| 3 | `services/health/__init__.py` | added (0 bytes) | reviewed (empty package marker, matches `tests/common/__init__.py`) |
| 4 | `services/health/routes.py` | added (+63) | reviewed |
| 5 | `tests/health/__init__.py` | added (0 bytes) | reviewed (empty package marker) |
| 6 | `tests/health/test_version.py` | added (+93, now +95) | reviewed twice (round 1 + re-review) |

Batches: Python backend (1, 3, 4), Python tests (5, 6), config/docs (2). No frontend files in
the diff (`ui: no`).

## Findings

### Critical
None.

### High
None.

### Medium

**M1 | `tests/health/test_version.py:72-74` | category: test | dimension: test coverage (boundary conditions), U-19 | RESOLVED**

What: the empty-string `GIT_SHA` branch had no test, and this diff is what makes empty the
*default deployed value*. `env.example:301` (new here) ships `GIT_SHA=` with no value, and
`app.py:41` calls `load_dotenv()`, so a deployment copying `env.example` to `.env` gets
`os.getenv("GIT_SHA") == ""`, not `None`. `services/health/routes.py:33-34` handles that with a
truthiness check, which is exactly what plan.md specifies: *"sha chain: `os.getenv("GIT_SHA")`
if non-empty -> verbatim"*. The spec branch is real, it is the common deployed case, and
nothing pinned it: a regression to `if sha is None:` would serve `{"sha": ""}` on every server
using the example file with no test going red.

Resolution: `test_git_fallback` now sets `GIT_SHA` to `""` instead of deleting it, with a
why-comment naming `env.example` as the source of the empty value. Zero net test cases; the
unset path stays covered by `test_unknown_path:58`. Verified at `test_version.py:72-82`.

### Low

**L1 | `tests/health/test_version.py:23-24` (pre-fix) | category: standards | rule U-07 (backend checklist: "No conditional that cannot be false"), U-12 | RESOLVED**

What: `if "health" not in app.blueprints:` could never be false. The `app` fixture is
function-scoped and constructs `Flask(__name__)` on the line above, so `app.blueprints` was
always empty at the test. Dead defensive branch, copied verbatim from the plan's sanctioned
breadcrumb (`tests/companies/test_check_company_exists.py:21-22`) - U-20 pulled one way, U-07
and U-03 ("never cite an existing violation as house style") the other.

Resolution: guard deleted, `app.register_blueprint(...)` dedented. `test_version.py:20-25`.

**L2 | `tests/health/test_version.py:75` (pre-fix) | category: maintainability | ponytail `stdlib:` | RESOLVED**

What: `type("StubResult", (), {"stdout": "b" * 40 + "\n"})()` hand-rolled a one-attribute
object the standard library ships.

Resolution: `from types import SimpleNamespace` at module top (U-21, stdlib import group) and
`stub_result = SimpleNamespace(stdout="b" * 40 + "\n")`. `test_version.py:11, 76`.

**L3 | `env.example:294` (pre-fix) | category: documentation | rule U-10 | RESOLVED**

What: the ops comment said *"the route reads them at request time"* - accurate about the
import-time-versus-request-time distinction, incomplete about the consequence. The value is
memoised per worker process (`functools.cache`, `services/health/routes.py:30`), so changing
the var needs a restart to take effect, and an ops reader of this block is precisely the person
who would assume otherwise.

Resolution: now reads "the route reads them on its first request in each worker process and
caches the result for that process's lifetime", rewrapped to the block width, hyphens only
(U-22). `env.example:294-296`.

### Checked and cleared (recorded so they are not re-raised)

- `from __future__ import annotations` in both new files: house pattern, matches both plan
  breadcrumbs (`services/fx/routes.py:10`, `tests/companies/test_check_company_exists.py:6`).
  U-20 satisfied.
- Blanket `except Exception` at `services/health/routes.py:45`: normally U-13, but it is the
  plan's explicit v2 amendment (always-200 contract; any uncaught class on an `/api*` path
  becomes a 500 via `app.py:316-325`), the house shell-out convention is cited, and the comment
  names the three expected classes. Documented, not swallowed.
- No logger in the new module: the plan's deliberate U-07-over-U-23 call; zero log statements exist.
- No `_err`, no `crud.py`, no `models.py` in `services/health/`: the domain has no error path
  and no DB. U-06 and B-02 respected trivially.
- B-72: `services/health/routes.py:62` carries the public-by-design reason on the handler. The
  gate that would have needed exempting does not cover this path - `_SUB_GATE_PREFIXES`
  (`app.py:371-383`) contains no `/api/health`, and `app.py:409` returns early for non-matching
  paths. Read and verified this session.
- `resolve_version()` returns a cached mutable dict: a deliberate, documented process-lifetime
  cache with no mutation site anywhere in the diff. Not flagged (python-rules explicitly
  excludes documented caches).
- `patch.object(health_routes.subprocess, "run", ...)`: resolves to the same object as the
  plan's `patch("services.health.routes.subprocess.run")`, and `patch` restores it. Not a finding.
- No em-dashes in any new line (U-22). `env.example:286` has one, but it is pre-existing and
  outside the diff (U-02: a note, not a blocker; the diff does not make it worse).
- Handler docstrings are single-line prose with no `---` fence, so flasgger's dev-mode parse
  (`app.py:210-226`, `rule_filter: lambda rule: True`) is safe.
- Line length in tests: the repo has no linter or formatter (standards 1.10), and line length
  is tooling-enforceable, so it is out of scope for this review.

## Spec findings

None. Every plan.md "## Files" entry is implemented as written, and nothing outside that list
is touched.

- `GET /api/health/version`, envelope `{"success": true, "data": {"sha", "built_at"}}`, always
  200: `services/health/routes.py:60-63`. Matches plan "## API contracts" and brief Done means 1.
- SHA chain env -> `git rev-parse HEAD` -> `"unknown"`, `functools.cache`, `_REPO_ROOT` via
  `parents[2]`, `timeout=2`, `check=True`, `cwd` pinned: `routes.py:27-57`. Matches plan Item 1
  step 2 line by line, including the v2 blanket-except amendment.
- `built_at` chain env -> `"unknown"`, no invented fallback: `routes.py:55`. Assumption 1 held,
  Escalation 1 respected.
- Registration: `app.py:124` import beside the other service imports, `app.py:530`
  `register_blueprint` at the end of the block. Matches Item 1 step 3. `_SUB_GATE_PREFIXES`, the
  `/health` Docker route, CORS and limiter config are all untouched (Escalation 2 respected).
- `env.example` block carries all three mandated comment legs: (a) deploy/CI injects them and
  the route reads them, (b) nothing in the deploy sets either var today so servers report
  "unknown", (c) the endpoint is on the BACKEND origin and the frontend origin 404s `/version`.
  Matches Item 2 step 3. Appended at true EOF; the plan's "line 303" was a stale number (the
  file is 289 lines on this checkout) and the plan's own parenthetical "(EOF)" governs.
- Tests: all four planned cases present (`test_env_var_path`, `test_unknown_path`,
  `test_git_fallback`, `test_cached_for_process_lifetime`) plus the mandated autouse
  `cache_clear` fixture. `app.py` is not imported by the tests, per Item 1 step 4.
- Escalations 1, 3, 4, 5 and 6 all respected: no `built_at` fallback beyond "unknown", no new
  dependency, no Alembic revision, no frontend file, no auth decorator, no error-shape, no
  deploy wiring (Dockerfile, docker-compose.yml, entrypoint.sh, `.github/` all untouched).
- No scope creep: 6 files changed, all plan-listed.

Verification evidence (U-16, B-58, B-59, U-17), from `execution-log.md:33-40` and the round 1
fixer run:
- `C:\thhvenv\Scripts\python.exe -m pytest tests/health -q` -> `4 passed in 0.14s`, before and
  after the review fixes. New area, so its own baseline is trivially green.
- Real route: booted `python app.py` in the worktree, `curl -s -i http://localhost:5000/api/health/version`
  with no Authorization header -> `HTTP/1.1 200 OK`,
  `{"data": {"built_at": "unknown", "sha": "bc38aec133e4e17cfb58d07262a58cbefbabb20f"}, "success": true}`.
  The returned sha equals the branch base commit, which independently confirms plan Assumption 6
  (`parents[2]` really is the repo root) and that the git fallback works from a git worktree.

## Security axis

No findings at or above confidence 0.8. Traced the only new surface end to end:

- `GET /api/health/version` takes no params, no body and reads no headers. There is no user
  input to trace into a sensitive operation.
- `subprocess.run` (`routes.py:36-43`) uses an argument list, no `shell=True`, a literal argv
  and a module-constant `cwd`. No attacker-controlled value reaches it. Command injection is
  not possible.
- Response body is two strings from `os.getenv` or `git rev-parse`. No PII, no secret, no
  tenant data, and the module logs nothing (U-25 trivially satisfied).
- Unauthenticated by explicit brief decision (Q1), and the handler states why (B-72). Build-SHA
  disclosure on an ops endpoint is the specified behaviour, not a deviation from the project's
  security model; confidence of real exploitability is well below the reporting threshold.
- No secret added to code or fixtures; the two new env keys ship valueless in `env.example`
  (B-62, B-63 satisfied). They are build metadata, not credentials.

## Ponytail-review (final)

Round 1 raised:
- `tests/health/test_version.py:L23-24: shrink: guard that can never be false on a per-test Flask app. Unindent the register call, 1 line.` - applied.
- `tests/health/test_version.py:L75: stdlib: hand-rolled one-attribute class via type(). types.SimpleNamespace(stdout=...).` - applied.

Final state: **Lean already. Ship.**
`services/health/routes.py` is 63 lines of which 20 are mandated why-comments (the blanket-catch
rationale at L46-52, the public-by-design and cache-lifetime docstring at L1-10, the
`_REPO_ROOT` note at L23-26); U-10 requires them, so they are not bloat. `env.example`, `app.py`
and both `__init__.py` files have nothing to cut. The four tests are the ponytail minimum, never
flagged.

`net: -0 lines possible.`

## Skipped files

None.

## Rounds

### Round 1 (start commit `6b4e2749`)
Findings: 0 critical, 0 high, 1 medium (M1 test coverage), 3 low (L1 standards, L2
maintainability, L3 documentation). Dispatched to `step-7-fix` with the exact file, line, rule
and replacement text for each.

Fixer changed 2 files: `tests/health/test_version.py` (lines 11, 20-25, 72-76) and
`env.example` (lines 294-296). Commit `ff99f6f1`. Reported `4 passed in 0.14s`.

Re-review of the changed hunks only: **clean.** All four fixes landed verbatim; no new finding
introduced; the empty-string branch is now pinned and the unset branch remains covered by
`test_unknown_path`. `services/health/routes.py`, `app.py` and both `__init__.py` files were not
touched by the fixer, so they needed no re-review.

### Round 2
Not required. Review closed clean after round 1.
