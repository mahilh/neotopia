// NeoTopia · Playwright globalTeardown (T3 S9) · authenticated purge of E2E/bot test data.
// Runs ONCE after the whole suite. Calls purge_e2e_test_data() (migrations 006/007/008 · SECURITY DEFINER ·
// scoped to the test-username prefixes E2E%/BotAlpha%/BotBeta%, so it can never touch a real player).
// Per-test cleanup already hard-deletes the rooms it owns · this teardown's unique value is the residual
// player_profiles rows (no DELETE policy · only a definer fn can remove them) and crashed-test leftovers.
//
// ⚠ IT DELETES ROOMS OF ANY STATUS, INCLUDING ONES BEING PLAYED RIGHT NOW · and the scope is the username
// prefix ALONE. Migration 008 ("extend purge_e2e_test_data() to bot-hosted rooms of ANY status", T2 S12)
// dropped 006's `and r.status = 'finished'`, deliberately, because bot rooms strand in 'waiting'/'playing'
// and never reach 'finished'. Verified against the DEPLOYED function in S48, not the file: no status
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
