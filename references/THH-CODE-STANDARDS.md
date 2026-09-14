# THH Code Standards

This is the project constitution for TheHireHub: one merged rulebook for the Flask backend and the Next.js frontend.
Every coding step, skill and agent workflow inherits it; where a repo document and this file disagree, say so rather than pick silently.
Read it as a review checklist as well as a writing guide: each rule has a stable ID you can cite in a finding.

Rule IDs: `U-nn` universal, `B-nn` backend, `F-nn` frontend. A source's own ID follows in parentheses.

---

## 0. Universal rules

Apply to both stacks.

- **U-01 Apply rules to what you touch.** When cleaning existing code, fix what the diff covers. Do not sweep the whole repo unless that is the task.
- **U-02 Review the diff, not the repo.** A pre-existing violation in a file you are reviewing is a note, not a blocker, unless the diff makes it worse.
- **U-03 Never cite an existing violation as house style.** Measured violation counts (sections 1.10 and 2.16) record debt, not precedent. Do not add to a count, and do not launch a repo-wide migration as a side quest.
- **U-04 One source of truth per concept.** One schema, one key factory, one fetch wrapper, one class-merge helper, one primitive per UI element, one CRUD method per query. Derive; do not duplicate. (fe-audit Golden 3)
- **U-05 Rule of three before abstracting.** Two similar blocks can wait. Abstract on the third real occurrence. Premature abstraction couples worse than a little duplication. (S2, components-structure)
- **U-06 No abstraction with a single caller.** A "flexible" factory, generic, provider or config object for one call site is a defect. Write the five lines.
- **U-07 Delete dead weight.** Methods whose body is only `raise NotImplementedError` or a deprecation notice, conditionals that cannot be false, store fields nothing reads, dead props, unused exports and deps, commented-out blocks. Update callers; do not keep them "for compatibility".
- **U-08 Do not delete a guard, fallback, workaround or commented block whose reason you have not established.** Comments explaining a non-obvious invariant stay.
- **U-09 No duplicate implementations of one job.** Two libraries, two services, or two endpoints doing the same thing is a defect: pick one, migrate, delete the other. (fe-audit Golden 5)
- **U-10 Comment why, never what.** Comment non-obvious invariants, constraints, algorithms, workarounds and decisions. No narration of what the next line plainly does, no docstring restating the function name. Match the file's existing comment density. (S4)
- **U-11 Names carry the meaning.** Methods named for the operation, not the URL or the table. Symbols greppable.
- **U-12 No defensive bloat.** No try-catch soup, no null checks on inputs the type system or the schema already guarantees, no `console.log` left in source, no empty `catch`. (S3)
- **U-13 Never swallow an error.** An exception path either handles the failure meaningfully or re-raises. A swallowed error reported as a success-shaped return is how data loss reaches the user.
- **U-14 Types are not optional.** `any` is a defect on the frontend; untyped dict-shuffling is its backend equivalent. Fix the type, do not bypass it. (S5)
- **U-15 Never build a query, URL or command by string concatenation of untrusted values.** Bound parameters and typed builders only.
- **U-16 Run the repo's own checks before calling work done, and paste the real output.** "The implementation looks correct" is not verification.
- **U-17 Exercise the real thing.** A passing type check or a direct function call proves shapes, not behaviour. Drive the real route or the real screen.
- **U-18 Report what you verified and what you did not.** Partial work is reported as partial.
- **U-19 Extend the neighbouring tests when you change logic in a directory that has them.**
- **U-20 Follow the breadcrumbs.** Before writing anything, open the nearest existing example of the same thing and match its shape, naming, tokens and file layout. The codebase is the spec. Consistency beats novelty. (fe-audit Golden 9)
- **U-21 Imports at module top,** except a deliberate, commented lazy import.
- **U-22 No em-dashes in user-facing copy or in prose docs.** Use commas, colons or parentheses. (anti-slop 3.1)

### 0.1 Logging and sensitive data

- **U-23 One logger per module, created once at module top.** Backend: `logger = logging.getLogger(__name__)`. That is the repo's dominant pattern (187 modules use `logging.getLogger`; only `services/sourcing/routes.py` uses `current_app.logger`, and it is the outlier). Never `print()` in service code, never a logger created inside a function, never a second logger name for the same module.
- **U-24 Levels mean something.** DEBUG is local detail. INFO is a completed state change worth auditing. WARNING is a handled degradation. ERROR is a failed operation, and inside an `except` it is `logger.exception(...)` so the traceback is attached (`app.py:323` does this correctly). CRITICAL only when the process cannot continue. An expected 404 or a validation failure is not an ERROR.
- **U-25 Log identifiers, never payloads.** Carry the structured context every line needs: request id, `user_id`, `company_id`, and the id of the entity acted on, passed as lazy `%s` arguments rather than interpolated into the message. Never log a JWT, the `thh_auth` cookie, an API key, a candidate name, email or phone number, resume or transcript text, or an LLM prompt or completion that contains any of those. If you need to see shape, log the count and the ids.

---

## 1. Backend (Flask 3, SQLAlchemy 2, Alembic, MySQL)

Domains live in `services/<domain>/` as `routes.py` (HTTP), `crud.py` (database), `models.py` (tables), plus domain modules.

The one-paragraph version: a request enters through `routes.py`. Routes parse, authorize, and orchestrate. `crud.py` is the only module that opens a database session. `models.py` declares tables and mirrors the live schema. Domain modules do the heavy work. Every schema or seed change is an Alembic revision, never a script. Nothing is done until the real route has been exercised and the area's tests pass.

### 1.1 Layer boundaries

**`routes.py` is the HTTP boundary and orchestrator.**

- **B-01** Routes parse request data, enforce auth, validate input, call CRUD and domain modules in order, and format the response. Read a handler top to bottom as: identity, authorisation, input, read, process, write, respond. If it does not read like that, the shape is wrong.
- **B-02** A route MUST NOT open a session: no `db.session`, no legacy connection, no cursor, no SQL. If a route needs a query that does not exist, add a CRUD method. Why: a query in a route is untestable without a request context, invisible to a data-access audit, unreusable, and usually arrives without the ownership filter a CRUD method would have had.
- **B-03** A route MUST NOT define a helper function inside a handler. Shared helpers are module-level private functions (`_err`, `_resolve_company`); anything with real logic belongs in a domain module. Why: rebuilt on every request, invisible to tests, and it always grows.
- **B-04** Keep a handler under about 50 lines. Past that, the orchestration is a domain module and the route calls it.
- **B-05** No provider SDK call inline in a handler.

**`crud.py` (and `*_crud.py`) is the only database layer.**

- **B-06** CRUD owns every session, query, commit and rollback.
- **B-07** CRUD MUST NOT import a domain module, and MUST NOT call another domain's CRUD. Routes orchestrate across domains; CRUD does not. Why: an import cycle waiting to happen, and it hides a cross-domain dependency from the route that is supposed to be orchestrating it.
- **B-08** CRUD returns plain `dict` / `list` / primitives. Never an ORM instance, `Row` or `Result`. Why: that leaks session lifetime past the layer, producing `DetachedInstanceError` far from the cause, and it lets a route mutate a persistent object that an unrelated later commit then flushes.

**`models.py`**

- **B-09** Table declarations only. No queries, no business logic.

**Domain modules** (`plan_ops.py`, `resume_parser.py`, `webhooks.py`). Two kinds, and the distinction is the rule:

- **B-10** *Pure processors* (LLM calls, object storage, file parsing, scoring, money math) take everything as arguments and return values. No CRUD import, no session, no `request`. These are the ones that stay testable.
- **B-11** *Orchestrators* run multi-step domain workflows. They MAY call CRUD classes. They MUST NOT open a session directly; a query one needs goes in `crud.py`.
- **B-12** Prefer a pure processor. Reach for an orchestrator only when a workflow has genuinely more than one step and more than one caller.

### 1.2 Database access

- **B-13** Import the shared instance, `from app_extensions import db`. Never construct an engine, session or connection.
- **B-14** Read through SQLAlchemy 2 style:

```python
obj  = db.session.get(Model, pk)                                   # by primary key
rows = db.session.scalars(select(Model).where(...).order_by(...)).all()
one  = db.session.scalars(select(Model).where(...).limit(1)).first()
```

- **B-15** Do not import another domain's model. Reach its table with parameterized `text()`. Why: importing couples the two domains' schemas, so an Alembic revision in one can break the other. The table name is the level the database already enforces.

```python
row = db.session.execute(
    text("SELECT id, name, region_code FROM companies WHERE id = :company_id"),
    {"company_id": company_id},
).mappings().first()
return dict(row) if row else None
```

- **B-16** Access rows dict-safely with `.mappings()`, never positionally by assumption. Why: without it, code that assumes tuples breaks when the cursor class changes, and code that zips column names against a dict silently yields a row where every value is the column *name*, surfacing far downstream as missing IDs.
- **B-17** Never build SQL with f-strings, `%` formatting or concatenation, inside `text()` or anywhere else. Bound parameters only, including the ones you believe are integers. Why: injection, and it defeats the statement cache.
- **B-18** Name the columns. No `SELECT *`.
- **B-19** Ownership and tenancy filters are present on every read scoped to a company or user. This is the filter most often missing.
- **B-20** Write path shape: every write path commits; every exception path rolls back **and** re-raises.

```python
try:
    obj = Model(...)
    db.session.add(obj)
    db.session.flush()          # only when the generated PK is needed
    new_id = obj.id
    db.session.commit()
except Exception:
    db.session.rollback()
    raise
```

- **B-21** `flush()` appears only where the generated PK is actually used.
- **B-22** Never `except: return None` on a write. Why: the caller cannot tell "no row" from "write failed", and a failed write gets reported to the user as a success.
- **B-23** Multi-table writes live in one CRUD method with one commit, not spread across a route that can fail between them.
- **B-24** CRUD methods are `@staticmethod` on a `*CRUD` class, converting to dicts at the boundary with the model's `to_dict()`.
- **B-25** A lookup miss returns `None` / `False`. Do not raise for "not found"; the route chooses the status code.
- **B-26** A CRUD docstring carries the constraint that is not visible in the query (for example why `company_id IS NULL` is there). That is the comment worth writing.

