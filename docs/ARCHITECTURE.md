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

### Neutral vocabulary

| Core concept | Barracks presents it as |
|---|---|
| `User` | Operative / member |
| `Group` | **Barracks** |
| `Membership` | Roster entry |
| `RoleGrant` (who · role · scope · start · end) | President / Acting President / Captain / Acting Captain |
| `Squad` | Squad |
| `Game` | Game |
| `Event` | Operation |
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

The two worth planning deliberately: `competitions → events` and `scores → results`. The rest can alias.

**The single-tenant linchpin:** every RLS read policy is `using (auth.uid() is not null)` — any signed-in user sees every row. Multi-tenancy replaces this with *"you're a member of this row's group"* via `is_member(group_id)` / `has_role(group_id, role)`.

**Group deletion is never a hard cascade.** Domain tables reference `groups` with `on delete no action`, so deletion is *blocked* while history exists. Deleting a Barracks must eventually be a **soft-delete / archive** workflow (mark inactive, retain the record) — never a `delete group` that vaporises years of operations, court cases and results. `memberships` may cascade from `groups`; the domain tables must not.

---

## 7. Migration sequence (app works throughout)

| Phase | What | Risk | Behaviour change |
|---|---|---|---|
| **0** ✅ | v1 tagged, `experiments` branch | none | none |
| **1** ✅ | Internal refactor: `domain/data/permissions`; actions → thin wrappers | low (pure move) | **zero** |
| **2** | Additive multi-tenant model: `groups` + `memberships`, seed group, `group_id` everywhere, backfill | medium (DB, additive) | none — resolves the one group |
| **3** | Roles → membership; group-scoped RLS, table by table, dual-run then drop globals | **high (security)** | none if done right — test with 2 dummy groups |
| **4** | Neutral extraction: `events` / `results` / `role_grants`; Squads + squad memberships | medium | new features, additive |
| **5** | Stand up `apps/web` (Headquarters); promote `lib → packages`; add workspaces | medium | new client |
| **6** | Network layer: vs-Barracks challenges linking two groups | high | new milestone |

`main` stays v1; experiments happen on the branch with a Vercel preview; a phase merges to `main` only when proven. **Phase 3 is the delicate one** — a wrong RLS predicate could leak one group's data into another.

**Migration safety at scale.** Adding a column with a *constant* default is metadata-only (fast) in Postgres 11+, but `UPDATE` backfills (`ROW EXCLUSIVE`) and especially `SET NOT NULL` (a full-table scan under `ACCESS EXCLUSIVE`) can lock large tables. When a table is large: backfill in batches, and enforce NOT NULL via a `NOT VALID` check constraint + `VALIDATE` rather than a blocking scan. Always add the query indexes (`group_id`, membership `user_id`) while tables are small. At today's size all of this is instantaneous and moot.

---

## 8. Status log

- **2026-08-11 — Phase 0** complete. `v1` tag = commit `8da2038`. `experiments` branch created.
- **2026-08-11 — Phase 1** complete (on `experiments`). Zero behaviour change. Established `lib/domain`, `lib/permissions`, `lib/data/{queries,commands}`; migrated the `radar`, `requests` and `trials` Server Actions to thin wrappers over shared commands; adopted permission predicates across 10 pages. Build/typecheck/lint green. **Remaining actions still hold their own logic — to be migrated to the command pattern incrementally (same mechanical transform).**
- **2026-08-11 — Principle added:** "Ambitious surface, disciplined core" (§1) recorded as a permanent product/architecture constraint.
- **2026-08-11 — Phase 2 designed & reviewed.** Additive `groups` + `memberships` + `group_id` on 9 group-scoped tables (three-class split), seeded + backfilled, with indexes on `group_id` and membership `user_id`. RLS, roles and app all unchanged. Group deletion recorded as a future soft-delete workflow. **SQL ready; not yet applied.**
- **Next:** run the Phase 2 migration in Supabase, verify, then design Phase 3 (group-scoped RLS + roles→memberships) for review before applying.
