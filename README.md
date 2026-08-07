# The Threeball

A private progressive web app for a three-player golf league. Built from
`golf-league-pwa-brief.md` in phases.

Stack: Next.js 15 (App Router, TypeScript) · Supabase (auth, Postgres, storage,
realtime) · Tailwind v4 · hand-written service worker + `web-push` · Vercel.

## Setup

### 1. Install

```bash
npm install
```

### 2. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. **SQL editor** → paste and run `supabase/migrations/0001_init.sql`. This
   creates every table, the RLS policies, the private `photos` bucket, and the
   trigger that bootstraps a profile row on first sign-in.
3. **Authentication → Providers → Email**: keep "magic link" enabled.
4. **Authentication → URL Configuration**: add `http://localhost:3000/**` and
   your production URL to the redirect allow-list.

### 3. Environment

Copy `.env.example` to `.env.local` and fill in from **Project settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

(The VAPID and CRON values are only needed from Phase 7.)

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000>. You'll land on `/login` → magic link →
`/onboarding` (set name + nickname) → the app shell.

### 5. Lock signups down (after the three accounts exist)

**Authentication → Providers → Email → "Allow new users to sign up"** → off.
Or add an allowlist trigger on `auth.users`.

## Project shape

```
app/
  (app)/              four-tab shell (Header + TabBar), requires a profile
    page.tsx          / — Fixtures (home)
    calendar/         /calendar
    standings/        /standings
    you/              /you
    settings/         /settings
  login/              magic-link sign in
  onboarding/         first-run name/nickname/details
  auth/callback/      exchanges the magic-link code for a session
  actions/            server actions (auth, profile)
lib/
  supabase/           browser + server clients, session middleware
  auth.ts             getCurrentProfile / requireProfile
  types.ts            domain types mirroring the schema
components/            Header, TabBar, Avatar, Icons, LoginForm, …
supabase/migrations/  the schema
```

## Build phases

1. ✅ **Foundation** — this. Tokens, Supabase, schema + RLS, magic-link auth,
   the four-tab shell, onboarding.
2. Competitions — create/edit/cancel, fixtures list, next-up hero, RSVP.
3. Calendar — month grid, day sheet, `.ics` export. **Ship after this.**
4. The scorecard grid, then hole-by-hole entry, then skins/stableford.
5. Chat (Realtime). 6. Photos. 7. PWA + push. 8. Standings + profiles. 9. Polish.
