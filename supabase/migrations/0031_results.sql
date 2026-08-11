-- 0031_results.sql — Phase 4a: the universal Result model.
--
-- Additive and invisible: a new `results` table for EVERY game's scores (golf
-- included), scoped through its parent competition's group (same pattern as
-- `scores`). Backfills existing golf `scores` into `results` so the history is
-- there. Nothing reads `results` yet — golf still runs on `scores` untouched —
-- so this is safe to run. `scores` is retired later (4c), only once 4b's unified
-- path is proven. Run after 0030.

-- One row per entrant per event. Generic common fields + a metrics bag for
-- game-specific detail (golf: {strokes:[...]}, COD: {kills,deaths}, FIFA: {gf,ga}).
-- `confirmed` is the hook for AI screenshot→score: capture lands as unconfirmed,
-- a human confirms, then it counts.
create table if not exists results (
  competition_id uuid references competitions(id) on delete cascade,
  player_id      uuid references profiles(id)     on delete cascade,
  score          numeric,      -- the primary number (strokes, kills, goals, position…)
  placement      int,          -- final rank in the event (1 = winner); engine may fill it
  points         numeric,      -- league/table points awarded
  metrics        jsonb,        -- game-specific extras
  confirmed      boolean not null default true,
  recorded_by    uuid references profiles(id) on delete set null,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),
  primary key (competition_id, player_id)
);

alter table results enable row level security;

-- Child of competitions → scope through the parent's group (mirrors scores).
drop policy if exists results_read on results;
create policy results_read on results for select
  using (public.is_member((select group_id from competitions c where c.id = competition_id)));
drop policy if exists results_write on results;
create policy results_write on results for insert
  with check (public.is_member((select group_id from competitions c where c.id = competition_id)));
drop policy if exists results_update on results;
create policy results_update on results for update
  using (public.is_member((select group_id from competitions c where c.id = competition_id)));
drop policy if exists results_delete on results;
create policy results_delete on results for delete
  using (public.is_member((select group_id from competitions c where c.id = competition_id)));

-- Backfill golf history: each existing score → a result. Total strokes as the
-- score, the hole-by-hole array preserved in metrics. Idempotent.
insert into results (competition_id, player_id, score, metrics, recorded_by, confirmed, updated_at)
select s.competition_id,
       s.player_id,
       (select sum(v)::numeric from unnest(s.strokes) as v),
       jsonb_build_object('strokes', to_jsonb(s.strokes)),
       s.updated_by,
       true,
       s.updated_at
from scores s
on conflict (competition_id, player_id) do nothing;
