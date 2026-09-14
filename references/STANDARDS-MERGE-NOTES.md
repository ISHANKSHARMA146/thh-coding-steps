# Standards merge notes

Companion to `THH-CODE-STANDARDS.md`. Merged 2026-09-14.

Short names used below:

- **A** = `C:\thehirehub\claude-skills\thh-code-standards` (SHA `90a85ab55863740e6cf052248a5671e64c73462c`)
  - **A-BE** = `skills/thh-code-backend/SKILL.md`
  - **A-FE** = `skills/thh-code-frontend/SKILL.md`
- **B** = `C:\thehirehub\claude-skills\thh-frontend-clean` (SHA `3dec922e44e87f0c6059c798b3d7d69de3c6403c`)
  - files under `thh-fe-audit/`

**All 20 conflicts were ruled on by Ishank Sharma, 2026-09-14, and are RESOLVED. The standards file has been amended to match.** The "kept" lines below are the provisional merge choice; the **Ruling** line is binding.

---

## 1. CONFLICTS

### C1 - Where a failed request becomes a thrown error **[RESOLVED]**
- **A-FE:110** and **A-FE:136-138**: the service returns `{ success, data, error }` and **does not throw**; the `queryFn` converts `!success` into a thrown error.
- **B `references/data-layer.md`:16**: the service fn itself must "throw a typed error, return typed data". **B `references/anti-ai-slop.md`:72-73** reinforces it: errors flow to the query error boundary or a typed `*ApiError`.
- **Kept: A** (merged `F-22`, `F-26`). The deployed `authenticatedFetch` already returns envelope-shaped results and the Flask API returns `{"success": ...}` (`B-27`), so A's contract is the one in production. B's structured-error escape hatch was preserved separately as `F-14`.
- **Ruling (2026-09-14):** keep as is. The envelope is returned by the service, the `queryFn` throws. `F-22` and `F-26` stand unchanged. `F-14` stays as the typed-error escape hatch **for the queryFn layer only**, and was amended to say so.

### C2 - `staleTime` per query **[RESOLVED]**
- **A-FE:147-149**: "Do not re-specify `staleTime`, `retry` or `refetchOnWindowFocus` here, they are set once on the client instance. Override only with a comment." A-FE:605 records the configured global `staleTime` as **30s**.
- **B `references/data-layer.md`:55-56 (D7)** and **B `references/state.md`:51**: set `staleTime` deliberately per query (example 60s) because "TanStack Query default `staleTime` is `0`".
- **Kept: both, scoped** (`F-31` bans restating globals, `F-32` requires it on prefetched or hydrated queries).
- **Note:** B's stated premise is false in this repo. The default here is 30s, not 0, so the "prefetched query refetches immediately" argument does not hold as written.
- **Ruling (2026-09-14):** kept choice confirmed. `F-31` and `F-32` stand as written.

### C3 - How mutations reach the server **[RESOLVED]**
- **A-FE:408-410**: route handlers under `src/app/api` are only for secrets, redirects and webhooks; ordinary API work goes through the service layer from the client. A-FE:181-190 shows every mutation as `useMutation` plus a service call.
- **B `references/nextjs.md`:37-52**: "Use Server Actions instead of hand-rolled API routes + client fetch for form/data mutations", with `revalidatePath` / `revalidateTag`. Repeated at **B `references/components-structure.md`:44** ("often removes dozens of lines per mutation") and **B `references/forms.md`:35-42**.
- **Kept: A as the default** (`F-52`), with B's Server Action rules retained conditionally (`F-53`) for work that genuinely runs server-side.
- **Ruling (2026-09-14):** **A, absolutely.** Mutations reach the server only through the client service layer calling `authenticatedFetch` to Flask. **No Server Actions at all.** `F-52` is the rule and was rewritten to say so. `F-53` and `F-84` are retired. `F-62` was rewritten to drop `useActionState` and `useFormStatus`, keeping `useOptimistic` and `startTransition`. The frontend review checklist item for `F-53` was removed.

