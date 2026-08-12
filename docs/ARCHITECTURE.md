# The Barracks — Architecture North-Star

> Living document. The foundation is deliberately **boring, neutral and clean**; the Barracks *presentation* is deliberately **fun**. Update this as decisions change.

---

## 0. Product-surface rule (the spine of everything)

Barracks is **one platform, three surfaces**, each optimised for a different job:

- **Mobile = immediate participation and action.** The field/companion interface. Fast, obvious, fun — for the sofa, the pub, the moment before you play.
- **Headquarters (web/desktop) = depth, management and analysis.** Widescreen command software: scheduling, squads, roles, seasons, stats, team sheets, challenges.
- **Discord = conversation.** The noise. Barracks stays the structured source of truth and *pushes* into Discord; it never tries to replace chat.

**The safeguard (non-negotiable):**

> **A user should never need Headquarters simply to organise or participate in tonight's game.**

Mobile is a first-class client, not a cut-down viewer. Headquarters adds depth; it is never a prerequisite for play.

They are different **views of one system** — same users, groups, memberships, squads, role grants, events, calendar, results, permissions, backend. Never two products.

---

## 1. Ambitious surface, disciplined core

**Barracks is allowed to become extremely feature-rich and experimental — but the underlying platform must stay clean, fast, reliable and coherent.** Depth on the surface; discipline underneath.

Features are never added merely because they look impressive. Even deliberately silly or theatrical features must earn their place by doing one of two things:

1. make organising or playing together **easier**, or
2. make being part of a Barracks **meaningfully more fun**.

Court, elections, live Operation Rooms, team sheets, Race Control, medals, match reports, presence, structured chat, voice, streaming / room viewing, score capture, AI-assisted stat extraction — all intentionally playful, but each must behave like a **real, useful system**, not a decorative gimmick.

The architecture must allow experimentation **without contaminating the core**. Where appropriate, future capabilities are **modular or feature-gated** so they can be enabled or disabled without forking the application.

**Judging rule — do not reject a feature merely because it is ambitious.** Judge it on **product fit, usefulness, UX quality and architectural cleanliness**.

> These are not commitments to build any of these features now. They are constraints on *how* we design the platform, so we never unnecessarily block them.

**On live/media features specifically:** we will **not** build our own voice/streaming infrastructure now — Discord remains the practical voice/conversation layer initially. But "voice must be external" is **not** a permanent architectural constraint: **Live Operation Rooms are designed so native voice/media could be added later** if we deliberately choose to explore it. This does not change the current build sequence.

---

## 2. Milestones

1. **Current private Barracks** — keep improving what exists (one group, works today).
2. **Multi-tenant Barracks platform** — independent friend groups create their own Barracks and invite members. Complete isolation between groups; they don't interact yet.
3. **Desktop Headquarters** — the deep management interface over the same platform.
4. **Network / community layer** — discovery, Barracks profiles, find opponents, challenges, rivalries, Barracks-v-Barracks.

Multi-tenancy (milestone 2) is required the moment real independent groups use it — **not** merely as the gateway to vs-Barracks. vs-Barracks (milestone 4) then connects two groups through a Challenge/Match.

---

## 3. Core principles