### 1.3 Routes, responses and CRUD shape

- **B-27** Every handler returns the same envelope, so a client never has to guess:

```python
{"success": True,  "data": {...}, "message": "optional human string"}
{"success": False, "error": {"code": "not_found", "message": "Job not found"}}
```

The `error` object with a machine-readable `code` is the contract (section 1.11). Older endpoints still return `"error": "a bare string"`; that is legacy, and anything you touch moves to the object form.

- **B-28** Return a real status code. Never 200 with an error body. 200 read/update/delete, 201 create, 400 validation, 401 unauthenticated, 403 authenticated but not permitted, 404 missing, 500 unexpected.
- **B-29** A permission failure is 403, not 404, unless hiding existence is the deliberate design, in which case say so in a comment.
- **B-30** A single module-level error helper keeps the error path from drifting:

```python
def _err(code: str, msg: str, status: int):
    return jsonify({"success": False, "error": {"code": code, "message": msg}}), status
```

`_err` is the only place an error code is attached. A handler that builds the error dict inline will drift.

- **B-31** No second endpoint that differs from an existing one only in which rows it returns. Branch on the caller's type inside the one handler and pick the CRUD method. Why: two endpoints drift apart independently.
- **B-32** No duplicated query logic across CRUD classes. One method, called twice.

### 1.4 Models

- **B-33** The model docstring is load-bearing: record every known divergence from the live schema, with its direction, so a future reader can tell "deliberate" from "drift". Why: a model that silently disagrees with the live table produces migrations that "fix" a column back to a shape production never had.
- **B-34** Cross-service references are a plain `Column(Integer)`, never a `ForeignKey` to a table another domain owns, with the relationship enforced in application code. Why: a cross-domain FK forces the two domains' revisions to be ordered relative to each other, and a drop in one can fail a migration in the other. Keep real `ForeignKey`s inside a single domain.
- **B-35** Reproduce legacy index and constraint names exactly in `__table_args__`. A renamed index is a migration nobody asked for. The shared `db` naming convention covers only objects created new and unnamed.
- **B-36** `to_dict()` lists fields explicitly, not `self.__dict__` or column introspection. It is the API's shape and should change deliberately.
- **B-37** Coerce at the boundary inside `to_dict()`: `TINYINT` to `int`, `Decimal` to `str`, `datetime` to ISO, so the JSON encoder never has to guess.

### 1.5 Migrations

Any schema or seed-data change is an Alembic revision under `migrations/versions/`. Not a script, not a manual `ALTER`, not "just this once on prod". If the repo carries its own migrations rules document, it is binding and wins over this file.

- **B-38** One linear chain. `down_revision` is the current head. Never a second head. Check before writing and re-check before merging: a branch that sat for a week is now stale.
- **B-39** Hand-write revisions; copy an existing revision as the template. Autogenerate is not trusted where models and DB have drifted. If it was used, every line was reviewed and spurious drift diffs deleted.
- **B-40** Additive: new columns are NULLable or defaulted, so existing rows and the currently-deployed code both stay valid.
- **B-41** Guarded and re-runnable: probe `information_schema` so a re-run against an already-migrated database is a no-op, not an error.
- **B-42** Order statements for auto-commit. MySQL DDL auto-commits, so there is no transactional rollback and a mid-revision failure leaves everything before it applied. Order so the failure state is re-runnable.
- **B-43** Destructive change takes two revisions: (A) add the replacement and dual-write, deploy, soak for a real rollout window; (B) back up with `CREATE TABLE x_bak AS SELECT ...` inside the drop revision itself, then drop. Why: shipping both at once means an application rollback lands on a schema that no longer has the column it needs.
- **B-44** Column `COMMENT` names the revision that added it. It is the only breadcrumb visible from `SHOW CREATE TABLE`.
- **B-45** `downgrade()` either genuinely reverses or `raise`s with a message. It does not silently pass. Forward-only is acceptable when stated.
- **B-46** Ship the model change and the revision together. A model change with no revision is drift; a revision with no model change means the model now lies about the table.
- **B-47** Never stamp a revision from automation, CI or an entrypoint. Stamping is a one-time human reconciliation with an explicit revision id, never `head`.
- **B-48** Never edit a merged revision. Somebody's database has already applied it. Ship a new one.
- **B-49** Filename is `<12-hex-revision>_<snake_case_summary>.py`, and the revision docstring says why, not what.
- **B-50** Fresh-database seeders are not migrations. They bootstrap an empty database and must not be used to change an existing one.
- **B-51** Large seed or content payloads keep the revision as the only entry point, with the content builder in a separate module imported lazily inside `upgrade()`.
- **B-52** Migrations run automatically on deploy, before the application starts, and a failing migration blocks the boot deliberately. Write revisions that fail loudly and can be re-run.

Template for a guarded revision:

```python
def _has_column(table: str, column: str) -> bool:
    conn = op.get_bind()
    return bool(conn.execute(
        text("SELECT COUNT(*) FROM information_schema.columns "
             "WHERE table_schema = DATABASE() AND table_name = :t AND column_name = :c"),
        {"t": table, "c": column},
    ).scalar())


def upgrade():
    if not _has_column("companies", "exit_interviews_enabled"):
        op.execute(
            "ALTER TABLE companies ADD COLUMN exit_interviews_enabled TINYINT(1) "
            "NOT NULL DEFAULT 0 COMMENT 'Admin-set. Alembic rev a1f4c8e2d370.'"
        )
```

### 1.6 Configuration that lives in the database

- **B-53** Where runtime behaviour is driven by a database row (LLM prompts, feature flags, pricing, templates), the row wins and the Python default is dead code in every deployed environment. Query the active row before believing the literal.
- **B-54** To change live behaviour, use the admin surface, or ship a revision that INSERTs a **new** versioned row (`version = max + 1`, `is_active = 1`) and deactivates the old one. Never `UPDATE` the active row in place. Why: that destroys the rollback path and silently overwrites a human's edit.
- **B-55** Anything that is a correctness or fairness bug when it drifts belongs in code, not in an editable row.

### 1.7 Cleaning: what to remove

- **B-56** `if result: ... else: error` where an early `if not result: return 404` reads straight through.
- **B-57** A second endpoint differing only in rows returned (see B-31), duplicated CRUD queries (B-32), single-caller abstractions (U-06), and `NotImplementedError` stubs (U-07).

### 1.8 Before calling backend work done

- **B-58** Run the repo's tests for the area you touched and paste the real output. Compare that area against its own before/after, not against a green suite.
- **B-59** Exercise the real route: a client request through the blueprint with a valid token, observing the real side effects (rows written, jobs queued, mail sent). Why: importing and calling the changed function bypasses routing, the auth decorator, request parsing and the route's own data resolution, which is exactly where the bugs are.
- **B-60** If a migration is involved, apply it to a real database and confirm the chain still has a single head.

### 1.9 Backend review checklist

Run against the diff (U-02).

**Layering**
- [ ] No `db.session`, connection, cursor or SQL string in `routes.py`. (B-02)
- [ ] No helper function defined inside a route handler. (B-03)
- [ ] No handler over about 50 lines. (B-04)
- [ ] `crud.py` imports no domain module and no other domain's CRUD. (B-07)
- [ ] A pure processor takes data as arguments and imports neither CRUD nor `request`. (B-10)
- [ ] An orchestrator calls CRUD but opens no session of its own. (B-11)
- [ ] `models.py` contains declarations only. (B-09)

**Queries**
- [ ] Every parameter is bound. No f-string, `%` or concatenation in any SQL. (B-17)
- [ ] Explicit column list. No `SELECT *`. (B-18)
- [ ] Another domain's table is reached via `text()`, not by importing its model. (B-15)
- [ ] Row access is dict-safe via `.mappings()`. (B-16)
- [ ] Ownership and tenancy filters present on every scoped read. (B-19)

**Writes**
- [ ] Every write path commits; every exception path rolls back and re-raises. (B-20)
- [ ] No `except: return None` hiding a failed write behind a "not found". (B-22)
- [ ] `flush()` only where the generated PK is used. (B-21)
- [ ] Multi-table writes in one CRUD method with one commit. (B-23)

**Return shapes**
- [ ] CRUD returns dicts / lists / primitives; no ORM instance, `Row` or `Result` crosses the boundary. (B-08)
- [ ] Lookup miss returns `None` / `False`; the route chooses the status code. (B-25)
- [ ] Response envelope is `{"success": ..., "data"/"error": ...}` with a real status code. (B-27, B-28)
- [ ] The `error` object carries a `code` from the known set, attached via `_err`. (B-65, B-67)
- [ ] 403 for "not permitted", 404 for "does not exist", deliberately chosen. (B-29)
- [ ] A list endpoint takes bounded `page` / `per_page` and returns `items` / `total` / `page` / `per_page`. (B-68 to B-71)

**Auth, secrets and logging**
- [ ] Every route has `@verify_auth_token`, or a commented reason it is public. (B-72)
- [ ] Role checks go through a helper, not an inline `role ==` comparison. (B-73)
- [ ] `company_id` scoping is in the CRUD WHERE clause, not in the route. (B-74)
- [ ] The deny path has a test. (B-75)
- [ ] No secret in code, migration or fixture; a new one is in `env.example` with no value. (B-62, B-63)
- [ ] No token, cookie, candidate PII, resume text or personal LLM prompt in a log line. (U-25)

**Models and migrations**
- [ ] A schema change has a matching revision, and a revision has a matching model change. (B-46)
- [ ] `down_revision` is the current head; the chain still has one head. (B-38)
- [ ] The revision is additive, guarded and re-runnable. (B-40, B-41)
- [ ] Statement ordering survives a mid-revision failure. (B-42)
- [ ] A drop is a second revision, after a soak window, with a backup. (B-43)
- [ ] `downgrade()` reverses or raises. (B-45)
- [ ] Cross-domain columns are plain `Integer`, not `ForeignKey`. (B-34)
- [ ] Legacy index and constraint names preserved verbatim. (B-35)
- [ ] Config-row changes INSERT a new version and deactivate the old. (B-54)
- [ ] No new script doing schema or seed work outside a revision. (B-38 to B-52)

