# `lib/hq/future` — the prototype boundary

Everything in this folder is **interface prototype**. None of it touches the
database, and nothing outside this folder may invent domain data.

The rule for the Headquarters build:

- **Exists in the backend** → import from `@/lib/queries` (or an action) and wire
  it for real. Headquarters consumes the *same* domain layer as the mobile PWA;
  it never re-implements business logic.
- **Doesn't exist yet** → add a typed adapter here, return realistic Barracks
  data, and mark the surface in the UI with `<Proto />` from the HQ kit.

Each adapter is written as the shape we *expect* the real query to have, so
connecting it later is a matter of swapping the body — not rewriting the screen.
Where a real table already exists (squads, competitions, profiles…) the adapter
takes that live data as an argument and only invents the missing parts, so the
prototype stays anchored to your actual Barracks.

## What's mocked, and what would replace it

| Adapter | Replaced by |
|---|---|
| `battles.ts` | a `battles` + `battle_games` + `battle_evidence` schema (cross-group) |
| `network.ts` | a public Barracks directory + `challenges` table |
| `rivalries.ts` | derived from completed battles |
| `leagues.ts` | a `leagues` / `league_entries` schema |
| `presence.ts` | Supabase Realtime presence channel |
| `voice.ts` | WebRTC/SFU session, or a Discord voice bridge |
| `discord.ts` | Discord OAuth + a bot with guild-management scopes |
| `link.ts` | the Barracks Link desktop companion (process + OBS detection) |
| `commendations.ts` | a `commendations` table awarded by President/Captains |
| `elections.ts` | an `elections` + `ballots` schema (secret ballot, like `mutinies`) |
| `dispatch.ts` | a scheduled job composing the weekly report |

Nothing here should ever be imported by the mobile app.
