// NeoTopia · Playwright globalTeardown (T3 S9) · authenticated purge of E2E/bot test data.
// Runs ONCE after the whole suite. Calls purge_e2e_test_data() (migrations 006/007 · SECURITY DEFINER ·
// scoped to the test-username prefixes E2E%/BotAlpha%/BotBeta% · NEVER by status alone, so it can never
// touch a real player). Per-test cleanup already hard-deletes the rooms it owns · this teardown's unique
// value is the residual player_profiles rows (UNIQUE username · no DELETE policy · only a definer fn can
// remove them) and anything a crashed test left behind.
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
