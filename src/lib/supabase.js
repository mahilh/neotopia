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
// (migration 009 · the detailed companion to the recordCivilizationContribution aggregate). The write goes
// through the SECURITY DEFINER record_civilization_score RPC (NOT a direct insert), so the server — not the
// client — sets player_id = auth.uid() (self-scoped · no forging), DERIVES the username from the caller's
// player_profiles (no impersonation in the public record), CLAMPS each score, and RE-DERIVES total_score
// (the client cannot lie about the public ledger). Fire ONCE at game-end from the consumer's
// localStorage-guarded one-shot — the SAME guard FinalScore uses for recordCivilizationContribution; the
// table's UNIQUE (session_id, player_id) + ON CONFLICT DO NOTHING makes a re-fire idempotent. sessionId is
// REQUIRED (it is the dedup key · a null would defeat the guard). Best-effort · never throws · { error }.
export async function recordCivilizationDetail({ sessionId, scores = [0, 0, 0], cardsBuilt = 0 } = {}) {
  if (!sessionId) return { error: 'no session' }
  const s = Array.isArray(scores) ? scores : [0, 0, 0]
  const { error } = await supabase.rpc('record_civilization_score', {
    p_session_id: sessionId,
    p_sacred: Number(s[0]) || 0,
    p_living: Number(s[1]) || 0,
    p_free: Number(s[2]) || 0,
    p_cards: Number(cardsBuilt) || 0,
  })
  return { error: error?.message ?? null }
}

// ── The read path for the three stat columns (T2 S32 · closing the trap named in S31) ─────────
// games_played, games_won and elo_rating have a writer (migration 019) and NO READER. That is the
// exact six-week mechanism this project keeps rediscovering: a value nobody reads is a value nobody
// notices breaking, and every one of these has a resting value indistinguishable from correct.
// A reader is not decoration · it is the only thing that would ever raise the alarm.
//
// RLS is own-row (profiles_own · user_id = auth.uid()), so this returns the CALLER's own stats and
// cannot see anyone else's. Never throws · returns null when unauthenticated or unreachable, so a
// consumer renders nothing rather than a broken zero (an absent stat and a zero stat must not look
// the same · that confusion is the whole bug).
//
// >>> T1 · THE RENDER REQUIREMENT, precisely <<<
//   WHERE   the lobby name/profile area, and FinalScore's own-player block.
//   SHAPE   { gamesPlayed: number, gamesWon: number, elo: number } | null
//   COPY    "Games played N" · show gamesWon ONLY once it can be non-zero (see below) · elo is
//           seeded 1000 for everyone and is NOT yet meaningful, so do not display it as a rank.
//   NULL    render NOTHING, not "0". The distinction is the point.
//   NOTE    a practice game must never move these · practice has no session, so it cannot.
export async function getMyProfileStats() {
  try {
    const { data: { user } = {} } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase
      .from('player_profiles')
      .select('games_played, games_won, elo_rating')
      .eq('user_id', user.id)
      .maybeSingle()
    if (error || !data) return null
    return {
      gamesPlayed: Number(data.games_played) || 0,
      gamesWon: Number(data.games_won) || 0,
      elo: Number(data.elo_rating) || 0,
    }
  } catch {
    return null
  }
}

// Award the win for a finished session (migration 020 · T2 S33). The whole-session comparison the
// per-caller record_civilization_score could not make: award_game_win reads the `game_end` audit row,
// the one place that already sees every seat, recomputes the winner from final_scores[].total and
// increments the winner's games_won exactly once.
//
// IT DELIBERATELY IGNORES event_data.winner_seat, which the payload already carries. That field is a
// stable-sort tiebreak ("lowest seat among the top scorers"), not a victory · all 3 game_end rows in
// production are 0-0 ties reporting winner_seat 0, so trusting it would have awarded seat 0 a win in
// every game ever finished here. A TIE AWARDS NOBODY.
//
// Nothing is taken from the request but the session id · the outcome comes from the stored row, so no
// client can nominate itself, and a non-participant is rejected outright.
//
// >>> T1 · CALL SITE, and the ordering is load-bearing <<<
//   WHERE  FinalScore.jsx, the same effect that already fires buildGameEndEvent.
//   WHEN   AFTER sync.pushState(...) has resolved · this reads the row that push writes. A call that
//          lands first returns 'no_game_end' and writes nothing.
//   WHO    EVERY seat, not just the lowest. It is idempotent (game_wins.session_id is the primary key
//          and the increment is conditioned on the insert actually happening), and the extra callers
//          are the recovery path for when the lowest seat closes the tab before the write.
//   SOLO   skip · a solo game has no session, exactly as with recordCivilizationContribution.
//
// Returns the RPC's own status string rather than void, and the caller should log it. A silent void
// here would repeat the bug this function exists to end: games_played sat at 0 for six weeks and the
// health monitor was red for 17 runs, both because a write path's failure looked exactly like its
// success. 'awarded' | 'awarded_no_profile' | 'tie' | 'already_awarded' | 'no_game_end' |
// 'no_winner_id' | null when the call itself failed.
export async function awardGameWin(sessionId) {
  if (!sessionId) return null
  try {
    const { data, error } = await supabase.rpc('award_game_win', { p_session_id: sessionId })
    if (error) return null
    return typeof data === 'string' ? data : null
  } catch {
    return null
  }
}

// Grand total of the Global NeoTopia Index LEDGER (sum of every recorded game's total_score) · for the
// FinalScore civilization display ("Civilization Index: N"). The ledger is public-readable (migration 009).
// Best-effort · returns 0 on any failure. NOTE: sums client-side over the public rows · fine while the ledger
// is small · if it grows large, move to a SECURITY DEFINER aggregate (the get_global_neotopia_index pattern).
export async function getGlobalCivilizationTotal() {
  try {
    const { data, error } = await supabase.from('global_neotopia_index').select('total_score')
    if (error || !data) return 0
    return data.reduce((sum, row) => sum + (Number(row.total_score) || 0), 0)
  } catch {
    return 0
  }
}

export default supabase
