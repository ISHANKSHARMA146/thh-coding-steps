# Standards merge notes

Companion to `THH-CODE-STANDARDS.md`. Merged 2026-09-14.

Short names used below:

- **A** = `C:\thehirehub\claude-skills\thh-code-standards` (SHA `90a85ab55863740e6cf052248a5671e64c73462c`)
  - **A-BE** = `skills/thh-code-backend/SKILL.md`
  - **A-FE** = `skills/thh-code-frontend/SKILL.md`
- **B** = `C:\thehirehub\claude-skills\thh-frontend-clean` (SHA `3dec922e44e87f0c6059c798b3d7d69de3c6403c`)
  - files under `thh-fe-audit/`

Every conflict below needs a human ruling. The "kept" column is provisional.

---

## 1. CONFLICTS

### C1 - Where a failed request becomes a thrown error
- **A-FE:110** and **A-FE:136-138**: the service returns `{ success, data, error }` and **does not throw**; the `queryFn` converts `!success` into a thrown error.
- **B `references/data-layer.md`:16**: the service fn itself must "throw a typed error, return typed data". **B `references/anti-ai-slop.md`:72-73** reinforces it: errors flow to the query error boundary or a typed `*ApiError`.
- **Kept: A** (merged `F-22`, `F-26`). The deployed `authenticatedFetch` already returns envelope-shaped results and the Flask API returns `{"success": ...}` (`B-27`), so A's contract is the one in production. B's structured-error escape hatch was preserved separately as `F-14`.
- **Decision needed:** if the team wants throwing services, `F-22`, `F-26` and `F-14` all change together.

### C2 - `staleTime` per query
- **A-FE:147-149**: "Do not re-specify `staleTime`, `retry` or `refetchOnWindowFocus` here, they are set once on the client instance. Override only with a comment." A-FE:605 records the configured global `staleTime` as **30s**.
- **B `references/data-layer.md`:55-56 (D7)** and **B `references/state.md`:51**: set `staleTime` deliberately per query (example 60s) because "TanStack Query default `staleTime` is `0`".
- **Kept: both, scoped** (`F-31` bans restating globals, `F-32` requires it on prefetched or hydrated queries).
- **Note:** B's stated premise is false in this repo. The default here is 30s, not 0, so the "prefetched query refetches immediately" argument does not hold as written.

### C3 - How mutations reach the server
- **A-FE:408-410**: route handlers under `src/app/api` are only for secrets, redirects and webhooks; ordinary API work goes through the service layer from the client. A-FE:181-190 shows every mutation as `useMutation` plus a service call.
- **B `references/nextjs.md`:37-52**: "Use Server Actions instead of hand-rolled API routes + client fetch for form/data mutations", with `revalidatePath` / `revalidateTag`. Repeated at **B `references/components-structure.md`:44** ("often removes dozens of lines per mutation") and **B `references/forms.md`:35-42**.
- **Kept: A as the default** (`F-52`), with B's Server Action rules retained conditionally (`F-53`) for work that genuinely runs server-side.
- **Decision needed:** the product database sits behind Flask, so a Server Action would be a second transport calling the same API with a second auth path. Either bless that or drop `F-53`, `F-84` server-side reuse and the `useActionState` guidance in `F-62`.

### C4 - Is the URL a state owner?
- **A-FE:36-41**: a three-row ownership table (Query / Zustand / derived) ending "There is no third category."
- **B `references/state.md`:10** and **B `thh-fe-audit/SKILL.md`:55**: filters, search term, active tab, page number and sort belong in **URL search params**, not React state.
- **Kept: B** (merged `F-01` table has four owners plus derived).
- **Reason:** strictly more precise. A's own categories do not settle where a shareable filter lives, and A's rule would push it into Zustand.

### C5 - Editing `components/ui` primitives
- **A-FE:280-282**: generated shadcn/Radix primitives "**Do not edit them in place**, the next `shadcn add` overwrites the file and the loss is invisible in review. Wrap the primitive."
- **B `references/styling.md`:44**: "You **own** the primitives in `components/ui`. **Extend them** (add a `cva` variant, accept more props) rather than forking or re-implementing."
- **Kept: reconciled into one rule** (`F-93b`): extend in place for repo-owned primitives, wrap instead for any file `shadcn add` regenerates.
- **Decision needed:** the repo has to declare which `ui/` files are regenerated. Today nobody can tell, which is how the seven-select mess in `F-141` happened.

### C6 - Package manager in the commands
- **A-FE:538-545**: `npm run typecheck`, `npm test`, `npm run lint`, `npm run format`, `npm run dev`, `npm run build`.
- **B `thh-fe-code/SKILL.md`:58 and :66** and **B `references/tooling.md`:33**: `pnpm typecheck`, `pnpm lint --fix`.
- **Kept: A (npm).** A's commands were measured in `thh-frontend` itself; B's are generic.