**Minimalism and comments**
- [ ] No method whose body is only `raise NotImplementedError`. (U-07)
- [ ] No conditional that cannot be false. (U-07)
- [ ] No new endpoint differing from an existing one only in rows returned. (B-31)
- [ ] No abstraction introduced with a single caller. (U-06)
- [ ] Imports at module top, except a deliberate commented lazy import. (U-21)
- [ ] Non-obvious invariants explained, including why; density matches the file. (U-10)

### 1.10 Backend repo calibration: thh-backend

> Copied verbatim from `thh-code-backend/SKILL.md` section 10. Measured **2026-08-24**. Numbers drift; re-measure before quoting one.
> **If you are not working in `thh-backend`, everything in this section is an example of the format only.** Do not quote a path, command, version, count or table name from here as a fact about another codebase.

**Coordinates**

| | |
|---|---|
| Repo root | `C:\thehirehub\thh-backend` |
| Interpreter | `C:\thhvenv\Scripts\python.exe`, Python 3.12.10, not activated for you |
| App entry | `app.py`, 63 `register_blueprint` calls |
| Shared `db` | `app_extensions.py` |
| Migration entry | `migration_app.py` (Flask-Migrate) |
| Domains | `services/`, 49 dirs, 41 `routes.py`, 42 `crud.py`, 38 `models.py` |
| Migrations | `migrations/versions/`, 129 revisions |
| Binding migration rules | `migrations/MIGRATIONS.md`, wins over this file |
| Auth decorator | `verify_auth_token` in `services/user/crud.py` |
| Legacy connection | `database_connection/connection.py` (Flask-MySQLdb) |

`requirements.txt`: `alembic==1.16.4`, `Flask-SQLAlchemy==3.1.1`, `SQLAlchemy>=2.0.16,<3.0.0`.

**Commands**

```bash
C:\thhvenv\Scripts\python.exe -m pytest tests/<area> -q      # targeted tests
C:\thhvenv\Scripts\python.exe -m pytest tests -q             # full suite
C:\thhvenv\Scripts\python.exe app.py                         # dev server on :5000
C:\thhvenv\Scripts\flask.exe --app migration_app db current  # / heads / history / upgrade
```

No linter, formatter, type checker or CI in this repo. `pytest` is the only automated check, so it is the one that has to pass.

**Test baseline is not green.** `pytest tests`, 2026-08-24, per the repo's `CLAUDE.md`: **646 passed, 186 failed, 21 errors, 4 skipped** in about 10s. Dominant causes are environmental (`401 UNAUTHORIZED` where auth is not stubbed, and `RuntimeError: Working outside of application context`), not product bugs. Consequence: run the tests for the area you touched and compare that area against its own before/after. A red full suite is not your regression. `tests/conftest.py` stubs `flask_mysqldb`, the Google API client stack and `openai` with `MagicMock`, and sets test-only secrets so import-time guards do not raise.

**Measured divergences: existing violations, not precedent**

| Rule above | Violations on disk |
|---|---|
| Routes never open a session | **9** `services/*/routes.py` reference `db.session` |
| Only CRUD reaches the database | **53** non-route, non-CRUD modules import a CRUD class |
| No legacy connection in new code | **1**, `services/aira/crud.py` |

All 42 `crud.py` files use `db.session`; the ORM is the mainstream path. `app_extensions.py` states the position: the ORM "coexists with the legacy Flask-MySQLdb `mysql.connection`: services are ported one at a time, and both connection paths target the same DB."

**Do not add to any of these counts.** The 53 CRUD-importing modules are worth reading rather than condemning: most are orchestrators (`billing/plan_ops.py`, `billing/trial.py`, `billing/webhooks.py`, `candidate/rematch_service.py`), which section 1.1 permits. The ones that matter are pure processors that grew a CRUD import.

**Repo-specific facts**

- `install.txt`: 30 services carry one. A historical `CREATE TABLE` dump for reference, **not** an install path and **not** the source of truth. Never edit it to reflect a change; ship a revision.
- `graphify-out/`: generated map of every route, handler, CRUD function, service and model, cross-linked to the frontend pages that call them. Use it for "where does X live", "what calls Y", "what breaks if I change Z" before grepping. Snapshot 2026-08-20; confirm in source before acting, never write into it. `GRAPH_REPORT.md` (summary), `wiki/index.md` (per-community articles), `graph.json` (raw; `calls_api` = frontend to handler).
- **LLM prompts live in the database.** Every prompt-driven agent resolves through `services/llm_config/factory.get_agent_prompt`, which reads the active `master_instructions` row. `DEFAULT_PROMPTS` in the Python file is used only when no active row exists, and staging and production are both seeded. Editing prompt text in a Python file changes no deployed environment.
- **Cursor rule files in this repo are stale.** `.cursorrules` references `@../rules.md`, which does not exist anywhere in `C:\thehirehub`. Its content described the pre-ORM architecture. Do not follow it; this file supersedes it. The repo's own `CLAUDE.md` is current and does not conflict.
- **Verification quirk.** A real case from this repo: a reengagement hook read `job_id` from the route's return dict; a direct call supplied it and passed, while the live route's trimmed dict made the hook silently no-op. Exercise the route.

### 1.11 Secrets, and error codes

**Secrets**

- **B-61** Every secret comes from the environment. `load_dotenv()` is called exactly once, at boot (`app.py:41`); everything downstream reads the already-loaded values. Do not add a second `load_dotenv()` to a service module. A new secret gets one named accessor in the domain's config module, not a fresh `os.getenv` at each use site. (189 modules read `os.environ` / `os.getenv` directly, measured 2026-09-14. That is debt under U-03, not precedent.)
- **B-62** Never hardcode a credential, API key, token, connection string or webhook signing secret in Python, in an Alembic revision, in a test fixture or in a docstring. A revision that genuinely needs a secret reads it from the environment and raises when it is absent.
- **B-63** `.env` is never committed. A new secret means a matching key in `env.example` with no value, plus a comment saying how to obtain it, so a fresh checkout fails at boot naming the missing key instead of failing at runtime inside a provider call.
- **B-64** `env-backups/` holds real staging secrets and is off limits to agents: never read, copy, print or diff it. If you need a real value, ask a human.

**Error codes**

- **B-65** The `error` object carries a stable snake_case `code` beside the human `message` (B-27). The initial set, and a caller may rely on every one of them: `validation_error` (400), `unauthorized` (401), `forbidden` (403), `not_found` (404), `conflict` (409), `rate_limited` (429), `internal` (500). Add a code only when a client genuinely has to branch on it.
- **B-66** The `code` is the contract; the `message` is copy. Reword a message freely. Renaming or removing a code is a breaking change and the frontend caller changes in the same branch.
- **B-67** Attach codes only through `_err` (B-30). A handler assembling the error dict by hand is how a typo'd code reaches production silently.

### 1.12 Pagination contract

- **B-68** List endpoints paginate with `page` and `per_page`. That is the repo's dominant pattern (39 occurrences across `services/*/routes.py`, for example `services/candidate/routes.py:2001`). The `limit` / `offset` pairs elsewhere are legacy; do not add another.
- **B-69** Bound both. `page` defaults to 1 and is at least 1. `per_page` defaults to 20 and is capped at 100. Out of range is 400 `validation_error`, not a silent clamp. `services/candidate/routes.py:2018` caps `per_page` at 10000, which is not a bound; do not copy it.
- **B-70** The success payload under `data` is `{"items": [...], "total": n, "page": p, "per_page": n}`. `total` is the row count before the page slice, so the client can render the pager without a second call.
- **B-71** No unbounded list endpoint. An endpoint returning every row a tenant owns is a defect even while that tenant is small.

### 1.13 Authorization

- **B-72** Every route carries `@verify_auth_token`. Deny by default: an undecorated route is a finding, not an oversight. The only exceptions are endpoints that are public by design (provider webhooks with their own signature check, the public application form), and each states why in a comment on the handler.
- **B-73** Role checks go through one helper per role, applied under `@verify_auth_token`. `require_thh_admin` (`services/admin/routes.py:92`) is the shape to copy: it reads the acting user once, returns 403 with a code, and stashes the row on `request` for the handler. An inline `role == 'admin'` comparison inside a handler is a finding (14 such comparisons measured 2026-09-14).
- **B-74** Company scoping lives in CRUD, not in the route. The CRUD method takes `company_id` and puts it in the WHERE clause; the route supplies the acting user's company and never filters the returned rows itself. Why: a filter written in the route is absent for the next caller of the same CRUD method, which is exactly how B-19 gets violated.
- **B-75** Every authorization rule has a test for the **deny** path: a user of company A asking for company B's resource gets 403, or 404 where hiding existence is the deliberate choice (B-29). A test that only exercises the allow path proves nothing about the gate.

---

## 2. Frontend (Next.js 15 App Router, React 19, TypeScript, TanStack Query 5, Zustand 5, react-hook-form + Zod, Tailwind, shadcn/Radix)

The one-paragraph version: server data belongs to TanStack Query. Client state belongs to Zustand. Shareable view state belongs to the URL. Never two owners for the same value. All HTTP goes through the shared authenticated fetch wrapper, called from a service module that does nothing but transport and types. Components are server components until a hook or an event handler forces otherwise. TypeScript errors break the build; leave none behind.

### 2.1 State ownership

| Kind of value | Owner | Example |
|---|---|---|
| Anything the API is the source of truth for | TanStack Query | job list, candidate detail, credit balance, campaign report |
| Global client state shared across routes | Zustand | auth session, theme, sidebar open, feature tour |
| Local to one component or subtree | `useState` / `useReducer` | input value, hover, a toggle |
| Shareable, bookmarkable, survives refresh | URL search params | filters, search term, active tab, page, sort |
| Derived from any of the above | a plain function, a selector, or `useMemo` | filtered list, computed total |

