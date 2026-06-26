# SUPABASE PATTERNS · SKILL
# Version: 3.0 · Rating: 192/200 · Upgraded: June 26 2026 (post S11)
# Prior: v2.0 · unknown rating · core patterns only
# Added: Migration lane ownership · purge RPC patterns · auth boundary patterns

## WHAT THIS SKILL DOES

Prevents DB contract violations, RLS errors, auth boundary mistakes,
and migration lane ownership conflicts that have cost 10-30min per incident.

## CRITICAL SUPABASE CONTRACT (NeoTopia-specific)

  DB: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
  Tables: rooms · profiles · game_sessions · game_events · global_neotopia_index
  All tables: RLS enabled · all access via authenticated or anon role
  game_sessions.phase CHECK: (playing|endgame|finished) — NOT 'scoring' · NOT 'ended'
  game_events.sequence_num: GENERATED ALWAYS AS IDENTITY — DO NOT set explicitly
  game_events.event_type: CHECK IN {draw_card,place_element,build_project,use_bonus,
                          factory_refill,turn_end,game_end} — exactly these strings

## MIGRATION LANE OWNERSHIP (critical · T3 S11 lesson)

  Migrations LIVE IN: scripts/migrations/ (NOT supabase/migrations/)
  Migrations are AUTHORED BY: T2 lane only
  T3 may: read migrations · validate SQL · hand T2 the exact SQL body
  T3 may NOT: write or apply migrations · own the migration file
  VIOLATION COST: T3 S11 rewrote Task A because the forge assigned migration to T3
                  — a lane violation that would have caused a collision
  GATE: ls scripts/migrations/ → confirms T2 owns this directory
        cat scripts/migrations/[latest].sql → read before prescribing SQL

## MIGRATION 001-008 SUMMARY

  001: Initial schema (rooms · profiles · game_sessions · game_events)
  002: global_neotopia_index table + increment RPC
  003: get_global_neotopia_index() RPC (SECURITY DEFINER)
  004: get/increment RPCs finalized
  005: rooms_delete_host policy · host_id=auth.uid() AND status='finished' · FK cascade
  006: purge_e2e_test_data() RPC · SECURITY DEFINER · E2E cleanup
  007: restrict purge to authenticated · anon_can_execute=false
  008 (PENDING T2 S12): extend purge to 'waiting' rooms for bot-named profiles
       SQL (T3 S11 validated): DROP status filter · keep username-prefix guard

## PURGE RPC SCOPE PATTERN (Rule 46 · Rule 44 · T3 S9/S10/S11)

  Every destructive RPC must:
    1. Check auth.uid() IS NOT NULL at the top (Rule 44)
    2. Scope by username PREFIX, not by status alone (real users have safe names)
    3. Be proven live before automating: signed call → expected return → unsigned rejected
    4. Return a JSON object with deletion counts (for audit trail)

  CURRENT SCOPE PROBLEM (21+34 = 55 bot rooms hand-purged in S10+S11):
    purge_e2e_test_data() only deletes status='finished' rooms
    Bot games that fail mid-setup leave rooms in status='waiting'
    Migration 008 extends the purge: drop status filter, keep username-prefix scope

  RULE 46 CHECKLIST before wiring any destructive function to automation:
    □ What tables does it touch?
    □ What is the exact scope guard? (username prefix, NOT status alone)
    □ What auth is required? (authenticated role · anon REJECTED)
    □ Prove live: signed call → {rooms_deleted, profiles_deleted} in return
    □ Prove live: unsigned call → 'permission denied' error
    □ Confirm: no real user data matches the scope guard

## sessionPhaseColumn CRITICAL PATTERN (T3 S8 · the most expensive bug)

  STORE phase name: 'scoring' (what the Zustand store uses)
  DB phase name: 'finished' (what game_sessions.phase column accepts)
  MAPPING LOCATION: src/hooks/useGameSync.js · sessionPhaseColumn() function
  CRITICAL: Never write 'scoring' directly to the DB · always go through sessionPhaseColumn()
  BUG HISTORY: Natural game-end was silently 400ing on EVERY game before this fix.
               pushState wrote 'scoring' → CHECK rejected → 400 → FinalScore never reached.
  GUARD: useGameSync.phasecolumn.test.js locks this contract
  GATE: grep -n 'sessionPhaseColumn\|scoring.*finished' src/hooks/useGameSync.js
        Expected: the mapping function present · 'scoring' → 'finished'

## GAME_EVENTS CONTRACT (most violated pattern)

  event_type: CHECK IN {draw_card,place_element,build_project,use_bonus,factory_refill,turn_end,game_end}
  WRONG: 'placeElement' · 'place-element' · 'PLACE_ELEMENT' · any camelCase or dash variant
  CORRECT: 'place_element' (snake_case, exact)
  TRANSLATION: resolveDbEventType() in useGameSync.js translates short names → DB names
  SEQUENCE_NUM: GENERATED ALWAYS AS IDENTITY → never set it explicitly in inserts
                Explicit set → 400 'cannot insert into generated column'

## REALTIME SUBSCRIPTION PATTERN

  DB events (postgres_changes): authoritative · survives reconnect · source of truth
  Broadcast: ephemeral · max 32KB · signal-only (never put large state in broadcast)
  Presence: lobby-only (who is in the room, not game state)
  Channel lifecycle: MUST call .unsubscribe() before creating a new channel (Rule 24)
  Race condition: DB sync can take 400-1200ms on Mumbai → prod delays → 800ms timeout fails

## ANON vs AUTHENTICATED ROLE PATTERNS

  Anon role: can read rooms, can insert profiles, can subscribe to realtime
  Authenticated role: same as anon PLUS can call SECURITY DEFINER purge RPCs
  Sign-in approach: signInAnonymously() → gets both anon token AND authenticated role
  WRONG: Using service-role key in client code
  CORRECT: signInAnonymously() in E2E teardown before calling purge RPC
  Rate limit: Supabase anon sign-in has hourly rate limit → CI runs once → under limit
                                                           → dev sessions may hit it

## ENVIRONMENT VARIABLE PATTERN

  Required: SUPABASE_URL · SUPABASE_ANON_KEY · VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY
  For tests: same vars loaded from .env.local via dotenv
  For CI: vars in GitHub Secrets (Mahil added these in T3 S10)
  For migration CLI: env vars loaded before supabase db push
  GATE: echo $SUPABASE_URL $SUPABASE_ANON_KEY | wc -c → Expected: >10

## USERNAME UNIQUENESS PATTERN (T2 S11 discovery)

  player_profiles.username: UNIQUE constraint
  Bot runs that use fixed names (BotAlpha1) WILL FAIL on the 2nd run → username collision
  FIX: Add per-run unique tag: BotAlpha${gameNum}_${Date.now().toString(36).slice(-5)}
  PURGE: purge_e2e_test_data() deletes profiles matching BotAlpha% · BotBeta% · E2E%
  GATE: Check bot-simulate.js has the unique tag pattern in the username construction line

## SELF-IMPROVEMENT TRIGGER

  SKILLUPGRADE! supabase-patterns → when a new RLS or RPC pattern appears
  SKILLUPGRADE! supabase-patterns → when migration 008 is applied (update 001-008 summary)
  SKILLUPGRADE! supabase-patterns → when Mumbai→Austin migration happens (July 2026)