### C7 - Definition of done: does lint gate it?
- **A-FE:547-558** and **A-FE:493-498**: type check is **the** gate, `eslint.ignoreDuringBuilds: true` means lint errors do not fail the build, and lint/format are enforced outside the agent loop by husky and CI. "Lint and format **if** the repo enforces them."
- **B `references/tooling.md`:33**: "A change is complete only when `pnpm typecheck` **and** `pnpm lint` pass and relevant Vitest tests are green. Don't claim completion otherwise."
- **Kept: A** (`F-155` to `F-157`).
- **Decision needed:** B's rule is stricter and matches CI (`.github/workflows/ci.yml` runs lint). If CI can block a merge on lint, the agent-facing rule should say so.

### C8 - One bound Zustand store or many
- **A-FE:526** and **A-FE:574**: the repo has **15 separate stores**, and A treats each as its own module.
- **B `references/state.md`:120-140**: split a large store into slices and **combine into one bound store** (`create` + `devtools` + `persist` + `partialize`). **B `references/state.md`:149** lists 13 existing domains as "slices" and says add to the matching slice.
- **Kept: neutral** (`F-11` says add to the matching existing slice or store, and do not spin up a parallel store for the same domain).
- **Decision needed:** collapsing 15 stores into one bound store is a migration with its own task. Until that is decided, `F-09` (`partialize`) has no single place to live.

### C9 - Where a Zod schema file lives
- **A-FE:376-378** and **A-FE:527**: "Schemas live with the other schemas, not inline in the component", concretely `src/lib/schema.ts` and `src/lib/schemas/`.
- **B `references/components-structure.md`:6 and :10**: feature-first, "keep a feature's components, hooks, queries, schemas, and types together". **B `references/forms.md`:6** shows a per-feature `schema.ts`.
- **Kept: A's intent, B's flexibility** (`F-87b`: one reviewable place per feature, central or colocated, never split across both).

### C10 - May a component call `useQuery` directly?
- **A-FE:132-141** shows `useQuery` written inline at the consuming site, and **A-FE:296-299** only *recommends* data hooks.
- **B `references/data-layer.md`:17**: "Components call the hook, **never** `useQuery` directly and **never** a service fn directly."
- **Kept: B** (`F-25`). Stricter, and it is the rule that makes the key factory rule (`F-27`) enforceable.

### C11 - Global directories or feature folders
- **A-FE:519-528** documents the live layout: `src/services/*-service.ts`, `src/stores/`, `src/hooks/`, `src/types/`, `src/lib/schemas/`.
- **B `references/components-structure.md`:6-10** prescribes feature-first (`features/jobs/...`) with a one-way `app/` to `components/` to `lib/` graph, and calls a global `components/` a "dumping ground".
- **Kept: A's layout as the map (section 2.16), B's feature-first as the direction for new feature code** (`F-99`, `F-100`).
- **Decision needed:** these two produce different answers for every new file. Pick one before the next feature.

### C12 - Which system owns the auth token
- **A-FE:118-124**: `authenticatedFetch` "carries token or cookie transport, a request timeout, the 401 / 402 / 403 side effects".
- **B `references/integrations.md`:12-15**: session comes from `next-auth` v4; "the app token feeds `authenticatedFetch`".
- **Kept: reconciled** (`F-111`: next-auth supplies the session, `authenticatedFetch` is the only transport).
- **Note:** A never mentions next-auth anywhere, including its repo calibration. Confirm next-auth is actually wired before relying on `F-111`.

### C13 - `forwardRef` in existing primitives (B against itself)
- **B `references/react.md`:12**: older generated primitives "may still use `forwardRef`, **leave working code alone** unless you're editing it".
- **B `references/anti-ai-slop.md`:114 and :182**: `forwardRef` is listed flatly as slop to report.
- **Kept: the caveated version** (`F-60`: delete when you touch it).

### C14 - Manual memoization (B against itself)
- **B `references/react.md`:16**: if the React Compiler is **not** enabled, "still memoize genuinely hot paths and stable callbacks passed to memoized children".
- **B `references/anti-ai-slop.md`:114 and :182** and **B `thh-fe-audit/SKILL.md`:80**: hand-written `useMemo` / `useCallback` / `memo` is a finding, no caveat.
- **Kept: the caveated version** (`F-61`).
- **Decision needed:** nobody stated whether the React Compiler is on in `thh-frontend`. Neither source says. Until someone checks, `F-61` cannot be audited.

