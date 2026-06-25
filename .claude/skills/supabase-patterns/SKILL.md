# SUPABASE PATTERNS — HARD-WON LESSONS
# Version: 1.0 · Rating: new · Created: June 25 2026
# Purpose: Every Supabase bug NeoTopia has hit is documented here as a pattern.
#          Read this before ANY Supabase code. 12 bugs prevented = 12 sessions saved.

## ACTIVATION

Read this skill when:
  · Writing any Supabase query, insert, update, or delete
  · Adding any RLS policy
  · Touching useAuth.js, useGameSync.js, useGameRoom.js
  · Creating any new migration
  · Any Supabase-related error appears in terminal output

## CRITICAL BUGS HIT IN NEOTOPIA — NEVER HIT AGAIN

### Bug 1 · RLS SELECT-only blocks writes (T3 S2)
SIMPTOM: DB rows appear fine via SELECT · INSERT/UPDATE silently fails · RLS error in logs
CAUSE: GRANTs give table access · RLS policies control per-command access SEPARATELY
  Having a SELECT policy does NOT imply INSERT/UPDATE/DELETE policies exist
FIX: Always define RLS policies for each command separately: SELECT · INSERT · UPDATE · DELETE
CHECK: SELECT pg_policies.* WHERE tablename='game_sessions' — list all policies by command
FIX APPLIED: migration 002 added INSERT+UPDATE policies membership-scoped

### Bug 2 · room_code CHECK constraint mismatch (T3 S2)
SIMPTOM: 23514 error on game_rooms insert
CAUSE: Forge generated 4-char codes · DB has CHECK(length=6)
FIX: Always read CHECK constraints before generating IDs · room_code is char(6)
CHECK: SELECT column_name, check_clause FROM information_schema.check_constraints

### Bug 3 · status CHECK constraint mismatch (T3 S2)
SIMPTOM: 23514 on status update
CAUSE: Code used 'lobby'/'closed' · DB CHECK IN ('waiting','playing','finished')
FIX: Status strings must match DB CHECK exactly · waiting/playing/finished are the only valid values

### Bug 4 · game_events.session_id FK mismatch (T3 S2)
SIMPTOM: FK violation on game_events insert
CAUSE: Code used room_id as session_id · game_events.session_id FKs to game_sessions.id (uuid)
FIX: Fetch game_sessions.id after initGame · cache in sessionIdRef · use ONLY that for game_events
  NEVER pass room_id where session_id is required

### Bug 5 · structuredClone throws on store state (T3 S2)
SIMPTOM: DataCloneError when snapshotting Zustand store
CAUSE: structuredClone cannot clone functions · Zustand store state includes function references
FIX: Always use serializableState() = JSON.parse(JSON.stringify(store.getState()))
  NEVER use structuredClone for Zustand state snapshots

### Bug 6 · GENERATED ALWAYS AS IDENTITY rejects explicit inserts (T3 S3)
SIMPTOM: 'column game_events.sequence_num was generated but can't be overridden'
CAUSE: information_schema shows NOT NULL + no default · but is_identity = YES
  IS_IDENTITY is NOT visible in information_schema.columns without explicit check
FIX: Never set sequence_num in INSERT · DB assigns it (1,2,3 auto)
CHECK: SELECT column_name, is_identity FROM information_schema.columns WHERE table_name='game_events'

### Bug 7 · anon session not persisting across reload (T1 S4 — ACTIVE BUG)
SIMPTOM: page reload creates a new anonymous user · RLS 403 on writes
CAUSE: signInAnonymously() creates a NEW user every call
  getSession() returns null on reload if Supabase client storageKey isn't set
FIX (pending T2 S6): add explicit auth config to createClient:
  auth: { persistSession:true, autoRefreshToken:true, storage:window.localStorage, storageKey:'neotopia-auth' }
  AND: use INITIAL_SESSION event instead of calling getSession() directly

### Bug 8 · Supabase Broadcast 32KB limit silently drops payload (REFORGE! T3)
SIMPTOM: Broadcast never arrives at subscribers · no error
CAUSE: Payload > 32KB is silently dropped
FIX: NEVER send deck/hand/tiles via Broadcast · signal only {type:'game_start',roomId}
  Clients pull full state from DB themselves via postgres_changes

### Bug 9 · channel overwrite without cleanup (REFORGE! T3)
SIMPTOM: React 18 strict mode creates 2 channel subscriptions · duplicate events
CAUSE: channelRef.current overwritten without removing old channel first
FIX: Always: if (channelRef.current) supabase.removeChannel(channelRef.current)
  BEFORE: channelRef.current = supabase.channel(...)

### Bug 10 · Zustand Set not JSON-serializable (REFORGE! T3)
SIMPTOM: pendingMoves Set serializes as {} · rehydrates as wrong type
FIX: Always: { ...state, pendingMoves: [...state.pendingMoves] } before DB write
  In syncFromServer: new Set(Array.isArray(pendingMoves) ? pendingMoves : [])

### Bug 11 · useCallback with store object reference (T2 S1)
SIMPTOM: infinite re-renders · stale closures
CAUSE: [store] in dependency array creates new reference every render
FIX: Never put store object in deps · use useGameStore.getState() inside callback

### Bug 12 · player_count race condition (T3 S3)
SIMPTOM: two joiners simultaneously → both write count=2 → one player lost
FIX: Use SECURITY DEFINER trigger that COUNTs actual rows:
  migration 003: trigger on room_players INSERT/DELETE → UPDATE game_rooms.player_count

## THE SUPABASE GATE (run before ANY Supabase code)

node --input-type=module -e "
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').trim().split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
const {data:{session}} = await s.auth.getSession()
console.log('session:', session?'EXISTS ✅ uid='+session.user.id.slice(0,8):'NULL ❌ auth bug active')
for (const t of ['player_profiles','game_rooms','game_sessions','room_players','game_events']) {
  const {error} = await s.from(t).select('count').limit(1).single()
  console.log(t+':', !error?'✅':error.message.includes('does not exist')?'❌ MISSING':'⚠️ '+error.message.slice(0,60))
}
"

## SUPABASE REALTIME RULES

  DB CHANGES (postgres_changes): authoritative game state · all game moves go here
  BROADCAST: ephemeral signals ONLY · max 32KB · never game state · never deck/hand/tiles
  PRESENCE: lobby player tracking · who is connected · ready status

  Channel cleanup: ALWAYS remove before create (rule 24)
  Reconnect: window 'online' event → full channel recreation + fetchAndSeed
  Mobile: document visibilitychange → visible → fetchAndSeed (WS suspends in background)

## RLS TEMPLATE (membership-scoped, the correct pattern)

-- Game sessions: only room members can update
CREATE POLICY sessions_update_member ON game_sessions FOR UPDATE
  USING (EXISTS (SELECT 1 FROM room_players WHERE room_id = game_sessions.room_id AND user_id = auth.uid()));

-- Always test policies with a real auth.uid() — RLS with anon key may behave differently than expected

## SELF-IMPROVEMENT HOOK

Every time a new Supabase bug is found:
  1. Add it as Bug N+1 to this file
  2. State: symptom → cause → fix → check command
  3. Run SKILLUPGRADE! supabase-patterns to push the updated file
  This skill grows with every bug hit. The compounding value increases over time.