### C4 - Is the URL a state owner? **[RESOLVED]**
- **A-FE:36-41**: a three-row ownership table (Query / Zustand / derived) ending "There is no third category."
- **B `references/state.md`:10** and **B `thh-fe-audit/SKILL.md`:55**: filters, search term, active tab, page number and sort belong in **URL search params**, not React state.
- **Kept: B** (merged `F-01` table has four owners plus derived).
- **Reason:** strictly more precise. A's own categories do not settle where a shareable filter lives, and A's rule would push it into Zustand.
- **Ruling (2026-09-14):** kept choice confirmed. The four-owner table in 2.1 stands.

### C5 - Editing `components/ui` primitives **[RESOLVED]**
- **A-FE:280-282**: generated shadcn/Radix primitives "**Do not edit them in place**, the next `shadcn add` overwrites the file and the loss is invisible in review. Wrap the primitive."
- **B `references/styling.md`:44**: "You **own** the primitives in `components/ui`. **Extend them** (add a `cva` variant, accept more props) rather than forking or re-implementing."
- **Kept: reconciled into one rule** (`F-93b`): extend in place for repo-owned primitives, wrap instead for any file `shadcn add` regenerates.
- **Ruling (2026-09-14):** **the repo owns every file under `src/components/ui`; nothing there is regenerated by `shadcn add`.** So the rule is: extend in place (add a `cva` variant, accept an extra prop). Never wrap, never fork. `F-93b` was rewritten to this, and the frontend checklist item was split accordingly.

### C6 - Package manager in the commands **[RESOLVED]**
- **A-FE:538-545**: `npm run typecheck`, `npm test`, `npm run lint`, `npm run format`, `npm run dev`, `npm run build`.
- **B `thh-fe-code/SKILL.md`:58 and :66** and **B `references/tooling.md`:33**: `pnpm typecheck`, `pnpm lint --fix`.
- **Kept: A (npm).** A's commands were measured in `thh-frontend` itself; B's are generic.
- **Ruling (2026-09-14):** kept choice confirmed. npm.

### C7 - Definition of done: does lint gate it? **[RESOLVED]**
- **A-FE:547-558** and **A-FE:493-498**: type check is **the** gate, `eslint.ignoreDuringBuilds: true` means lint errors do not fail the build, and lint/format are enforced outside the agent loop by husky and CI. "Lint and format **if** the repo enforces them."
- **B `references/tooling.md`:33**: "A change is complete only when `pnpm typecheck` **and** `pnpm lint` pass and relevant Vitest tests are green. Don't claim completion otherwise."
- **Kept: A** (`F-155` to `F-157`).
- **Ruling (2026-09-14):** **B.** Lint MUST pass before a change is complete, alongside the type check and the tests. All three are the gate. `F-155` to `F-157` were amended; `F-157` now names `npm run lint` as mandatory and records that CI runs it on every push and PR even though `eslint.ignoreDuringBuilds: true` keeps it out of the local build.

### C8 - One bound Zustand store or many **[RESOLVED]**
- **A-FE:526** and **A-FE:574**: the repo has **15 separate stores**, and A treats each as its own module.
- **B `references/state.md`:120-140**: split a large store into slices and **combine into one bound store** (`create` + `devtools` + `persist` + `partialize`). **B `references/state.md`:149** lists 13 existing domains as "slices" and says add to the matching slice.
- **Kept: neutral** (`F-11` says add to the matching existing slice or store, and do not spin up a parallel store for the same domain).
- **Ruling (2026-09-14):** **keep the 15 separate stores. No bound-store migration.** `F-11` stands. `F-09` was amended: `partialize` applies per store that persists.

