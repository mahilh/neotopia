# SUPABASE PATTERNS — HARD-WON LESSONS
# Version: 1.1 · Rating: new · Updated: June 25 2026 (Bug 13 resolved)
# Purpose: Every Supabase bug NeoTopia has hit is documented here as a pattern.
#          Read this before ANY Supabase code. 13 bugs prevented = 13 sessions saved.

## ACTIVATION

Read this skill when:
  · Writing any Supabase query, insert, update, or delete
  · Adding any RLS policy
  · Touching useAuth.js, useGameSync.js, useGameRoom.js
  · Creating any new migration
  · Any Supabase-related error appears in terminal output

## CRITICAL BUGS HIT IN NEOTOPIA

### Bug 1 · RLS SELECT-only blocks writes (T3 S2 · FIXED migration 002)
SYMPTOM: INSERT/UPDATE silently fails with RLS error
FIX: Define RLS policies per-command separately. migration 002 added INSERT+UPDATE.

### Bug 2 · room_code CHECK constraint mismatch (T3 S2)
SYMPTOM: 23514 on game_rooms insert
FIX: room_code is char(6) CHECK(length=6) · codes must be 6 chars exactly

### Bug 3 · status CHECK constraint mismatch (T3 S2)
SYMPTOM: 23514 on status update
FIX: Status ∈ {waiting, playing, finished} only. NOT 'lobby' or 'closed'.

### Bug 4 · game_events.session_id FK mismatch (T3 S2)
SYMPTOM: FK violation on game_events insert
FIX: game_events.session_id → FK game_sessions.id (uuid) · NOT room_id

### Bug 5 · structuredClone throws on store state (T3 S2 · FIXED)
SYMPTOM: DataCloneError when snapshotting Zustand store
FIX: serializableState() = JSON.parse(JSON.stringify(store.getState())) · NEVER structuredClone

### Bug 6 · GENERATED ALWAYS AS IDENTITY rejects explicit inserts (T3 S3 · FIXED)
SYMPTOM: column game_events.sequence_num cannot be overridden
FIX: Never set sequence_num in INSERT · DB assigns it (1,2,3 auto)

### Bug 7 · Supabase Broadcast 32KB limit (REFORGE! T3)
SYMPTOM: Broadcast silently dropped, never arrives
FIX: Signal only {type:'game_start',roomId} · clients pull state from DB

### Bug 8 · Channel overwrite without cleanup (REFORGE! T3)
SYMPTOM: React 18 StrictMode creates duplicate subscriptions
FIX: Always supabase.removeChannel(channelRef.current) BEFORE creating new channel

### Bug 9 · Zustand Set not JSON-serializable (REFORGE! T3)
SYMPTOM: pendingMoves serializes as {} · rehydrates as wrong type
FIX: { ...state, pendingMoves: [...state.pendingMoves] } before DB write

### Bug 10 · useCallback with store object reference (T2 S1)
SYMPTOM: infinite re-renders · stale closures
FIX: Never put store object in deps · use useGameStore.getState() inside callback

### Bug 11 · player_count race condition (T3 S3 · FIXED migration 003)
SYMPTOM: two joiners simultaneously → one player lost
FIX: SECURITY DEFINER trigger on room_players INSERT/DELETE → COUNT actual rows

### Bug 12 · game_events 400 on insert (T1 S5 · FIXED T3 S6)
SYMPTOM: game_events INSERT returns 400 · sync still works (events are best-effort)
REAL CAUSE (the "session_id null" guess was WRONG · a 400 means the row REACHED the DB · a null ref
  would skip the insert with no HTTP call at all): event_type has a CHECK constraint
  event_type IN ('draw_card','place_element','build_project','use_bonus','factory_refill','turn_end','game_end').
  The app emits 'place'/'draw'/'score'/'endTurn' (useGameActions.persist) · NONE are in the set → 23514 → 400.
FIX: EVENT_TYPE_DB map in useGameSync.js translates app→DB vocabulary at the persistence boundary ·
  unmapped types skip + dev-warn. Guarded by src/hooks/useGameSync.eventmap.test.js.
LESSON: read the HTTP status as a witness · 400 (not 403, not "no request") = payload/CHECK, never a
  missing FK. Premise-check pg_constraint (NOT information_schema) · verify against the live predicate.

### Bug 13 · Anon session not persisting across reload (T2 S6 · FIXED d420342)
SYMPTOM: page reload = new user_id · RLS 403 · lost seat
ROOT CAUSE: getSession() raced against localStorage hydration · StrictMode double-mount fired signInAnonymously() twice
FIX: Drive auth entirely off onAuthStateChange INITIAL_SESSION event
  · signingIn flag prevents double-mint from StrictMode
  · storageKey: 'neotopia-auth' (explicit)
  · detectSessionInUrl: false (removes async racing step)
CONFIRMED: Node two-client test · same user_id across reloads ✓

## THE SUPABASE GATE

node --input-type=module -e "
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').trim().split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {auth:{storageKey:'neotopia-auth'}})
const {data:{session}} = await s.auth.getSession()
console.log('session:', session?'EXISTS ✅ uid='+session.user.id.slice(0,8):'NULL ❌ check storageKey')
for (const t of ['player_profiles','game_rooms','game_sessions','room_players','game_events']) {
  const {error} = await s.from(t).select('count').limit(1).single()
  console.log(t+':', !error?'✅':error.message.includes('does not exist')?'❌ MISSING':'⚠️ '+error.message.slice(0,60))
}
"

## SUPABASE REALTIME RULES
  DB CHANGES: authoritative game state · BROADCAST: ephemeral signals <32KB · PRESENCE: lobby only
  Channel cleanup: remove before create (rule 24)
  Reconnect: window 'online' + visibilitychange → fetchAndSeed (T3 S4)
  Mobile: visibilitychange → visible → fetchAndSeed (WS suspends in background)

## SELF-IMPROVEMENT HOOK
  Every new bug: add as Bug N+1 · symptom+cause+fix+confirmation · run SKILLUPGRADE! supabase-patterns