### C15 - Optimistic updates: default or exception
- **A-FE:196-198**: "Optimistic updates need `onMutate`, `onError` rollback and `onSettled` invalidation. If you are not writing all three, do not write the optimistic update." Default is plain invalidation.
- **B `references/state.md`:69**: presents the optimistic mutation as the "standard shape, copy it". **B `references/data-layer.md`:72-73 (D9)** contradicts that and makes invalidation the default.
- **Kept: A plus D9** (`F-34` to `F-36`).

### C16 - Service file size threshold
- **A-FE** sets no cap on service size and its calibration accepts the status quo.
- **B `references/data-layer.md`:3 and :29 (D3)** and **B `references/components-structure.md`:30**: a `*-service.ts` over **~400 lines** is a defect, while the repo's real files are ~3,365, ~2,700 and ~2,300 lines.
- **Kept: B's cap** (`F-24`), with incremental splitting and `U-03` (do not launch the repo-wide migration as a side quest).
- **Decision needed:** the three largest services are each 6x to 8x the cap. Either schedule the split as real work or raise the cap; leaving it as a standing finding makes every audit noisy.

### C17 - Barrel files (B against itself)
- **B `references/components-structure.md`:51**: "Don't create deep barrel `index.ts` files that re-export everything."
- **B `references/data-layer.md`:32-36 (D3)**: the prescribed split *has* `services/job/index.ts`.
- **Kept: reconciled** (`F-24`, `F-107`: a barrel only for a small stable public surface).

### C18 - The Inter example in the styling reference
- **B `references/styling.md`:13** uses `--font-display: "Inter", sans-serif;` as its `@theme` example.
- **B `references/anti-ai-slop.md`:16**: "display font is **Fraunces serif** via `--font-display`. We are not an Inter/Roboto app", and Inter is listed as a slop tell at `anti-ai-slop.md`:128 and :149.
- **Kept: Fraunces** (`F-143`). Flagged because the Inter line is in copy-paste position.

### C19 - Lint command
- **B `references/tooling.md`:12**: `"lint": "next lint"` (or `eslint .`).
- **A-FE:543**: `npm run lint` running "eslint 9 flat config".
- **Kept: A.** `next lint` is being retired in favour of running ESLint directly.

### C20 - Em dashes in prose
- **B `references/anti-ai-slop.md`:149 and :188**: em dashes in UI microcopy are an AI tell; ban them.
- **A-BE and A-FE** use em dashes throughout their own prose.
- **Kept: B's ban**, applied to the merged file's prose (`U-22`). Two em dashes survive inside the verbatim command block in section 2.16 because that block is copied verbatim.

---

## 2. GAPS

Ranked by importance. None of the three sources covers these.

1. **Logging.** No rule on levels, structured fields, request correlation, or what must never be logged (tokens, candidate PII, resume text, LLM prompts with personal data).
2. **Backend secrets handling.** Frontend env validation is covered (`F-59`, `F-134`); the Flask side has no rule for `.env` layout, key rotation, or never committing credentials.
3. **API error taxonomy.** The envelope carries a free-text `error` string, so the frontend can only branch on prose. No machine-readable error codes.
4. **Pagination contract.** No rule for list-endpoint page or limit parameters, total counts, cursor versus offset, or the matching frontend shape.
5. **Authorization model.** Backend has ownership filters (`B-19`) but no rule for where a permission policy lives or how the admin / collaborator / panelist roles are checked consistently across routes.
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

**Merged file:** `THH-CODE-STANDARDS.md`, **759 lines**.

| Section | Rules |
|---|---|
| 0. Universal | 22 (`U-01` to `U-22`) |
| 1. Backend | 60 (`B-01` to `B-60`) |
| 2. Frontend | 160 (`F-01` to `F-158`, plus `F-87b`, `F-93b`) |
| **Total** | **242** |

Frontend rules by subsection: 2.1 state 12, 2.2 services and HTTP 12, 2.3 queries 19, 2.4 Next 15 16, 2.5 React 19 15, 2.6 forms 14, 2.7 styling 11+1, 2.8 structure 10, 2.9 integrations 11, 2.10 performance 6, 2.11 types and tooling 13, 2.12 anti-slop 15, 2.13 cleaning 1, 2.14 completion 4.

Checklists: backend 31 items (1.9), frontend 39 items (2.15).

Source line counts consumed: A-BE 793, A-FE 648, B `thh-fe-audit/SKILL.md` 118, `thh-fe-code/SKILL.md` 92, `thh-fe-antiai/SKILL.md` 69, and 11 references totalling 816 lines. **2,536 source lines into 759.**

Conflicts: **20**. Gaps: **15**. Dropped: duplication and skill scaffolding only.