### C9 - Where a Zod schema file lives **[RESOLVED]**
- **A-FE:376-378** and **A-FE:527**: "Schemas live with the other schemas, not inline in the component", concretely `src/lib/schema.ts` and `src/lib/schemas/`.
- **B `references/components-structure.md`:6 and :10**: feature-first, "keep a feature's components, hooks, queries, schemas, and types together". **B `references/forms.md`:6** shows a per-feature `schema.ts`.
- **Kept: A's intent, B's flexibility** (`F-87b`: one reviewable place per feature, central or colocated, never split across both).
- **Ruling (2026-09-14):** kept choice confirmed. `F-87b` stands.

### C10 - May a component call `useQuery` directly? **[RESOLVED]**
- **A-FE:132-141** shows `useQuery` written inline at the consuming site, and **A-FE:296-299** only *recommends* data hooks.
- **B `references/data-layer.md`:17**: "Components call the hook, **never** `useQuery` directly and **never** a service fn directly."
- **Kept: B** (`F-25`). Stricter, and it is the rule that makes the key factory rule (`F-27`) enforceable.
- **Ruling (2026-09-14):** kept choice confirmed. `F-25` stands.

### C11 - Global directories or feature folders **[RESOLVED]**
- **A-FE:519-528** documents the live layout: `src/services/*-service.ts`, `src/stores/`, `src/hooks/`, `src/types/`, `src/lib/schemas/`.
- **B `references/components-structure.md`:6-10** prescribes feature-first (`features/jobs/...`) with a one-way `app/` to `components/` to `lib/` graph, and calls a global `components/` a "dumping ground".
- **Kept: A's layout as the map (section 2.16), B's feature-first as the direction for new feature code** (`F-99`, `F-100`).
- **Ruling (2026-09-14):** **A. Keep the global layout** (`src/services`, `src/stores`, `src/hooks`, `src/types`, `src/lib/schemas`). The layout map in section 2.16 is the rule. The feature-first direction is retired: `F-99` and `F-100` now read as retired IDs, and section 2.8 opens with a prose line pointing at 2.16.

### C12 - Which system owns the auth token **[RESOLVED]**
- **A-FE:118-124**: `authenticatedFetch` "carries token or cookie transport, a request timeout, the 401 / 402 / 403 side effects".
- **B `references/integrations.md`:12-15**: session comes from `next-auth` v4; "the app token feeds `authenticatedFetch`".
- **Kept: reconciled** (`F-111`: next-auth supplies the session, `authenticatedFetch` is the only transport).
- **Ruling (2026-09-14):** **next-auth is NOT installed** (verified: absent from `package.json`, no imports under `src/`). B was wrong. Auth is an httpOnly `thh_auth` cookie set by Flask, plus a legacy Bearer JWT path that `initialize()`'s cookie-sync upgrade clears, all inside `src/utils/api.ts` (`authenticatedFetch`, `credentials: "include"`, `X-CSRF` guard on non-GET cookie-auth requests). `F-111` was rewritten to describe exactly that, and next-auth was removed from the standards entirely (it appeared only in `F-111`, section 2.9).

### C13 - `forwardRef` in existing primitives (B against itself) **[RESOLVED]**
- **B `references/react.md`:12**: older generated primitives "may still use `forwardRef`, **leave working code alone** unless you're editing it".
- **B `references/anti-ai-slop.md`:114 and :182**: `forwardRef` is listed flatly as slop to report.
- **Kept: the caveated version** (`F-60`: delete when you touch it).
- **Ruling (2026-09-14):** kept choice confirmed. `F-60` stands.

### C14 - Manual memoization (B against itself) **[RESOLVED]**
- **B `references/react.md`:16**: if the React Compiler is **not** enabled, "still memoize genuinely hot paths and stable callbacks passed to memoized children".
- **B `references/anti-ai-slop.md`:114 and :182** and **B `thh-fe-audit/SKILL.md`:80**: hand-written `useMemo` / `useCallback` / `memo` is a finding, no caveat.
- **Kept: the caveated version** (`F-61`).
- **Ruling (2026-09-14):** checked. **The React Compiler is NOT enabled in `thh-frontend`**: no `reactCompiler` in `next.config.ts`, no `babel-plugin-react-compiler` in `package.json`. `F-61` was rewritten to state that as fact and to read: memoize only measured hot paths and stable callbacks passed to memoized children; every other hand-written `useMemo` / `useCallback` / `memo` is a finding. The checklist item was reworded to match. `F-61` is now auditable.