- **F-01** One owner per value. A value with two owners will disagree with itself, and the bug reproduces once a week on somebody else's machine. If two owners seem to apply, it is almost always server state: default to TanStack Query. (state.md, D5, Golden 1)
- **F-02** Never copy API data into Zustand or `useState`. Derived view state (filters, selected row, tab) may live in URL params or Zustand; the *source* data may not. (D5)
- **F-03** New server reads go through `useQuery`. Do not add a fetch action to a store, and do not extend a store's existing fetch surface. A store holding `data + loading + error` for an endpoint is a migration candidate, not a pattern to copy.
- **F-04** Select the narrowest slice: `useStore((s) => s.field)`. Subscribing to the whole store re-renders on every unrelated field change.
- **F-05** Zustand v5: the selector equality-function second argument is gone. Multi-value selects use `useShallow` from `zustand/react/shallow`. (`createWithEqualityFn` in `zustand/traditional` only if a custom equality fn is genuinely needed.)
- **F-06** Zustand v5: import named, `import { create } from 'zustand'`. Export hooks and atomic selectors, never the raw store.
- **F-07** Never create a store inside a component. It re-creates on every render.
- **F-08** Update immutably. `set` merges shallowly; spread nested objects yourself.
- **F-09** Persist deliberately with `partialize`, per store that persists. The repo keeps 15 separate stores and is not migrating to one bound store, so each persisting store declares its own `partialize` rather than inheriting a shared one. Never persist tokens or server caches.
- **F-10** Derive computed values in selectors, not by storing duplicated derived state.
- **F-11** Add to the matching existing slice or store for a domain. Do not spin up a parallel store for the same domain.
- **F-12** Migrating a store read to a query, when the change is contained: (1) add a key factory and a `useQuery` in a `use<Domain>` file calling the same service method; (2) replace each call site; (3) replace every post-write `fetchX()` with `invalidateQueries`; (4) delete the store's field, action, loading flag, error flag and module-level dedup machinery in the same change; (5) type check, then exercise every screen that read the field. When the change is not contained, leave the store alone and say so. A store field and a query for the same value is worse than either alone.

### 2.2 Services and HTTP transport

- **F-13** A service module is transport and types only: build the URL, call the shared wrapper, parse, return typed data. No business logic, no derived or computed values, no formatting, no caching, no React. If a service function has `if`-branches that shape business outcomes, that logic belongs in the hook or a pure util. (D2)
- **F-14** A structured error class carrying `status` so callers can branch is allowed at the **query function layer only**: that is transport metadata, not business logic. The service itself still returns the envelope and does not throw (F-22). (D2)
- **F-15** No React import, no store import, no `queryClient` in a service. It must be callable from anywhere, including a test.
- **F-16** One object export per domain, methods named for the operation, not the URL.
- **F-17** Response interfaces live beside the call that produces them, in `services/<feature>/types.ts` or as `z.infer` of the request schema. Never hand-write a second interface mirroring a Zod schema or another service's type. (D4)
- **F-18** Every call goes through the shared `authenticatedFetch`. It carries token or cookie transport, a request timeout with its own message, the 401 / 402 / 403 side effects, generic user-facing copy that deliberately does not leak the API host, and bounded retry with backoff **for `GET` and `HEAD` only**. A raw `fetch` opts out of all of it silently.
- **F-19** Writes are never auto-retried, because they carry side effects. A retried availability save fires candidate emails twice. `options.retry` opts a specific call in or out; opting a write in needs an explicit idempotency argument in a comment.
- **F-20** `authenticatedFetch` and the `API_BASE_URL` resolution are defined once, in `utils/api`, and imported everywhere. Any file re-declaring `const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL...` or hand-rolling auth headers is a finding. (D1)
- **F-21** If a call needs behaviour the wrapper lacks, extend the wrapper. Do not fork it.
- **F-22** The service returns the `{ success, data, error }` result object and does not throw; callers branch. The conversion of a failed result into a thrown error happens in the query function, not in the service.
- **F-23** Errors surfaced to the user carry no URL, status code or the word "backend". Reuse the exported user-facing copy constants rather than writing new strings.
- **F-159** Branch on the error `code`, never on the message text (B-65). A check like `error.message.includes("not found")` breaks the moment somebody improves the copy. Where a legacy endpoint still returns a bare string, treat the missing code as `internal` and fix the endpoint rather than parsing prose.
- **F-24** A service file over about 400 lines is a defect. The cap binds **new services and net additions to existing ones**: adding lines to a file already over it is a finding even though the file itself is grandfathered. Split by sub-resource into a folder, with `index.ts` exposing only the public surface, and each file one cohesive resource. Split incrementally, never in one pass. (D3)

  **Known debt, exempt until a split is scheduled as its own task** (measured 2026-09-14, `git ls-files src/services | xargs wc -l`): `src/services/job-service/service.ts` **2,195** lines, `src/services/candidate-service/service.ts` **1,563**, `src/services/interview-service/service.ts` **1,509**. Do not cite these as precedent (U-03), do not grow them, and do not open the split as a side quest.

```
services/job/
  index.ts        // re-exports the public surface only (small, stable)
  list.ts  detail.ts  create.ts  applicants.ts  collaborators.ts
  types.ts        // shared Job/JobStatus types
```

### 2.3 Queries, keys and mutations

- **F-25** Components call a feature hook. Keep `useQuery`/`useMutation` and the key factory in a `use<Domain>` hook or a feature `queries.ts`, not scattered in components, and never call a service function directly from a component. (D-layer target shape)
- **F-26** The query function throws on a failed result rather than returning the `{ success: false }` envelope as data. Why: otherwise the query treats a failed request as successful data and the error surface disappears.

```ts
const { data, isLoading, error } = useQuery({
  queryKey: creditKeys.company(),
  queryFn: async () => {
    const res = await creditsService.getCompanyCredits();
    if (!res.success) throw new Error(res.error);
    return res.data!;
  },
});
```

- **F-27** Query keys come from an exported factory, one per feature, hierarchical arrays with the broadest segment first, exported beside the service it keys. No inline key literals at call sites. (D6)

```ts
export const jobKeys = {
  all: ['jobs'] as const,
  lists: () => [...jobKeys.all, 'list'] as const,
  list: (filters: JobFilters) => [...jobKeys.lists(), filters] as const,
  details: () => [...jobKeys.all, 'detail'] as const,
  detail: (id: string) => [...jobKeys.details(), id] as const,
};
```

Why a factory: prefix invalidation is meaningful because the hierarchy is real; the key exists in exactly one place, so renaming cannot desynchronise a query from its invalidation; and every parameter the query function reads is forced into the key by the signature.

