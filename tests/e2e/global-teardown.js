// NeoTopia · Playwright globalTeardown (T3 S9) · authenticated purge of E2E/bot test data.
// Runs ONCE after the whole suite. Calls purge_e2e_test_data() · SECURITY DEFINER, scoped to the
// test-username prefixes E2E%/BotAlpha%/BotBeta%, so it can never touch a real player.
// purge_e2e_test_data CARRIES NO VERSION NUMBER HERE ON PURPOSE, and that is a change of mind (T3 S51).
// S49 said a comment should carry the CHAIN, because a chain is a repo fact a gate can check, unlike
// applied-state. Both halves of that are still true and the gate still enforces it for anyone who cites a
// number. What a session of it showed is that THE CHAIN CHURNS: this exact comment was rewritten for the
// 5-link chain in S49, again when the next migration landed, and would have needed a third rewrite the
// same week · each one a fresh chance to be wrong about a fact that buys the reader nothing. A citation
// whose subject is under active development is a treadmill, and being told when you fall off it is not
// the same as not needing to run. So: no number, nothing to go stale, and the authority named instead.
// WHICH BODY IS RUNNING · ask pg_get_functiondef, never a file and never this line (Rule 109a).
// WHICH BODY IS DEPLOYED IS NOT RECORDED HERE ON PURPOSE, and that restraint was bought the hard way: I
// wrote "008 is what runs, 023 is unapplied" into five files this session and T2 applied 023 NINETY
// MINUTES LATER, with no commit to this repo. Deployment state changes without a diff, so a comment
// asserting it is stale the moment it is true. Ask the system of record · pg_get_functiondef on the live
// function (Rule 109a). At the last measurement 023 was applied and 014 was not.
// Per-test cleanup already hard-deletes the rooms it owns · this teardown's unique value is the residual
// player_profiles rows (no DELETE policy · only a definer fn can remove them) and crashed-test leftovers.
//
// ⚠ IT DELETES ROOMS OF ANY STATUS, INCLUDING ONES BEING PLAYED RIGHT NOW · and the scope is the username
// prefix ALONE. MIGRATION-HISTORY · migration 008 ("extend purge_e2e_test_data() to bot-hosted rooms of
// ANY status", T2 S12) dropped 006's `and r.status = 'finished'`, deliberately, because bot rooms strand
// in 'waiting'/'playing' and never reach 'finished'. Verified against the DEPLOYED function, not the file:
// there is no status
// predicate. game_sessions FKs game_rooms ON DELETE CASCADE, so a swept room's session row goes with it.
// CONSEQUENCE FOR HUMANS: a CI E2E run triggered by your push will delete the room your LOCAL live run is
// mid-game in · `gh run list` before a live run costs nothing and rules out the whole class. This is the
// S45 finding, which I wrongly retracted in S46 by reading migration 006 · 006 is the FIRST definition of
// this function, not the current one (Rule 109).
//
// AUTH: migration 007 restricts the RPC to the `authenticated` role · signInAnonymously() yields exactly
// that role (only a request with NO user JWT is `anon`), so we get access with NO service-role key in CI.
// Soft-fail always: cleanup is non-critical and must never fail the suite (or mask a real test result).

import { createClient } from '@supabase/supabase-js'
import { loadEnv, signInAnonRetry } from './seedHelpers'

export default async function globalTeardown() {
  let url, key
  try { ({ url, key } = loadEnv()) } catch { console.log('[teardown] no Supabase env · skipping purge'); return }
  try {
    const supabase = createClient(url, key, { auth: { storageKey: 'neotopia-e2e-teardown', persistSession: false } })
    await signInAnonRetry(supabase)                       // → `authenticated` role (migration 007)
    const { data, error } = await supabase.rpc('purge_e2e_test_data')
    if (error) throw error
    console.log('[teardown] purge_e2e_test_data →', JSON.stringify(data))
  } catch (err) {
    console.log('[teardown] purge soft-failed (cleanup is non-critical):', err?.message ?? err)
  }
}