### C15 - Optimistic updates: default or exception **[RESOLVED]**
- **A-FE:196-198**: "Optimistic updates need `onMutate`, `onError` rollback and `onSettled` invalidation. If you are not writing all three, do not write the optimistic update." Default is plain invalidation.
- **B `references/state.md`:69**: presents the optimistic mutation as the "standard shape, copy it". **B `references/data-layer.md`:72-73 (D9)** contradicts that and makes invalidation the default.
- **Kept: A plus D9** (`F-34` to `F-36`).
- **Ruling (2026-09-14):** kept choice confirmed. `F-34` to `F-36` stand.

### C16 - Service file size threshold **[RESOLVED]**
- **A-FE** sets no cap on service size and its calibration accepts the status quo.
- **B `references/data-layer.md`:3 and :29 (D3)** and **B `references/components-structure.md`:30**: a `*-service.ts` over **~400 lines** is a defect, while the repo's real files are ~3,365, ~2,700 and ~2,300 lines.
- **Kept: B's cap** (`F-24`), with incremental splitting and `U-03` (do not launch the repo-wide migration as a side quest).
- **Ruling (2026-09-14):** **keep the ~400-line cap** (`F-24`), applying it to **new services and to net additions in existing ones**. The three oversized services are **exempt until a split is scheduled as its own task** and are named in the rule as known debt. Measured 2026-09-14 with `git ls-files src/services | xargs wc -l`: `src/services/job-service/service.ts` **2,195**, `src/services/candidate-service/service.ts` **1,563**, `src/services/interview-service/service.ts` **1,509**. (The earlier ~3,365 / ~2,700 / ~2,300 figures in this note were stale.)

### C17 - Barrel files (B against itself) **[RESOLVED]**
- **B `references/components-structure.md`:51**: "Don't create deep barrel `index.ts` files that re-export everything."
- **B `references/data-layer.md`:32-36 (D3)**: the prescribed split *has* `services/job/index.ts`.
- **Kept: reconciled** (`F-24`, `F-107`: a barrel only for a small stable public surface).
- **Ruling (2026-09-14):** kept choice confirmed. `F-107` stands.

### C18 - The Inter example in the styling reference **[RESOLVED]**
- **B `references/styling.md`:13** uses `--font-display: "Inter", sans-serif;` as its `@theme` example.
- **B `references/anti-ai-slop.md`:16**: "display font is **Fraunces serif** via `--font-display`. We are not an Inter/Roboto app", and Inter is listed as a slop tell at `anti-ai-slop.md`:128 and :149.
- **Kept: Fraunces** (`F-143`). Flagged because the Inter line is in copy-paste position.
- **Ruling (2026-09-14):** kept choice confirmed. Fraunces. `F-143` stands.

### C19 - Lint command **[RESOLVED]**
- **B `references/tooling.md`:12**: `"lint": "next lint"` (or `eslint .`).
- **A-FE:543**: `npm run lint` running "eslint 9 flat config".
- **Kept: A.** `next lint` is being retired in favour of running ESLint directly.
- **Ruling (2026-09-14):** kept choice confirmed. `npm run lint` runs ESLint 9 directly.

### C20 - Em dashes in prose **[RESOLVED]**
- **B `references/anti-ai-slop.md`:149 and :188**: em dashes in UI microcopy are an AI tell; ban them.
- **A-BE and A-FE** use em dashes throughout their own prose.
- **Kept: B's ban**, applied to the merged file's prose (`U-22`). Two em dashes survive inside the verbatim command block in section 2.16 because that block is copied verbatim.
- **Ruling (2026-09-14):** kept choice confirmed. `U-22` stands; the two verbatim-block em dashes remain the only ones in the file.

