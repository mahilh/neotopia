// NeoTopia Supabase client
// Project: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
// Single shared client for the whole app. DB is the authoritative source of truth;
// the Zustand store (src/store/gameStore.js) is only a local mirror.
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error('NeoTopia: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY required in .env.local')
}

export const supabase = createClient(url, key, {
  realtime: {
    // Caps realtime message rate · keeps optimistic-update echoes from flooding clients.
    params: { eventsPerSecond: 10 },
  },
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    // Explicit storage so the anon session is deterministically restored on reload. The SSR
    // guard keeps this safe if the module is ever imported outside a browser (build/test).
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    // Explicit, app-owned key (vs the default sb-<ref>-auth-token) · stable + collision-proof.
    storageKey: 'neotopia-auth',
    // Anon-only app · no OAuth/magic-link fragment to parse · disabling URL detection removes
    // an async step that can race session hydration on load.
    detectSessionInUrl: false,
  },
})

// ── Global NeoTopia Index ─────────────────────────────────────────────────────
// The civilization counter shown on FinalScore · total consciousness districts built across ALL
// games. The real total is SUM(player_profiles.neotopia_index), but player_profiles RLS is own-row
// only (profiles_own · user_id = auth.uid()), so a client SELECT can't sum across players. Migration
// 004 adds a SECURITY DEFINER aggregate (get_global_neotopia_index) that returns ONLY the summed
// number · no per-player data. We anchor it on a canonical seed so the index always reflects the
// civilization's existing momentum (psychology doc · matches T1's FinalScore GLOBAL_INDEX_BASE).
export const GLOBAL_INDEX_BASE = 147823

// Real global index = base seed + every district recorded across all games. Resilient by design:
// any failure (RPC absent pre-migration, offline, RLS) falls back to the seed, so FinalScore never
// shows a broken number · it simply isn't yet enriched with the live aggregate.
export async function getGlobalIndex() {
  try {
    const { data, error } = await supabase.rpc('get_global_neotopia_index')
    if (error || data == null) return GLOBAL_INDEX_BASE
    return GLOBAL_INDEX_BASE + Number(data)
  } catch {
    return GLOBAL_INDEX_BASE
  }
}

// Record this game's districts onto the CALLER's own profile (atomic · auth.uid()-scoped and clamped
// to [0,56] inside the DB function). Best-effort · fire ONCE when a game ends. Returns { error } so
// the caller can log but never block the end screen on it. Deliberately NOT part of the synced game
// store · this is a post-game side effect, never part of the replayable reducer (rule 32 · a network
// write inside endTurn would fire on every client that applies the synced move → N× over-count).
export async function recordCivilizationContribution(districtCount) {
  const n = Number(districtCount) || 0
  if (n <= 0) return { error: null }
  const { error } = await supabase.rpc('increment_neotopia_index', { amount: n })
  return { error: error?.message ?? null }
}

// Record THIS client's per-game civilization scores into the permanent Global NeoTopia Index LEDGER
// (migration 009 · the detailed companion to the recordCivilizationContribution aggregate). Self-scoped:
// the RLS insert policy only lets a caller write its OWN player_id row, so each of the N clients writes its
// own row → one row per player per game · no cross-client over-count (same rule-32 discipline). Fire ONCE at
// game-end from the consumer's localStorage-guarded one-shot — the SAME guard FinalScore already uses for
// recordCivilizationContribution. The table's UNIQUE (session_id, player_id) makes an accidental re-fire
// idempotent (the duplicate insert errors · is swallowed). Best-effort · never throws · returns { error }.
export async function recordCivilizationDetail({ sessionId = null, username, scores = [0, 0, 0], cardsBuilt = 0 } = {}) {
  const { data } = await supabase.auth.getUser()
  const playerId = data?.user?.id
  if (!playerId) return { error: 'no auth user' }
  const s = Array.isArray(scores) ? scores : [0, 0, 0]
  const total = (Number(s[0]) || 0) + (Number(s[1]) || 0) + (Number(s[2]) || 0)
  const { error } = await supabase.from('global_neotopia_index').insert({
    session_id: sessionId,
    player_id: playerId,
    username: username ?? 'Anonymous',
    sacred_city_score: Number(s[0]) || 0,
    living_earth_score: Number(s[1]) || 0,
    free_energy_score: Number(s[2]) || 0,
    total_score: total,
    cards_built: Number(cardsBuilt) || 0,
  })
  return { error: error?.message ?? null }
}

export default supabase