- **F-28** Every value the query function reads appears in the key. **A key missing a parameter serves one user's data to another.**
- **F-29** One key casing convention across the app. Mixed `["jobCreationData", id]` beside `["exit-campaign", id]` means a key is eventually mistyped and the invalidation silently no-ops.
- **F-30** Never export a key constant from a component. The page that invalidates would have to import from a sibling component to do it.
- **F-31** Do not re-specify global defaults (`staleTime`, `retry`, `refetchOnWindowFocus`) per call. They are set once on the client instance. Override only with a comment saying why. The sanctioned override is F-32.
- **F-32** Set `staleTime` deliberately on a server-prefetched or hydrated query, because TanStack Query's own default is `0` and the query would refetch immediately on mount. (D7)
- **F-33** Define a reusable query with `queryOptions()` so one typed definition serves `useQuery`, `prefetchQuery`, `useSuspenseQuery` and `setQueryData`.
- **F-34** Mutations invalidate the narrowest key that is genuinely stale. Blanket-invalidating the root refetches screens nobody is looking at. (D9)
- **F-35** Do not hand-patch the cache after a mutation, and do not also write the result into a store. Use `setQueryData` only for a deliberate optimistic update. (D9)
- **F-36** An optimistic update has `onMutate` (cancel + snapshot + write), `onError` rollback, and `onSettled` invalidation. If you are not writing all three, do not write the optimistic update.
- **F-37** Prefetch on the server for first paint: a per-request `QueryClient`, `prefetchQuery`, `dehydrate`, and the client subtree wrapped in `HydrationBoundary`. Do not fetch-on-mount in a client component when the page is server-rendered. (D8)
- **F-38** For non-interactive data, fetch in a Server Component and skip React Query entirely. Use React Query for data that polls, updates in realtime, or is mutated and invalidated across many client components.
- **F-39** TanStack Query v5 API: single options object; `cacheTime` is `gcTime`; `keepPreviousData` is `placeholderData: keepPreviousData`; `useErrorBoundary` is `throwOnError`; `isInitialLoading` is `isLoading`; status `'loading'` is `'pending'`, and `isPending` means "no data yet".
- **F-40** `onSuccess` / `onError` / `onSettled` were removed from `useQuery` and remain only on `useMutation`. Derive in render for side effects on query data.
- **F-41** Pagination and infinite lists use `placeholderData: keepPreviousData` to avoid flashing between pages.
- **F-160** Paginated lists mirror the backend contract (B-68 to B-71): the service sends `page` and `per_page`, **both appear in the query key** (F-28, or page 2 serves page 1's rows from cache), and the hook reads `data.items` and `data.total`. Never fetch an unbounded list and paginate it in the browser.
- **F-42** No `useEffect` whose only job is to fetch on mount and set state. Why: it is a query without a cache, retry policy, deduplication or cancellation; it races on fast navigation and writes into an unmounted component.
- **F-43** No hand-rolled cache machinery: in-flight promise dedup, module-level minimum refetch intervals, manual `loading`/`error` triples for one endpoint. Every one of those is a cache feature the query client already provides. Replace with a query; do not tidy it in place.

### 2.4 Next.js 15 and the server boundary

- **F-44** Components are Server Components by default. They ship zero JS, can fetch data and read secrets. (Golden 2)
- **F-45** `"use client"` only when the file uses a React hook, an event handler prop, a browser API, or a library that does one of those internally. A component that takes props and returns markup stays a server component.
- **F-46** Put `"use client"` on the smallest interactive leaf, pushed as far down the tree as possible. The directive applies to the module **and everything it imports**, so a directive on a route file makes the whole page tree client, ships all of it, and forfeits server rendering for the static 90%.

```
X  page.tsx        "use client"    -> whole tree is client
     Header.tsx                       (needlessly client)
     StatsPanel.tsx                   (needlessly client)
     FilterBar.tsx                    (genuinely interactive)

OK page.tsx        server
     Header.tsx    server
     StatsPanel.tsx server
     FilterBar.tsx "use client"    -> only this one
```

- **F-47** A server component hands data to a client child as props. Props cross the boundary; functions and class instances do not. A client component cannot render an imported server component, but it can accept one via `children` (client wrapper, server children).
- **F-48** Never use `window`, `document` or `localStorage` in a file without `"use client"`.
- **F-49** `params`, `searchParams`, `cookies()`, `headers()`, `draftMode()` are async in Next 15. `await` them in a server component; `use(params)` in a client component. Destructuring directly is a build error. The codemod `npx @next/codemod@latest next-async-request-api .` migrates most call sites.
- **F-50** Fetch caching is opt-in, not the Next 14 default. State the caching intent explicitly: `{ next: { revalidate: 3600 } }`, `{ cache: 'force-cache' }`, or `{ cache: 'no-store' }`. Segment config (`export const revalidate`, `export const dynamic`) still works, and the smallest `revalidate` on a page governs the page.
- **F-51** GET Route Handlers are not cached by default. Add caching explicitly if needed. The Client Router Cache no longer caches page segments by default; opt back in with `experimental.staleTimes`.
- **F-52** **Every mutation goes through the client service layer and `authenticatedFetch` to Flask. No Server Actions, anywhere.** The product database sits behind Flask, so a Server Action would be a second transport to the same API with a second auth path. Route handlers under `src/app/api` remain only for work that must not reach the browser: secrets, redirects, provider webhooks. No pass-through proxy route that only forwards a call the client could make. The Zod schema on a form is UX; the real validation and authorization gate is the Flask route (B-72 to B-75), and it is not optional because the client validated first.
- **F-53** retired (ruling C3, 2026-09-14).
- **F-54** Only `page`, `layout`, `route`, `loading`, `error`, `not-found`, `template` and `default` are special. Colocating components, hooks and tests inside a route folder is encouraged.
- **F-55** Route groups `(marketing)` organize without affecting the URL; parallel routes `@slot` and intercepting routes `(.)` enable dashboards and modals. Layouts persist across navigation; templates re-mount. Use layouts for shells.
- **F-56** Stream with `loading.tsx` or `<Suspense>` so the shell paints immediately.
- **F-57** Use the built-ins instead of custom: `next/image` (set `sizes`, `priority` on the LCP image), `next/font`, `next/link`, and `metadata` / `generateMetadata` rather than manual `<head>` injection.
- **F-58** `middleware.ts` at the root for auth gating and rewrites. Keep it light (Edge runtime, no Node APIs) and scope it with a `matcher`.
- **F-59** `NEXT_PUBLIC_*` only for values safe to expose to the browser. Secrets carry no prefix, are read only in Server Components, Actions or route handlers, and are validated in one place. Never import server env into a client component.

### 2.5 React 19 components and hooks

- **F-60** `ref` is a normal prop. No `forwardRef`. Delete `forwardRef` wrappers when you touch them.
- **F-61** The React Compiler is **not** enabled in `thh-frontend` (verified 2026-09-14: no `reactCompiler` in `next.config.ts`, no `babel-plugin-react-compiler` in `package.json`). So: memoize only measured hot paths and stable callbacks passed to memoized children. Every other hand-written `useMemo`, `useCallback` or `React.memo` is a finding. The fix for re-renders is correct state placement and narrow selectors, not a memo.
- **F-62** `useOptimistic` for instant mutation feedback, and async functions inside `startTransition` for automatic pending and error handling. `useActionState` and `useFormStatus` are Server Action machinery and have no place here (F-52); forms go through react-hook-form plus a `useMutation`.
- **F-63** `use()` reads a promise during render (Suspense-integrated) and can read context conditionally. Do not create the promise inside the component; pass it in or get it from a cache.
- **F-64** Render document metadata in components where useful: `<title>`, `<meta>`, `<link>` hoist to `<head>`. Context provider shorthand is `<ThemeContext value={...}>`.
- **F-65** `propTypes` and `defaultProps` on function components, legacy string refs and the legacy context API are removed. Replace them when found; use default parameters.
- **F-66** Derive state during render instead of duplicating it in `useState` plus `useEffect`. An effect that only syncs derived state is a smell.
- **F-67** List keys are stable ids. Never the array index for a dynamic list. (S8)
- **F-68** Two kinds of custom hook, and it is worth knowing which you are writing. *Data hooks* wrap a `useQuery`/`useMutation` for one domain concern and are the sanctioned home of a query key. *Derivation hooks* read a store or context and compute a view, with no fetching.
- **F-69** A derivation hook selects a slice rather than the whole store and defaults deliberately. Write the reasoning into the doc comment; it is not recoverable from the code. Example: `?? true` so a frontend deployed ahead of the backend keeps today's behaviour rather than silently disabling a feature.
- **F-70** A component that fetches, transforms and renders is three responsibilities. Extract the fetch into a hook and the transform into a pure function that can be unit-tested without rendering.
- **F-71** Props are the API. An optional prop that is really required, or a boolean that is really an enum of three states, will be misused.
- **F-72** Every screen backed by a query renders four states: **loading** (a skeleton matching the final layout so the page does not jump), **error** (the message plus a way to retry, not a blank area), **empty** (distinct from loading, and often the most-seen screen in a new account), and **success**. The empty state is the one reviewers forget and users hit first. (S9)
- **F-73** Accessibility, at minimum: interactive things are `<button>` / `<a>`, never `<div onClick>`; every input has an associated label; focus is visible and an outline removed is an outline replaced; icon-only controls have an accessible name; images have `alt`. Prefer the semantic element or the Radix primitive, which handles a11y for you. (S10)
- **F-74** Contrast meets WCAG AA: 4.5:1 body text, 3:1 large headings. The `ink` / `paper` tokens already satisfy this; hand-picked grays usually do not.

### 2.6 Forms

react-hook-form with a Zod resolver. The schema is the single definition of both the validation and the type.

```ts
export const jobSchema = z.object({
  title: z.string().min(1, "Enter a job title"),
  location: z.string().min(1),
  salaryMin: z.coerce.number().int().nonnegative().optional(),
});
export type JobInput = z.infer<typeof jobSchema>;   // never hand-write this type
```

- **F-75** Infer the type from the schema. A hand-written interface beside a Zod schema is two definitions that will disagree, and the compiler will not tell you which one the server believes.
- **F-76** Always pass `defaultValues`. It prevents uncontrolled-to-controlled warnings and makes `reset()` reliable.
- **F-77** Validate on the boundary the user actually crosses: `mode: "onTouched"` (after first blur) or on submit. Firing every rule on the first keystroke tells someone their email is invalid while they are typing the second character.
- **F-78** Use `register` for native inputs (uncontrolled, fast, fewer re-renders). Use `Controller` only for controlled components that do not expose a ref or `onChange` the RHF way: shadcn `Select`, `react-select`, `react-phone-number-input`, date pickers, OTP inputs.
- **F-79** Prefer the shadcn `Form` primitives (`Form`, `FormField`, `FormItem`, `FormControl`, `FormMessage`); they wire labels, error messages and aria attributes. Do not hand-roll error display.
- **F-80** Coerce at the schema boundary (`z.coerce.number()`, `z.coerce.date()`) so inputs that yield strings validate cleanly.
- **F-81** Error messages are user-facing copy. Write sentences a user can act on: "Enter a valid email address", not "Invalid email".
- **F-82** Submit through a mutation, invalidate on success, `reset()` after success, and surface server errors with `setError`. Do not also write the response into a store.
- **F-83** Disable the submit control while pending and say what is happening. A form that can be double-submitted will be.
- **F-84** retired (ruling C3, 2026-09-14). The real gate is the Flask route, not a reused TypeScript schema (F-52).
- **F-85** Pick one form system per form. Do not mix React 19 action hooks and react-hook-form controllers on the same fields.
- **F-86** Keep field-level components small and reuse them across forms instead of repeating `FormField` boilerplate.
- **F-87b** Schemas are reviewable in one place, not inline in the component. The server-facing shape of a form belongs with the other schemas (`src/lib/schemas/` in this repo), or colocated in the feature folder where that feature already owns its schema file. Pick one per feature and do not split a schema across both.
- **F-87** Repo specifics: password strength uses `zxcvbn` (show a meter, do not block on it server-side); phone uses `react-phone-number-input` + `libphonenumber-js`, stored E.164.

### 2.7 Styling and the design system

- **F-88** Tailwind v4 has no `tailwind.config.js`. Entry is `@import "tailwindcss";` and design tokens live in CSS under `@theme` as custom properties, where the namespace prefix determines the utility. Migrate any leftover config theme values into `@theme`.
- **F-89** Content detection is automatic; there is no `content` array. Scan an external package with `@source`.
- **F-90** Tailwind v4 renames to fix when found: `shadow-sm` to `shadow-xs`, `shadow` to `shadow-sm`, `rounded-sm` to `rounded-xs`, `rounded` to `rounded-sm` (and similar for blur); `bg-gradient-to-r` to `bg-linear-to-r`; opacity uses slash syntax (`bg-black/50`); `size-4` sets width and height together; container queries are built in via `@container`.
- **F-91** Merge and condition classes with `cn()` (clsx + tailwind-merge). Never build classes with template-literal concatenation. Why: `cn()` resolves conflicts such as `p-2` against `p-4` correctly.
- **F-92** Express component variants with `cva`, not conditional `className` soup assembled at three call sites. It collapses many branches into one declarative table.
- **F-93** Compose with Radix `Slot` / `asChild` to attach behaviour to arbitrary children instead of duplicating wrappers. Keep primitives dumb and reusable; put feature logic in the feature component.
- **F-93b** **The repo owns every file under `src/components/ui`. Nothing there is regenerated by `shadcn add`.** So extend a primitive in place: add a `cva` variant, accept another prop. Never wrap it, never fork it, never re-implement it. A wrapper around a primitive you own is the mechanism that produced the seven overlapping selects in F-141.
- **F-94** Dark mode is class-based via `next-themes`: declare the dark variant once (`@custom-variant dark (&:where(.dark, .dark *));`), define light and dark token values under `:root` and `.dark`, then use `dark:` utilities.
- **F-95** Do not reach for arbitrary values (`mt-[13px]`, `p-[7px]`, `gap-[13px]`) when a token or scale step exists. Stay on the 4px scale: `1/2/3/4/6/8/12/16`.
- **F-96** `@apply` in a component-scoped stylesheet needs `@reference "../app/globals.css";` at the top of that file. Prefer utilities in JSX over `@apply`.
- **F-97** Let `prettier-plugin-tailwindcss` sort classes. Never argue about class order by hand.
- **F-98** Custom utilities via `@utility`, custom variants via `@custom-variant`, plugins via `@plugin`. This repo uses `tw-animate-css`.

### 2.8 Structure, composition and file size

The layout is global, not feature-first, and the map in section 2.16 is the rule: `src/services`, `src/stores`, `src/hooks`, `src/types`, `src/lib/schemas`. A new file goes in the global directory for its kind, beside its neighbours (U-20). Shared reusable UI goes in `components/ui` (primitives) and `components/` (composites).

- **F-99** retired (ruling C11, 2026-09-14).
- **F-100** retired (ruling C11, 2026-09-14).
- **F-101** `hooks/` and `stores/` are client-only. Anything importing them implicitly needs `"use client"`, and keeping them separate makes the boundary visible in the file tree.
- **F-102** Naming: components `PascalCase`, hooks `useThing`, utilities `camelCase`, constants `UPPER_SNAKE_CASE`. File naming follows the neighbours (shadcn `ui/` is `kebab-case.tsx`, component files elsewhere commonly `PascalCase.tsx`). Do not mix conventions within one folder.
- **F-103** Named exports only, except Next's required default `page` / `layout` / `route` / `error` / `loading`. Named exports make symbols greppable and refactors safe.
- **F-104** God-file caps, each a finding rather than an automatic rewrite: component `.tsx` over about 300 lines, service over about 400, store over about 300, hook over about 150. Why: big files hide duplication, defeat review, and make an agent reload huge context to change one line. (Golden 6)
- **F-105** Split without churn: extract the largest self-contained JSX block into a named child first and repeat; lift handlers and derived state into a colocated `use<Feature>` hook so the component body is mostly markup; keep extracted pieces colocated. Each extraction keeps behaviour identical and type-checks.
- **F-106** Use compound components for repeated structures that always travel together, and `children` / slot props so one layout component serves many pages.
- **F-107** No deep barrel `index.ts` re-exporting everything internal. They hurt tree-shaking, invite circular imports and slow type-checking. Use a barrel only for a small stable public surface.
- **F-108** Do not write large prose docs to explain the code. Consistent code plus this file is the documentation.

### 2.9 Integrations and dependencies

- **F-109** One library per job. Two packages doing the same thing is a defect: pick one, migrate, delete the other. Audit `package.json` for competing deps.
- **F-110** Known duplicates in this repo, fix on sight: `framer-motion` + `motion` (standardize on `motion/react`, the renamed successor, same API); Tiptap + Lexical (pick one, do not add a third); multiple select/combobox libs (`react-select`, `cmdk`, Radix Select, `react-day-picker`) converge on the shadcn/Radix primitive, with `cmdk` for command palettes.
- **F-111** **There is no `next-auth` in this repo** (verified 2026-09-14: absent from `package.json`, no imports under `src/`). Auth is an httpOnly `thh_auth` cookie set by Flask at login, plus a legacy `Authorization: Bearer` JWT path that `initialize()`'s cookie-sync upgrade clears once a session is migrated. All of it lives in `src/utils/api.ts`: `authenticatedFetch` sends `credentials: "include"` and adds the `X-CSRF: 1` guard on non-GET cookie-authenticated requests. Do not re-implement token plumbing in a component, do not read the cookie from JS (it is httpOnly by design), and do not copy Auth.js or `next-auth` snippets into this codebase.
- **F-112** Sanity content: queries and client under `src/sanity`, rendered with portable-text components, never `dangerouslySetInnerHTML` on raw HTML. Images go through `@sanity/image-url` (`urlFor`), never a hot-linked raw asset URL. Keep the read token server-side and fetch content in Server Components.
- **F-113** TanStack Table v8: one column-def factory per table, `columns` kept stable (module-level) so the table does not thrash. Do not store derived, sorted or filtered server rows in state.
- **F-114** Long lists use `@tanstack/react-virtual` so only visible rows render. A plain `.map()` over thousands of candidates is a perf defect. Paginate or virtualize; never render thousands of rows.
- **F-115** `socket.io-client`: one shared client instance, never a connection per component. Connect and disconnect in an effect tied to the feature lifecycle and always clean up listeners on unmount. Reconcile incoming events into the query cache (`setQueryData` / `invalidateQueries`), never into a parallel state copy.
- **F-116** `dnd-kit`: keep the dragged-item id in local UI state and persist the new order via a mutation that invalidates the list query. An optimistic reorder needs rollback in `onError`.
- **F-117** `recharts`: one reusable wrapper per chart type; do not re-derive axis and tooltip config inline per usage.
- **F-118** `posthog-js`: one init, capture through a thin typed wrapper rather than raw `posthog.capture('string')` scattered across components. Never send PII (emails, names, tokens) as event properties; gate capture on consent where required.
- **F-119** Toasts are `sonner` with one `<Toaster>` at the root; drawers and sheets are `vaul` plus Radix Dialog; theming is `next-themes`. Do not add a second library for any of these, and do not hand-roll a portal.

### 2.10 Performance

- **F-120** Shipping less JavaScript is the biggest lever. Server Components by default, `"use client"` on small leaves (F-44 to F-46).
- **F-121** Lazy-load heavy client-only libraries with `next/dynamic` and `ssr: false`: editors (Tiptap, Lexical), `recharts`, `@dnd-kit` boards, `react-calendly`, and other below-the-fold or interaction-gated widgets.
- **F-122** Import narrowly. Import specific icon paths from `react-icons`, specific functions from `date-fns`, per-function from `lodash` or use native equivalents. Watch the bundle with `@next/bundle-analyzer` when adding deps.
- **F-123** Raising `staleTime` is the cheapest way to cut redundant network calls, within F-31 and F-32.
- **F-124** Debounce filter and search inputs and reflect them to the URL. Do not fire a request per keystroke.
- **F-125** Perceived speed: stream with `loading.tsx` / `<Suspense>`, use `useOptimistic` for instant mutation feedback, and use `next/image` and `next/font` rather than hand-rolled image and font loading.

### 2.11 Types and tooling

- **F-126** Shared domain types in `src/types/*.ts`; API request and response types beside the service that owns the call (F-17).
- **F-127** `any` is a defect. It disables the one check that gates the build. Use `unknown` plus a narrowing check when a shape is genuinely unknown. (S5)
- **F-128** An unavoidable cast is one line, at the boundary, with a comment saying why.
- **F-129** No `@ts-expect-error` without a reason on the same line, and no `@ts-ignore`.
- **F-130** Type the wire shape, not the convenient shape. Fields the API can omit are optional in the type.
- **F-131** `"strict": true` in `tsconfig.json` is non-negotiable, and the `@/*` path alias is kept. Strict types are self-documenting and let agents refactor safely.
- **F-132** ESLint 9 flat config extends `next/core-web-vitals` + `next/typescript` and encodes the conventions so violations auto-flag: ban `any`, enforce `react-hooks/exhaustive-deps`, flag unused vars and imports, restrict default exports to `app/**`.
- **F-133** Rules that a linter, formatter or type checker can enforce are never written as prose. They are faster, deterministic, and do not consume an agent's context window.
- **F-134** Env vars are validated at boot with Zod, separating server-only from `NEXT_PUBLIC_*`, in one place.
- **F-135** Pre-commit runs `eslint --fix`, `prettier --write` and `tsc --noEmit` on staged files via husky and lint-staged, so generated code is fixed before it lands.
- **F-136** One instruction file. Keep a single lean repo-root agent instruction file rather than duplicate `.cursorrules` / `copilot-instructions.md` with the same content. If rules must grow, prefer scoped rule files with globs over one monolith.
- **F-137** Do not run two linters at once. ESLint plus Prettier, or Biome, not both.
- **F-138** Ready-to-copy configs (`eslint.config.mjs`, `prettier.config.mjs`, `env.ts`, `lib/utils.ts`, `AGENTS.md.template`, `SETUP.md`) live in the `thh-fe-audit/assets/` directory of the source skill.

### 2.12 Anti-AI-slop and the THH design system

AI slop is plausible, polished code that ignores our system. It works, it is typed, it has comments, and it reinvents primitives we already have, hardcodes design values instead of our tokens, wraps trusted inputs in defensive try-catch, over-abstracts, and converges on the generic purple-gradient Inter look. Slop has no obvious tells, which is why it must be hunted deliberately.

- **F-139 (S1)** Search `components/ui/` and the nearest feature folder before building any UI element. Reinventing an existing primitive is the single most common slop. `components/ui/` already holds `button`, `input`, `card`, `dialog`, `select`, `combobox`, `data-table`, `Pagination`, `StatusBadge`, `RoleBadge`, `Breadcrumb`, `SearchInput`, `LoadingSpinner`, `skeleton`, `sonner`. Compose them.
- **F-140** Navigation breadcrumbs use `components/ui/Breadcrumb.tsx`; SEO breadcrumb structured data uses `JsonLd.tsx`. Do not roll a new trail.
- **F-141** Cautionary tale, do not add to it: `src/components/ui/` already contains **seven** overlapping select/dropdown components (`select.tsx`, `combobox.tsx`, `custom-select.tsx`, `CustomSelect.tsx`, `CustomSelectInner.tsx`, `CustomDropdown.tsx`, `MultiSelect.tsx`), **three** tables (`data-table.tsx`, `DataTable.tsx`, `VirtualTable.tsx`), **three** spinners (`LoadingSpinner.tsx`, `loading-spinner-ring.tsx`, `LoadingOverlay.tsx`), two search inputs, and mixed kebab/Pascal naming in one folder. Pick the canonical one, reuse it, stop the bleeding. Never add an eighth select.
- **F-142 (S7)** Tokens, never hardcoded design values. Colors: `--color-ink` (#0F172A text), `--color-ink-muted`, `--color-ink-subtle`, `--color-paper` (#FAFAF7 bg), `--color-paper-deep`, `--color-rule` / `--color-rule-strong` (borders), `--color-brand` (#2B7BD3), `--color-brand-deep`, `--color-brand-tint`, plus `success` / `warn` / `danger` `-deep` and `-tint` pairs. Write `text-ink`, `bg-paper`, `border-rule`, `text-brand`. Never `text-gray-900`, `bg-white`, `#0F172A`, `#000`, `#fff`, or an indigo/purple default. Do not introduce a parallel gray ramp; the neutrals are already tinted toward the brand.
- **F-143** The display font is **Fraunces serif** via `--font-display`. This is not an Inter or Roboto app. Headings use the display font; never override font-family inline.
- **F-144** The product is editorial and paper, not generic SaaS. Paper background, ink text, serif headings, hairline `border-rule` borders, brand blue used sparingly.
- **F-145 (3.1)** The signature AI tell is `rounded-2xl shadow-lg p-6` stamped on every box, and **a thick colored border on one side of a rounded card** is the single most recognizable one. Use the radius scale by element (`rounded-sm` / `rounded-md` / `rounded-lg`, from `--radius` 0.625rem), buttons and inputs small, cards medium, panels square. No `rounded-2xl` / `rounded-3xl` / `rounded-full` on cards and containers.
- **F-146** One light shadow only (`--shadow-receipt`). No multi-layer drop shadows, no shadow on every container, no neon or colored glows, no glassmorphism (`backdrop-blur` plus translucent). Most surfaces sit on a hairline border, not a shadow.
- **F-147** Body lines about 1.5 line-height, paragraph measure 65 to 75ch, and **`tabular-nums`** for prices, dates, counts and metrics so columns align.
- **F-148** Motion: animate only `transform` and `opacity`, never `width` / `height` / `margin` / `top` / `left`, which thrash layout. No `transition: all`. Durations 120 to 250ms; interactions that should feel instant get no transition. Entrance easing is not `ease-in`. Active feedback is `scale(0.98)` or `translateY(1px)`. Always respect `prefers-reduced-motion`. Use `motion/react`, not `framer-motion`.
- **F-149** Break the symmetric centered-badge plus three-equal-card formula. Do not wrap everything in a card. No fake dashboard mockups, decorative gradients with no information, floating icon-in-pill rows, or meaningless `BETA` badges. Prefer an intentional grid with a dominant cell.
- **F-150** No emoji as UI icons. Use `lucide-react`.
- **F-151 (S6)** Copy-pasted markup or handlers with one value changed get extracted into a component, a `cva` variant or a shared hook on the third occurrence (U-05). Studies show AI multiplies duplicated blocks four to eight times.
- **F-152** Before-you-write breadcrumb checklist, run every time: (1) find and open the nearest existing example; (2) reuse the existing primitive rather than building a parallel one; (3) tokens, not values; (4) match naming and file shape of the neighbours, named exports, colocated; (5) minimum code, no abstraction before the rule of three, no defensive wrapping of trusted inputs; (6) loading, empty and error states plus a11y; (7) version-correct for React 19 / Next 15 / Tailwind v4 / Query v5 / Zustand v5. If a block fails any check, rewrite it before finalizing.
- **F-153** Detection greps for audit mode: `text-gray-`, `bg-white`, `border-gray-`, `#[0-9a-fA-F]{3,6}`, `fontFamily`, `indigo|purple|violet` in className; `as any`, `: any`, `@ts-ignore`, `@ts-expect-error`; `catch (e) {}`, `catch (e) { console.`, `console.log(`; `key={i}` / `key={index}`; new `*Select*` / `*Dropdown*` / `*Modal*` / `*Table*` / `*Spinner*` files; comments restating the function name; `forwardRef`, hand-written `useMemo` / `useCallback` / `memo`; a `useQuery` or list with no skeleton, empty or error branch; `rounded-2xl|3xl|full` on cards, `shadow-lg|xl|2xl`, `backdrop-blur`; `transition-all` or animated `width`/`height`/`margin`/`top`/`left`, durations 300ms or more; `gradient-to-` with purple, violet, indigo or cyan; `p-[`, `gap-[`, `m-[`; an em dash in JSX microcopy; numerics in tables without `tabular-nums`.

### 2.13 Cleaning: what to remove

- **F-154** Hand-rolled cache machinery (F-43), fetch-on-mount effects (F-42), a second service function differing from an existing one by one query parameter, `"use client"` on a file with no hook or handler or browser API, a store field nothing reads, a store action nothing calls, and dead props left behind by a refactor. TypeScript will not flag an unused optional prop.

### 2.14 Before calling frontend work done

- **F-155** **Type check.** `npm run typecheck`. Paste the real output. Zero errors, no exceptions.
- **F-156** **Run the tests.** `npm test`. The suite is small and green, so any red is yours; fix it before reporting.
- **F-157** **Lint must pass.** `npm run lint`, clean, alongside the type check and the tests. All three are the completion gate, and a change with lint errors is not complete. `next.config.ts` sets `eslint.ignoreDuringBuilds: true` so lint does not fail the local build, but `.github/workflows/ci.yml` runs it on every push and PR, so a lint error blocks the merge anyway. Run `npm run format` when it is formatting rather than a rule violation.
- **F-158** Exercise the actual screen for a UI change. A passing type check proves the shapes line up, not that the feature works.

### 2.15 Frontend review checklist

Run against the diff (U-02).

**State ownership**
- [ ] Server data read through `useQuery`, not a store action. (F-03)
- [ ] No new fetch action, `xLoading` flag or `xError` field added to a store. (F-03)
- [ ] No `useEffect` whose only job is to fetch on mount and set state. (F-42)
- [ ] No value owned by both a query and a store. (F-01, F-02)
- [ ] Shareable view state (filters, tab, page, sort) is in the URL, not React state. (F-01)
- [ ] Store subscriptions select a slice; multi-value selects use `useShallow`. (F-04, F-05)
- [ ] No hand-rolled dedup, in-flight promise or minimum refetch interval. (F-43)

**Queries and mutations**
- [ ] Query key comes from an exported factory, not an inline literal. (F-27)
- [ ] Every value the query function reads appears in the key. (F-28)
- [ ] Key casing matches the convention used elsewhere. (F-29)
- [ ] The query function throws on a failed result. (F-26)
- [ ] Mutations invalidate the narrowest key that is genuinely stale. (F-34)
- [ ] Optimistic updates have `onMutate`, `onError` rollback and `onSettled`. (F-36)
- [ ] Global defaults not re-specified per call without a comment; `staleTime` set on prefetched queries. (F-31, F-32)
- [ ] v5 idioms: `gcTime`, `placeholderData: keepPreviousData`, `throwOnError`. (F-39)

**HTTP and services**
- [ ] No raw `fetch` against the API; no re-declared base URL or hand-rolled auth header. (F-18, F-20)
- [ ] No write opted into automatic retry without an explicit idempotency argument in a comment. (F-19)
- [ ] The service module imports no React and no store, and holds no business logic. (F-13, F-15)
- [ ] Response types declared beside the service method that returns them. (F-17)
- [ ] Errors surfaced to the user carry no URL, status code or "backend". (F-23)
- [ ] No service file over about 400 lines. (F-24)

**Next 15 and the boundary**
- [ ] `"use client"` only where required, on the smallest leaf. (F-45, F-46)
- [ ] `params` / `searchParams` / `cookies()` / `headers()` awaited in server components, `use()` in client. (F-49)
- [ ] Caching intent stated rather than assumed. (F-50)
- [ ] No pass-through API route that only forwards a call the client could make; no Server Action. (F-52)
- [ ] No server env imported into a client component. (F-59)

**Components, styling and forms**
- [ ] No `forwardRef`; no hand-written `useMemo` / `useCallback` / `memo` outside a measured hot path. (F-60, F-61)
- [ ] No `ui/` primitive wrapped or forked instead of extended in place. (F-93b)
- [ ] Paginated list sends `page` / `per_page`, both in the key, and reads `data.items` / `data.total`. (F-160)
- [ ] Error handling branches on `error.code`, never on message prose. (F-159)
- [ ] List keys are stable ids. (F-67)
- [ ] Loading, error, empty and success states all rendered. (F-72)
- [ ] Real `<button>` / `<a>`; inputs have associated labels; icon-only controls have accessible names; images have `alt`. (F-73)
- [ ] No component over about 300 lines, store over 300, hook over 150. (F-104)
- [ ] Named exports except Next's required defaults. (F-103)
- [ ] Classes merged with `cn()`, variants with `cva`; no template-literal class soup. (F-91, F-92)
- [ ] Tokens, not hardcoded colors, fonts, radii, shadows or arbitrary spacing. (F-95, F-142, F-143, F-145, F-146)
- [ ] No reinvented `ui/` primitive. (F-139, F-141)
- [ ] Form schema lives in one reviewable place, not inline in the component. (F-87b)
- [ ] Form type inferred from the Zod schema. (F-75)
- [ ] `defaultValues` provided; validation on blur or submit. (F-76, F-77)
- [ ] Validation messages are actionable sentences. (F-81)
- [ ] Submit disabled while pending, goes through a mutation, invalidates on success. (F-82, F-83)

**Types, deps and slop**
- [ ] No new `any`, explicit or via an untyped external boundary. (F-127)
- [ ] Unavoidable casts are one line, at the boundary, with a reason. (F-128)
- [ ] No `@ts-expect-error` without a same-line reason. (F-129)
- [ ] No new dependency competing with an existing one. (F-109, F-110)
- [ ] Heavy client-only libs loaded via `next/dynamic`. (F-121)
- [ ] No defensive try-catch around trusted or typed inputs, no empty catch, no leftover `console.log`. (U-12)
- [ ] No comment restating the code. (U-10)

### 2.16 Frontend repo calibration: thh-frontend

> Copied verbatim from `thh-code-frontend/SKILL.md` section 9. Measured **2026-08-24**. Numbers drift; re-measure before quoting one.
> **If you are not working in `thh-frontend`, everything in this section is an example of the format only.**

**Coordinates**

| | |
|---|---|
| Repo root | `C:\thehirehub\thh-frontend` |
| Source | `src/`, import alias `@` to `./src` |
| Routes | `src/app` (App Router) |
| HTTP wrapper | `src/utils/api.ts`, `authenticatedFetch(url, options)` |
| Services | `src/services/*-service.ts` (some are directories) |
| Query client | `src/lib/queryClient.ts`; provider `src/components/QueryProvider.tsx` |
| Stores | `src/stores/*.ts`, 15 stores |
| Hooks | `src/hooks/` |
| Zod schemas | `src/lib/schema.ts`, `src/lib/schemas/` |
| Shared types | `src/types/*.ts` |
| Backend | Flask at `localhost:5000/api` (`NEXT_PUBLIC_API_BASE_URL`) |

Versions: Next `^15.5.21`, React `^19.2.1`, TypeScript `^5`, Tailwind `^4`, `@tanstack/react-query` `^5.81.2`, `zustand` `^5.0.9`, `react-hook-form` `^7.56.4`, `zod` `^3.25.13`, `vitest` `^4.1.6`.

**Commands**

```bash
npm run typecheck      # tsc --noEmit — THE gate
npm test               # vitest run, jsdom — whole suite, ~6s
npm test -- <path>     # one file
npm run lint           # eslint 9 flat config
npm run format         # prettier --write .
npm run dev            # :3000, turbopack
npm run build          # next build
```

**Type errors fail the build; lint errors do not.** `next.config.ts` sets `eslint.ignoreDuringBuilds: true` and `typescript.ignoreBuildErrors: false`. The codebase was taken to zero type errors on 2026-06-10. `npm run typecheck` is the check that matters most. Lint and format are enforced outside the agent loop: `.husky/pre-commit` runs lint-staged (`eslint --fix`, `tsc --noEmit`, `prettier --write`) on staged files, and `.github/workflows/ci.yml` runs lint + typecheck + test on every push and PR to `dev`/`main`.

**Test baseline is green.** Vitest + jsdom, tests as `src/**/*.test.{ts,tsx}` beside the code under test, setup in `vitest.setup.ts`. Baseline 2026-08-24 per the repo's `CLAUDE.md`: **22 files / 163 tests, all green in ~6s.** The suite is cheap and green, so **any red is yours.** Coverage is thin and concentrated in `src/utils`, `src/stores`, `src/lib` and a few components.

**Measured divergences: existing violations, not precedent**

| Rule above | Violations on disk |
|---|---|
| Server data owned by TanStack Query, not a store | **15 of 15** stores import a service and hold server state |
| No `any` | **257** occurrences of `: any` / `as any` across `src` |
| Server component by default | **444 of 657** `.tsx` files carry `"use client"` (68%) |
| Query keys come from an exported factory | **1** exported key constant exists, and it lives in a component (`src/components/exit-interviews/CampaignList.tsx`) |
| One key casing convention | mixed: `["jobCreationData", id]` beside `["exit-campaign", id]` and `["billing", "ai-interview-packs"]` |

React Query is nonetheless real and mainstream here: 43 files import it, 41 use `useQuery`/`useMutation`. The two systems coexist, and the store side is older. **Do not add to any of these counts.**

**The canonical example to learn from.** `src/stores/creditsStore.ts` holds `credits`, `creditsLoading`, `creditsError`, a `fetchCredits` action, a module-level in-flight promise and a 2000 ms minimum refetch interval. Its own comment explains why the throttle exists:

> Several components (AppSidebar, CreditsDisplay, JobHeader, multiple create-job pages) each call fetchCredits() in their own useEffect. Without this, a render storm or rapid mount/unmount cycle can hit the endpoint hundreds of times per second.

That is request deduplication, a thing the query cache does for free. Read this file before writing a new store, then do not write one.

**Configured defaults you should not restate.** `src/lib/queryClient.ts`: `staleTime` 30s (while fresh, mounts and focus events reuse the cache), `gcTime` 10 min, `refetchOnWindowFocus: false`, `refetchOnReconnect: true`, `refetchOnMount: true`; queries no retry on 4xx, up to 3 retries otherwise, exponential backoff to 30s; mutations no retry on 4xx, up to 2 retries otherwise, backoff to 10s.

`src/utils/api.ts`: 30s default timeout with its own user-facing message; retry only on `GET`/`HEAD`, only for a fetch-level rejection or a 502/503/504 (and 429 honouring `Retry-After`), **never** on 4xx, 500, or a client-side timeout; writes never auto-retried (a retried availability save fires candidate emails twice); `options.retry` opts a specific call in or out, max 5; `CONNECTION_ERROR_MESSAGE` / `TIMEOUT_ERROR_MESSAGE` are the exported user-facing strings, reuse them.

**Next 15 in this repo.** Both `params` idioms are in use and both are correct in their context: server component `const { token } = await params;` (`src/app/exit/[token]/page.tsx`); client component `const { token } = use(params);` (`src/app/interview/[token]/page.tsx`).

**Repo-specific facts**

- `graphify-out/`: generated, gitignored map of every page, component, store, service and hook, cross-linked to the backend Flask handlers. Use it for "which API does this page call", "what uses this store", "what breaks if this handler is renamed" before grepping. Snapshot 2026-08-20; confirm in source before acting, never write into it. `graph.html` is a 10 MB visualisation, not readable as text.
- **The Cursor rule files in this repo are stale.** `.cursor/rules/` holds 11 `.mdc` files, all `alwaysApply: true`, about 4,075 lines permanently in context. Four of them (`file-organization.mdc`, `form-validation.mdc`, `service-layer.mdc`, `type-management.mdc`) have corrupt frontmatter. `CURSOR.md` (303 lines) prescribes `Component -> Store -> Service -> API -> Store` with Zustand as the server-data layer, which predates React Query entirely. Those files are not maintained; where they conflict, this file wins. The repo's own `CLAUDE.md` is current and does not conflict.

---

## 3. Sources and provenance

Merged **2026-09-14**. Conflicts and gaps are itemized in `STANDARDS-MERGE-NOTES.md` beside this file.

**Rulings applied 2026-09-14, see `STANDARDS-MERGE-NOTES.md` section 1.**

**Repo A: `thh-code-standards`**
`https://github.com/ISHANKSHARMA146/thh-code-standards.git`
Clone: `C:\thehirehub\claude-skills\thh-code-standards`
`git rev-parse HEAD` = `90a85ab55863740e6cf052248a5671e64c73462c` (committed 2026-08-24)

| Merged section | Source file |
|---|---|
| 1.1 to 1.8, and the backend half of section 0 | `skills/thh-code-backend/SKILL.md` sections 1 to 7, 9 (793 lines) |
| 1.9 Backend review checklist | `skills/thh-code-backend/SKILL.md` section 8 |
| 1.10 Backend repo calibration | `skills/thh-code-backend/SKILL.md` section 10, verbatim, measured 2026-08-24 |
| 2.1 to 2.6, 2.11, 2.13, 2.14 (primary) | `skills/thh-code-frontend/SKILL.md` sections 1 to 7 (648 lines) |
| 2.15 Frontend review checklist (primary) | `skills/thh-code-frontend/SKILL.md` section 8 |
| 2.16 Frontend repo calibration | `skills/thh-code-frontend/SKILL.md` section 9, verbatim, measured 2026-08-24 |

**Repo B: `thh-frontend-clean`**
`https://github.com/ISHANKSHARMA146/thh-frontend-clean.git`
Clone: `C:\thehirehub\claude-skills\thh-frontend-clean`
`git rev-parse HEAD` = `3dec922e44e87f0c6059c798b3d7d69de3c6403c` (committed 2026-06-22)

| Merged section | Source file |
|---|---|
| Golden rules folded into section 0 and 2.x | `thh-fe-audit/SKILL.md` (118 lines), `thh-fe-audit/thh-fe-code/SKILL.md` (92 lines) |
| 2.12 Anti-AI-slop, F-139 to F-153 | `thh-fe-audit/thh-fe-antiai/SKILL.md` (69 lines), `references/anti-ai-slop.md` (191 lines) |
| 2.2, 2.3 (D1 to D9) | `references/data-layer.md` (82 lines) |
| 2.1 (state ownership, Zustand v5), 2.3 | `references/state.md` (149 lines) |
| 2.4 Next.js 15 | `references/nextjs.md` (67 lines) |
| 2.5 React 19 | `references/react.md` (50 lines) |
| 2.6 Forms | `references/forms.md` (50 lines) |
| 2.7 Styling | `references/styling.md` (59 lines) |
| 2.8 Structure and god-files | `references/components-structure.md` (54 lines) |
| 2.9 Integrations | `references/integrations.md` (50 lines) |
| 2.10 Performance | `references/performance.md` (31 lines) |
| 2.11 Tooling | `references/tooling.md` (33 lines) |

`thh-fe-audit/assets/` holds config templates (`eslint.config.mjs`, `prettier.config.mjs`, `env.ts`, `lib/utils.ts`, `AGENTS.md.template`, `SETUP.md`). They were not merged into this file; they are referenced by F-138 and remain the copy source.

**Source ID mapping.** `D1` to `D9` are data-layer rule IDs from repo B. `S1` to `S10` are the code-slop catalog IDs from repo B's `anti-ai-slop.md`; section markers such as `3.1` refer to that same file. `Golden n` refers to the numbered Golden rules in repo B's `thh-fe-audit/SKILL.md`. Repo A's two skills carry no rule IDs of their own, so every `B-nn` and the unparenthesised `F-nn` rules are newly assigned here.