---

## 2. GAPS

Ranked by importance. None of the three sources covers these. **Gaps 1 to 5 were closed 2026-09-14** with rules written against the real code; gaps 6 to 15 remain open.

1. **Logging.** ~~No rule on levels, structured fields, request correlation, or what must never be logged.~~ **CLOSED: new section 0.1, `U-23` to `U-25`.** One logger per module (`logging.getLogger(__name__)`, the pattern in 187 backend modules), level semantics with `logger.exception` inside `except`, and structured context by id with an explicit never-log list (tokens, the `thh_auth` cookie, candidate PII, resume and transcript text, LLM prompts carrying personal data).
2. **Backend secrets handling.** ~~No rule for `.env` layout or never committing credentials.~~ **CLOSED: new section 1.11, `B-61` to `B-64`.** Environment only, `load_dotenv()` once at `app.py:41`, nothing hardcoded in code or migrations, every new secret gets a valueless `env.example` entry, and `env-backups/` is off limits to agents.
3. **API error taxonomy.** ~~The envelope carries a free-text `error` string.~~ **CLOSED: section 1.11, `B-65` to `B-67`, plus `F-159`.** `error` becomes `{"code", "message"}` with a fixed initial code set (`validation_error`, `unauthorized`, `forbidden`, `not_found`, `conflict`, `rate_limited`, `internal`), attached only through `_err`; `B-27` and `B-30` were amended. The frontend branches on `code`, never on prose. Bare-string errors from older endpoints are legacy and migrate on touch.
4. **Pagination contract.** ~~No rule for list-endpoint parameters or the matching frontend shape.~~ **CLOSED: new section 1.12, `B-68` to `B-71`, plus `F-160`.** `page` / `per_page` is the repo's dominant pattern (39 occurrences in `services/*/routes.py`; the `limit` / `offset` pairs are legacy), bounded at default 20 / max 100, returning `items` / `total` / `page` / `per_page`, with no unbounded list endpoint. The frontend puts both parameters in the query key.
5. **Authorization model.** ~~No rule for where a permission policy lives or how roles are checked.~~ **CLOSED: new section 1.13, `B-72` to `B-75`.** `@verify_auth_token` on every route and deny by default, role checks through one helper each (`require_thh_admin`, `services/admin/routes.py:92`) rather than the 14 inline `role ==` comparisons, `company_id` scoping in the CRUD WHERE clause rather than the route, and a required test for the deny path.
6. **Observability.** No error monitoring, tracing, request id propagation, or a rule that a 500 must be traceable back to a request.
7. **Background jobs and queues.** Schedulers and workers exist in the repo but nothing covers idempotency, retry, dead-lettering or which environment may consume a shared queue.
8. **Inbound webhooks.** No signature verification, replay protection or timeout rule for provider callbacks.
9. **DB indexing and query performance.** No rule that a new filter column gets an index, and no N+1 or query-count budget.
10. **PII and data retention.** Resumes, transcripts and interview recordings have no handling, retention or deletion rule. The only mention of PII anywhere is the PostHog ban (`F-118`).
11. **File uploads and object storage.** No size limits, content-type validation, signed-URL policy or scanning rule.
12. **Test naming and structure.** No convention for test file naming, case naming, arrange/act/assert, fixture ownership or what a regression test for a bug must assert.
13. **Time, timezone and money.** No rule for storing UTC and rendering local, or for `Decimal` handling beyond the `to_dict()` coercion in `B-37`.
14. **i18n and locale.** No rule for user-facing string extraction or number and date formatting, despite the backend's multi-region `region_code`.
15. **Dependency and security hygiene.** No rule for upgrade cadence, lockfile discipline, vulnerability scanning or adding a new dependency.

---

## 3. DROPPED

Duplication only, plus operating scaffolding that is not a coding rule.