- **Neutral engine, Barracks presentation.** The data model never encodes military vocabulary. Core concepts are generic; "Barracks" is a skin. This preserves future product modes (e.g. The Locker Room) without an engine rewrite.
- **Share meaning, not presentation.** Data, types, permissions, scoring and scheduling are shared across clients. Components, shells and navigation are deliberately *not* shared.
- **Multi-tenant data model before multi-tenant UX.** Shape the database for many groups while the app still behaves as one — everything additive, v1 stays alive at every step.
- **Modular monolith → monorepo, only when earned.** No microservices, no seventeen repos. A clean modular core with separate clients goes a very long way. Split when there's a real reason.
- **Code is reversible; the database is not.** DB changes are additive so the seed group keeps working; risky RLS changes are done table-by-table and verified.
- **RLS isolates tenants; the app permissions layer authorizes actions.** Row-Level Security enforces the *coarse, hard* boundary — you only ever see rows for groups you belong to (defense-in-depth, auditable). The *rich* rules (can this acting captain edit this squad during their date window?) live in `lib/permissions` as testable code, enforced because all writes go through server commands. Do **not** encode role/scope/date logic as RLS predicates — it becomes untestable SQL subquery soup.
- **Official results come only from recognised Barracks fixtures.** A `result` always attaches to a competition/event created in the Barracks — enforced: `results.competition_id` is a required FK, so a result *cannot* exist without a fixture. Barracks is **not** a personal COD/Steam/PSN stat-tracker; users can't upload arbitrary solo/historical results that affect standings. Individual metrics (kills, laps, accuracy) are extracted and stored as `metrics` *on that event's result*. Long-term, events gain a lifecycle (`scheduled → confirmed → room_open → live → result_pending → completed/archived`) and the future **Operation Room** is the natural place to capture results (screenshot / AI extraction / manual / evidence) against the event.
- **No universal player ranking — Operations vs Battles.** Barracks does **not** rank members as "best gamer" (unsolvable, and off-mission). Organised gaming is two kinds of **Event**:
  - **Operation** — a same-Barracks session. **Participation & history, not competition**: roster, actual attendance / no-shows, real start/finish/duration, a lightweight games-*count*, media. It records *who took part*, never *who won each round*. Feeds a personal **Service Record**.
  - **Battle** — one Barracks/Squad vs another. **Participation + a competitive TEAM result**: best-of-N, per-game team result, both-sided evidence + AI check, dual-Captain confirmation. Feeds **team** records, rivalries and (later) leagues.

  A **Service Record** is an individual's participation history + optional interesting metrics (Battle MVP, highest kills) — *history, not a leaderboard*. Competitive standings rank **teams**, never arbitrary individuals. Philosophy: **Barracks assists the night; it doesn't create homework** — favour passive/automatic capture; if an interaction doesn't add fun, confidence or useful history, don't ask for it.
- **Users are global; Barracks are many-to-many via Membership.** `User → Membership → Group`: a user has **`0..n`** memberships and can belong to several completely separate Barracks at once (The Barracks · Work Lads · Old School Mates) with the *same* identity but independent per-group context. A Barracks never owns the identity — **joining** creates a Membership (not a data copy), **leaving** deletes the Membership (not the User), and **`0` memberships is valid** (an account can exist before any group and join by invite). *Everything* group-ish — roles (President/Captain), squads, events, fixtures, results, rankings, court, warnings, history, permissions — is scoped **per membership**, so being President of A, a member of B and a Squad Captain in C never bleeds between them. Future: personal cross-Barracks scheduling that flags conflicts **without leaking** *what* you're doing (at most "unavailable 21:00–23:00"), and an aggregated personal *service record* over the user's **authorised** history (groups never see each other's private records).

### Neutral vocabulary

| Core concept | Barracks presents it as |
|---|---|
| `User` | Operative / member |
| `Group` | **Barracks** |
| `Membership` | Roster entry |
| `RoleGrant` (who · role · scope · start · end) | President / Acting President / Captain / Acting Captain |
| `Squad` | Squad |
| `Game` | Game |
| `Event` = `Operation` \| `Battle` | Operation (session) · Battle (vs another Barracks) |
| Personal history | Service Record |
| `Availability` | Availability |
| `Result` | Result / scorecard |
| `Activity` / `Message` | Comms |
| `Challenge` | Barracks-v-Barracks |

---

## 4. What is shared vs. not

**Shared (meaning):** the backend (DB, RLS, Supabase clients, auth/session); domain types; the read layer (queries); the write **commands** (pure logic beneath Server Actions); permissions predicates; scoring & scheduling engines; notifications (push, later Discord); design tokens.

**Not shared (presentation):** UI components (mobile cards ≠ desktop tables/grids/timing screens); shells & navigation (mobile TabBar/PWA vs desktop sidebars/multi-pane); page composition (which capabilities each surface exposes).

> Both clients call `getUpcomingEvents()` / `submitAvailability()` / `canManageSquad()`. Mobile renders a gorgeous card; desktop renders a grid.

---

## 5. Module architecture

### Near-term (inside the current single app — no workspace tooling yet)

```
lib/
  supabase/      db clients (server / client / middleware / admin)   [the "db" module]
  domain/        entity types — framework-free                        ✅ Phase 1
  permissions/   pure predicates (effectiveAdmin, canRule, …)         ✅ Phase 1
  data/
    queries.ts   server-side reads                                    ✅ Phase 1
    commands/    framework-free write logic (DI'd Supabase client)    ✅ Phase 1 (seeded)
  scoring.ts / standings.ts   scoring module (folder-promote later)
  scheduling/    availability / collision / coverage                  (future)
app/actions/*    thin Server Action wrappers → call lib/data/commands, then revalidate
components/      mobile UI
```

Modules are named to become the target `packages/*` — promotion, not rewrite.

### Target (milestone 3+, when Headquarters begins)

```
barracks/
  apps/     mobile/   web/
  packages/ db/  domain/  permissions/  data/  scoring/  scheduling/  notifications/  ui-core/
  supabase/ migrations/
```

Both clients are **Next** (shared tooling/tokens); mobile = the PWA, web = a widescreen app.

---

## 6. Database naming/relationships to evolve

| Today | Problem | Neutral target |
|---|---|---|
| `competitions` (+ golf cols: course/holes/format/par/stroke_index/tee_time) | golf legacy; conflates "event" with "golf comp" | `events` (game-agnostic) + golf detail in a side table/JSON |
| `profiles` holds `is_admin` / `is_president` | identity conflated with group-role | `users` (identity) vs `memberships` (per-group role) |
| `scores` (`strokes int[]`) | golf-shaped; can't score COD/FIFA | generic `results`; golf becomes one *template* |
| `app_settings` (`id = 1`, single row) | can't be per-group | per-group settings |
| `is_admin` naming | ambiguous: platform-owner vs group-organiser | reserve **admin** for platform; **president/owner** for group role |
| `player_id` / "player" everywhere | golf legacy (cosmetic) | `user_id` / member — alias, don't rush |
| `handle_new_user()` hardcodes an email → auto-crowns | single-owner assumption | group-join logic |

**The generic `Result` model is a first-class milestone (§7, Phase 4), not an afterthought.** The whole "game-independent" premise rests on it, and Squads, Service Records, Battle team-results and AI capture all depend on it — so the neutral result shape (event · entrant · `metrics jsonb` · placement) is designed **before** anything is built on the golf-shaped `scores`; golf becomes template #1. (`competitions → events` travels with it.) The rest of the table can alias.

**Results model — context-driven (⚠️ supersedes the earlier "matches → individual leaderboard" framing).** Results now carry **context** (see §3):
- **Operation → no per-member result.** Just participation: attendance, real times, duration, and a **games-count** — *how many games we played*, not who won each. Any participant can bump the count; the build must guarantee **one real-world game is logged once** even under near-simultaneous taps (mechanism the implementer's choice — e.g. an atomic server-side increment broadcast over Supabase Realtime). Never mandatory; the Captain reconciles the total at close.
- **Battle → the competitive path.** A Battle holds a **series** of games; each game is a **team** result (Barracks vs Shed) captured from **both sides** (screenshots → AI compares → *verified*, or *requires review* on disagreement/low confidence — AI is a checker, never the authority), then **both Captains confirm** the series. Per-game records + `metrics`/`confirmed` + AI live here. Individual metrics (kills, laps) are *optional enrichment* for Service Records/MVP, never a player ranking. Battles are **cross-group** — two Barracks — so they need their own entity + access rule (see §7, "Single-Barracks bridges" and Phase 6).

The `results` table (0031) survives as the generic store; `metrics`/`confirmed` become central to Battle capture. The Phase 4b individual `placement`→leaderboard work (`lib/rankings.ts` + the Ranks page) is **shelved** — the page repurposes into a **Service Record** view, not deleted.

**Operation Room — Op-1 scope (confirmed 2026-08-11; not the final form of live rooms).**
- **Lifecycle:** `scheduled → live (started_at) → completed/archived (finished_at)` (+ cancelled). `0032` adds `started_at`/`finished_at`/`games_count` to the event and `rsvps.attended` (null · present · no-show).
- **Roll call:** pre-filled from RSVP-*in*; the **CO** confirms present / marks no-shows → `attended`. RSVP = "expected?", `attended` = "turned up?". No-shows can feed the Courtroom.
- **Live games count:** any participant advances it via `advance_games(event, expected)` — a compare-and-set, so simultaneous taps collapse to one increment (**one real game logged once**). **Never mandatory**; the CO reconciles the total at close.
- **Realtime:** `competitions` + `rsvps` broadcast over Supabase Realtime (RLS-scoped) so roll-call, games-count and room status update instantly for everyone in the room.
- **Close & archive:** the CO reviews times/duration/games/deployed, corrects, confirms → `finished_at` set, archived.
- **Service Record:** aggregates a user's **attended** Operations (operations, hours, games, per-squad/game, no-shows, attendance %). Repurposes the shelved Ranks work → the profile becomes the Service Record; the leaderboard is retired.
- **Role:** **CO = the current organiser / President** for now; becomes the **Squad Captain** for a Squad's Operation once Squads exist — same concept, no rename.
- **Not in Op-1 (later):** richer presence, automatic game detection, **Battle rooms** (cross-group, own entity + access rule), voice/media.

**Squads — Sq-1 scope (confirmed 2026-08-11).** A Barracks holds game-specific squads:
- **One game per squad, hard-locked** (`unique(group_id, game)`) — the game *is* the squad's identity ("plan games, not players"). Change = delete & rebuild.
- **`squad_members`** many-to-many; **one Captain** (`is_captain`), set by the CO, changeable later (courts). The Captain is CO for that squad's Operations.
- **Acting Captain per event:** the Captain may appoint an acting Captain for a *single* Operation (`competitions.acting_captain_id`) — a mini RoleGrant (role · scope = event · that event only).
- **Join:** members **self-join**; the **Captain (or CO) can remove** members.
- **Operations belong to a squad** (`competitions.squad_id`, nullable) → squad-scoped roster + notifications (only ping people who play that game — the original day-1 problem).
- Order: **Sq-1** data (`0034`) → Sq-2 management + views → Sq-3 squad Operations (picker, scoped notifications, Captain-as-CO, acting Captain) → Sq-4 squad pages + home/calendar filter. Single-group; fits the foundation.

**The single-tenant linchpin:** every RLS read policy is `using (auth.uid() is not null)` — any signed-in user sees every row. Multi-tenancy replaces this with *"you're a member of this row's group"* via `is_member(group_id)` / `has_role(group_id, role)`.

**Group deletion is never a hard cascade.** Domain tables reference `groups` with `on delete no action`, so deletion is *blocked* while history exists. Deleting a Barracks must eventually be a **soft-delete / archive** workflow (mark inactive, retain the record) — never a `delete group` that vaporises years of operations, court cases and results. `memberships` may cascade from `groups`; the domain tables must not.

---

## 7. Migration sequence (app works throughout)

| Phase | What | Risk | Behaviour change |
|---|---|---|---|
| **0** ✅ | v1 tagged, `experiments` branch | none | none |
| **1** ✅ | Internal refactor: `domain/data/permissions`; actions → thin wrappers | low (pure move) | **zero** |
| **2** ✅ | Additive multi-tenant model: `groups` + `memberships`, seed group, `group_id` everywhere, backfill | medium (DB, additive) | none — resolves the one group |
| **3** ✅ | Roles → membership; group-scoped RLS, table by table, dual-run then drop globals **(prereqs below)** | **high (security)** | none if done right |
| **4** | **Generic `Result` model (first-class)** + `events` + `role_grants` — design the neutral result shape **before** anything depends on golf-shaped `scores`; golf becomes template #1 | medium | additive |
| **5** | Squads + squad memberships (built on the Result model) | medium | new features, additive |
| **6** | Stand up `apps/web` (Headquarters); promote `lib → packages`; add workspaces | medium | new client |
| **7** | Network layer: vs-Barracks challenges linking two groups | high | new milestone |

`main` stays v1; experiments happen on the branch with a Vercel preview; a phase merges to `main` only when proven. **Phase 3 is the delicate one** — a wrong RLS predicate could leak one group's data into another.

**Phase 3 prerequisites (non-negotiable):**
1. **A separate staging Supabase project.** The live app and the `experiments` branch currently share one database, so an RLS change would hit production instantly. All RLS work happens on staging first; only proven policies reach the live DB. **Staging is used via its SQL editor ONLY — never put staging's keys in Vercel.** (On 2026-08-11 they did, which pointed the live app at the empty staging DB; fixed by restoring the live-Barracks keys + redeploy.)
2. **A minimal cross-tenant integration test.** Seed two groups and assert group A cannot read group B's rows — before flipping any read policy. (The codebase has no tests today; this is the one place they're mandatory.)
3. **New-user enrolment.** `handle_new_user()` creates a profile but **no membership**, so a new signup currently has no group. Before RLS goes group-scoped, new users must be enrolled into a group (via the trigger or the onboarding flow) or they'd be locked out. Harmless today (reads are still global); mandatory before Phase 3.

**Migration safety at scale.** Adding a column with a *constant* default is metadata-only (fast) in Postgres 11+, but `UPDATE` backfills (`ROW EXCLUSIVE`) and especially `SET NOT NULL` (a full-table scan under `ACCESS EXCLUSIVE`) can lock large tables. When a table is large: backfill in batches, and enforce NOT NULL via a `NOT VALID` check constraint + `VALIDATE` rather than a blocking scan. Always add the query indexes (`group_id`, membership `user_id`) while tables are small. At today's size all of this is instantaneous and moot.

**Single-Barracks bridges to unwind (before multi-Barracks UX).** The data model already supports many-to-many `Users ↔ Groups` (`memberships` is a join table; every group record carries `group_id`). These are deliberate *single-group* simplifications that would bleed across Barracks if left — each removed when a user can hold multiple memberships:
1. `profiles.is_admin/is_president` (global) + the `sync_roles` trigger — a role change propagates to **all** the user's memberships. → drop the global columns + trigger; roles live only on `memberships` (per group).
2. `handle_new_user` auto-enrols every signup into the seed group. → invite-based joining; `0` memberships valid.
3. `app_settings` is a single global row. → per-group settings.
4. `group_id` columns **default** to the seed group. → the app sets `group_id` explicitly per current group (drop the default).
5. The app reads `profile.is_admin/is_president` with no "current group" concept. → resolve role from the current membership.
6. Reads (`getRankings`, `getProfiles`, …) return everything RLS allows = merged across **all** a user's groups. → add a "current group" filter so each Barracks view is scoped.

None are bugs today (one user, one group); they're the transition checklist for the first time a user joins a second Barracks.

---

## 8. Status log

- **2026-08-11 — Phase 0** complete. `v1` tag = commit `8da2038`. `experiments` branch created.
- **2026-08-11 — Phase 1** complete (on `experiments`). Zero behaviour change. Established `lib/domain`, `lib/permissions`, `lib/data/{queries,commands}`; migrated the `radar`, `requests` and `trials` Server Actions to thin wrappers over shared commands; adopted permission predicates across 10 pages. Build/typecheck/lint green. **Remaining actions still hold their own logic — to be migrated to the command pattern incrementally (same mechanical transform).**
- **2026-08-11 — Principle added:** "Ambitious surface, disciplined core" (§1) recorded as a permanent product/architecture constraint.
- **2026-08-11 — Phase 2 designed & reviewed.** Additive `groups` + `memberships` + `group_id` on 9 group-scoped tables (three-class split), seeded + backfilled, with indexes on `group_id` and membership `user_id`. RLS, roles and app all unchanged. Group deletion recorded as a future soft-delete workflow. **`0029` run & verified 2026-08-11 — 1 player = 1 membership, 0 rows missing group. Phase 2 complete.**
- **2026-08-11 — Plan updated (design review incorporated):** staging Supabase project required before Phase 3; **"RLS isolates tenants; the app layer authorizes actions"** added as a core principle (§3); generic `Result` model promoted to a first-class milestone (§7 Phase 4) ahead of Squads; minimal cross-tenant integration test required before Phase 3; live/media clarified (§1 — Discord initially, native voice possible later, not a permanent constraint). **None of this changes the Phase 2 SQL.**
- **2026-08-11 — Phase 2 complete & verified.** `0029` run on the Barracks DB; 1 player = 1 membership, 0 rows missing group. Data model is now multi-tenant-shaped; app behaviour unchanged.
- **2026-08-11 — Phase 3 built & staging-verified.** Staging Supabase project stood up; `0030` (group-aware helpers, every policy group-scoped, roles on `memberships` via a profiles→memberships sync trigger, group-scoped `president_rule`, new-user enrolment) applied cleanly; the two-group isolation test **passed** (A sees only the seed group, B sees only Group B). DB-only — no app changes needed (the app still reads `profiles`, kept in sync). **Not yet on production.**
- **2026-08-11 — Phase 3 complete & LIVE.** `0030` applied to production; live app smoke-tested, behaving normally. Group-scoped RLS + per-group roles are in production. **The multi-tenant foundation (Phases 1–3) is done.**
- **2026-08-11 — Consolidated + incident.** `experiments` merged to `main` (Phase 1 refactor now live; `v1` tag remains the fallback). A Vercel env-var mix-up briefly pointed the live app at the empty staging DB — fixed by restoring the live-Barracks Supabase keys + redeploy. **Guardrail recorded: staging is SQL-editor-only, never wired into Vercel** (§7). `apply_migrations.sql` covers through `0029`; `0030`/`0031` run as standalone files (reconcile the master when convenient).
- **2026-08-11 — Phase 4a complete & live.** `results` table + group-scoped RLS (via parent competition) created on staging + production; golf backfill ran (`0` rows — the Barracks has no golf scores; that history lives in the separate `threeball` app). The universal results store is ready and empty.
- **2026-08-11 — Phase 4b built.** Wins-based rankings engine (`Played · Wins · Win% · Streak`; rank by wins, tie-break win%), finishing-order **result entry** on non-golf events, Ranks page rewritten to the general leaderboard from `results`. Build/typecheck/lint green. Recorded two permanent rules (§3): **official results only from Barracks fixtures** and **Users↔Groups many-to-many via Membership**; single-Barracks bridges to unwind flagged (§7). **Merged to `main`, deployed & smoke-tested OK.**
- **2026-08-11 — Results forward-design recorded (§6).** A game night is many **matches**, not one game; ranking unit = match; **Fixture → Match → Result**; each match selects its game (dropdown) → renders that game's scoreboard template; AI card-capture fills `metrics`/`confirmed`. This is a **Headquarters** build (heavy multi-card capture/review); mobile shows the finished table. 4b (finishing-order) is the degenerate single-match case, extends additively.
- **2026-08-11 — Direction change: no universal player ranking.** Retired the "best player" leaderboard. Model is now **Event { Operation | Battle }** (§3): Operation = participation/history → **Service Record**; Battle = participation + competitive **team** result (cross-group). Phase 4b's individual rankings (`lib/rankings.ts` + Ranks page) are **superseded/shelved** — the page repurposes to a Service Record view; the `results` store + AI-capture design survive.
- **2026-08-11 — Operation Room scoped + Op-1 built.** Decisions locked: CO = current organiser (→ Squad Captain later), attendance via `rsvps.attended`, live room on Supabase Realtime. `0032` (Op-1: `started_at`/`finished_at`/`games_count`, `rsvps.attended`, `advance_games` compare-and-set, Realtime on `competitions`+`rsvps`) written — additive, **staging-first**, not yet run.
- **2026-08-11 — Operation Room complete (Op-1→Op-4), live.** `0032`+`0033` run; the live room (start → realtime games-count → roll call → close/archive with correctable total) and the **Service Record** (participation): profile Service Record + the Ranks page repurposed to **Service Records** (participation, not a ladder). The individual leaderboard is **retired** — `rankings.ts` / `RankingsTable` / `RecordResult` now unused. Build/typecheck/lint green.
- **2026-08-11 — RSVP lock fixed.** Once an operation starts or closes, RSVP is locked (UI hidden + server-side reject) — no post-close flip-flopping. Recent + Calendar serve as read-only history.
- **2026-08-11 — Squads scoped + Sq-1 built.** Decisions: one game/squad (hard-locked), one Captain (+ acting Captain per event), self-join + Captain-removes. `0034` (`squads`, `squad_members`, `is_squad_captain`, `competitions.squad_id`+`acting_captain_id`) written — additive, staging-first, not yet run.
- **2026-08-11 — Sq-2 live; Sq-2b built.** Squads tab: form/request one squad per game, self-join, Captain appointment, disband. **Sq-2b** adds **clan tag** (editable by Captain/CO) + a **request → President approve/decline** flow (`0035`). Confirmed: the President oversees all squads without joining (empty squad just hid "make captain" until someone joined). Captain poll kept as an *optional* later add.
- **2026-08-11 — Squad name required + Sq-3a live.** Squad name made mandatory (form + command). **Sq-3a**: the deploy sheet gains a **Squad picker** (whole Barracks vs a squad — a squad locks the op's game); a squad op scopes its **roster / roll call / room** to squad members and pings **only that squad**; the room **CO** is now the squad Captain (or an event's acting Captain) *as well as* the President. No migration (uses `competitions.squad_id`/`acting_captain_id` from `0034`). Code-only; build/tsc green.
- **2026-08-11 — Sq-3b live.** Made Captain-as-CO real at the DB: `can_command(event)` = CO **or** the squad's Captain **or** the event's acting Captain; `start_operation` / `close_operation` are now gated functions (were direct group-admin-only updates that would have denied a Captain), `set_attendance` re-gated on `can_command`, and `set_acting_captain(event, player)` lets the real Captain/CO name a stand-in for one night. Room UI: CO gets an **Acting Captain** picker (squad ops only); others see who's leading. `0036` run on prod, code merged to main.
- **2026-08-11 — Requests reworked around squads (route A).** Decision: **the squad owns its game.** Games *with* a squad are organised inside it (by the Captain); games *without* a squad = the President deploys directly. So the old home "Request a game" board is **retired**. Replaced with an in-squad **member → Captain "Request a night"** nudge (`0037` `squad_night_requests`): persisted + pings the Captain (CO fallback if no Captain), shown on the squad card with Clear. `GameRequests`/`getOpenGameRequests`/`app/actions/requests.ts` now dead code (kept, unmounted).
- **2026-08-11 — Captain's Muster live.** `0038` run on prod, code merged. `musters` + `muster_responses` (RLS: Captain-or-CO writes musters, self-only responses). Flow live in `components/Muster.tsx` on each squad card: Captain **calls a Muster** (next-7-days chips + proposed times + note → pings squad) → members **tick their nights** (Save) → Captain sees a **tally** and **proposes** a night+time up to the President → President gets an **Approve & deploy** (editable date/time) / **Send back** card → approve **inserts a squad Operation** (competition) + pings the squad → roll call opens. One active muster per squad; the member "Request a night" nudge hides while a muster runs. ⚠️ `0038` is a hard dep (getSquads reads both tables) — run before deploying. Code on `experiments`; build/tsc green.
- **Superseded plan — the Captain's Muster (pre-week arrangement).** Built as above. Original spec: Captain opens a **Muster** for the week ahead (date range + proposed times) → squad taps the nights/times they can do (date tabs) → Captain sees the tally, picks the best night → **sends up to the President** → lands as a **pre-filled deploy sheet** (approve = deploy) → on the board → **roll call (in/out)** opens. Two distinct polls by design: **Muster** = "when *could* we?" (soft, Captain-run), **Roll call** = "are you *in*?" (hard, post-approval). Parked: Sunday auto-muster, President-side auto-checker (clashes/availability), Captain add/remove notifications. Then Sq-4 (squad pages + filters); Battles remain the cross-group / Headquarters future.
- **2026-08-11 — Muster polish + a stored inbox feed.** Muster tweaks: single **Proposed time** field (was a broken multi-add); **Call a Muster** is now Captain-only (CO only when a squad has no Captain — was showing on every squad for the President). **Notifications** (`0039`): the inbox was fully *derived*, so muster/night pushes showed on-screen but never landed in it. Added a `notifications` table + `notify(users[],…)` fan-out (SECURITY DEFINER, shared-group scoped; service-role/cron may notify anyone). Muster-called / proposed / sent-back + the member night-wanted nudge now **push AND persist** → shown in "Waiting on you" as clickable **Open** links; opening the inbox marks them read. "Game on" stays derived (roll-call item) to avoid double-listing. Future: route more existing pushes through `notify`; cron persistence.
- **2026-08-11 — Activity feed unified + home simplified.** The `/activity` "Comms Log" (bell's destination) already had a persistent, filterable feed (All·Messages·Court) — so we **extended it** rather than build a parallel notifications hub. `getActivityFeed` now also derives **squad events**: musters (open = *message* to the squad, proposed = *request* to the CO), member **night nudges** (request → Captain), **squad-formation requests** (request → President) — role-scoped so requests reach only the CO / relevant Captain. New **Requests** tab (Captains & President only); **Messages** broadened to games/comments/muster-called. **Home** stripped to Next game / Upcoming / Recent (President's *New game* kept) — the "Waiting on you" strip moved fully into the bell. The `0039` stored-notifications stopgap is reverted (table left unused; derived feed supersedes it). No migration. Role model: member = All·Messages·Court; Captain/President add Requests (team→Captain, Captain→President). Parked: routing more pushes through the feed badge; "Messages" could later split announcements from chat.
- **2026-08-12 — Courtroom fixed + the Mutiny.** Root cause of the "weird" court: `canRule` was a **global** flag never checked against the complaint, so a President saw the response box *and* the full ruling toolkit on a complaint about themselves — and could close it (RLS permits president updates; the action had no role check, and RLS also let the *accused* update their own row). Also `complaints` had **no delete policy at all** (a stuck case could never be cleared — `0041`), `fileComplaint` pinged the accused twice via a duplicated `if` and pinged a President about themselves, and `ruleOnComplaint` notified nobody of the outcome. All fixed.
  **New principle — nobody judges their own case.** Ordinary complaints can no longer name the President; moving against them goes through a **Mutiny** (`0042`): a member states a case → the ranks vote agree/stand-by → **carried** = raiser names an impartial judge, opens a trial with the President as defendant, and that judge rules *alone* (`president_rule` re-gated on `trials.judge_id`; the trial page mirrors it) → **failed** = collapses, and the President is told the complaint *and* who raised it. **Secrecy is an RLS guarantee, not a UI one:** the target cannot `select` a `voting` row and votes are readable only by their voter (tally denormalised on the row); every write goes through SECURITY DEFINER functions, so there are deliberately no insert/update policies. Resolves the moment a majority of *eligible* voters is reached, so it can't hang on a non-voter. Complaints + mutinies now render under the Comms Log **Court** tab.
- **Next:** the **muster time model** (per-night from–to windows + overlap; rebuilds the date chips), then Sq-4 (squad pages + filters). Battles remain the big cross-group / Headquarters future.