1. **Rules stated more than once across sources**, kept once at the most precise wording: state ownership (A-FE:36-62, B `state.md`:5-12, B `data-layer.md`:41-42, B `thh-fe-audit/SKILL.md`:55, B `thh-fe-code/SKILL.md`:70); query-key factories (A-FE:152-177, B `data-layer.md`:44-53, B `state.md`:26-40); god-file caps (B `thh-fe-audit/SKILL.md`:60, B `components-structure.md`:25-33, B `data-layer.md`:29); the version cheat sheet, repeated near-verbatim in `thh-fe-audit/SKILL.md`:65-72, `thh-fe-code/SKILL.md`:80-86 and the per-area references; the Golden rules, repeated in `thh-fe-audit/SKILL.md`:53-63 and `thh-fe-code/SKILL.md`:68-78.
2. **Skill operating scaffolding from B**, which governs how the audit/apply/antiai skills run rather than how code is written: the read-only mode contract (`thh-fe-audit/SKILL.md`:23-35), the "which reference to read" tables (:37-51, `thh-fe-code/SKILL.md`:35-47), the tiered report template (:92-118), the `find ~/.claude/skills` locator commands (`thh-fe-code/SKILL.md`:28-31, `thh-fe-antiai/SKILL.md`:29-31), and the two-mode split in `thh-fe-antiai/SKILL.md`:36-59. Named here so nothing is silently lost; the detection greps themselves were kept as `F-153`.
3. **Decorative code examples**, per the merge brief: A-BE's full billing route walkthrough (:166-220), full `PlansCRUD` class (:223-287), full model class (:365-409); A-FE's full `creditsService` module (:69-104); B's slop before/after pairs and the Zustand slices boilerplate (`state.md`:120-140). The rule text and the disambiguating fragments were kept.
4. **Biome** as an ESLint+Prettier alternative (`tooling.md`:29-30), reduced to "do not run two linters at once" (`F-137`), since the repo runs ESLint 9.
5. **`thh-fe-audit/assets/` file contents** (`eslint.config.mjs`, `prettier.config.mjs`, `env.ts`, `lib/utils.ts`, `AGENTS.md.template`, `SETUP.md`), referenced by `F-138` rather than inlined, per the brief.

No concrete rule was discarded. The five conflicts that could not hold both sides (C1, C4, C6, C7, C10) record the losing rule above with its `file:line`.

---

## 4. STATS

**Merged file:** `THH-CODE-STANDARDS.md`, **818 lines** after the 2026-09-14 rulings (was 759).

| Section | Rule IDs | Active |
|---|---|---|
| 0. Universal (incl. new 0.1 logging) | 25 (`U-01` to `U-25`) | 25 |
| 1. Backend (incl. new 1.11 to 1.13) | 75 (`B-01` to `B-75`) | 75 |
| 2. Frontend | 162 (`F-01` to `F-160`, plus `F-87b`, `F-93b`) | 158 |
| **Total** | **262** | **258** |

**Added 2026-09-14 (20 rules):** `U-23` to `U-25` (logging and PII), `B-61` to `B-64` (secrets), `B-65` to `B-67` (error codes), `B-68` to `B-71` (pagination), `B-72` to `B-75` (authorization), `F-159` (branch on error code), `F-160` (client pagination contract).

**Retired 2026-09-14 (4 IDs, kept as retired lines so no ID is reused):** `F-53` and `F-84` (ruling C3, Server Actions), `F-99` and `F-100` (ruling C11, feature-first layout).

Checklists: backend 44 items (1.9), frontend 50 items (2.15), both counted 2026-09-14. The earlier 31 / 39 figures in this block were wrong.

Source line counts consumed: A-BE 793, A-FE 648, B `thh-fe-audit/SKILL.md` 118, `thh-fe-code/SKILL.md` 92, `thh-fe-antiai/SKILL.md` 69, and 11 references totalling 816 lines. **2,536 source lines into 759.**

Conflicts: **20, all RESOLVED 2026-09-14.** Gaps: **15, of which 5 closed 2026-09-14 and 10 open.** Dropped: duplication and skill scaffolding only.
