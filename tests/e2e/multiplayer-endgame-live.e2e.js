// NeoTopia · WHAT HAPPENS WHEN A REAL MULTIPLAYER GAME ENDS (T3 S37).
//
// "Nobody has seen two different cluster scores on a real screen."
//
// Four things land on the civilization's permanent record the moment a real room reaches final scoring,
// and NONE of them has been watched happen since the code that produces them was written:
//   · record_civilization_score  · the per-player ledger row (FinalScore → recordCivilizationDetail)
//   · games_played               · incremented SERVER-SIDE inside that same ledger write (migration 019)
//   · award_game_win → games_won · fired from EVERY seat, idempotent on game_wins.session_id (migration 020)
//   · the per-player CLUSTER SCORE on screen · per-seat only since placedBy landed (T2 S35 · d1017c1)
//
// The last four-player live game (S29) predates all four. Before S35 the cluster term was board-global and
// therefore IDENTICAL for every player, which is Rule 73: a term that cannot differ cannot decide anything.
// T2 measured it differing in 60/60 engine games after the fix. It has never been rendered for a human.
//
// ── WHAT IS REAL HERE, EXACTLY (Rule 35 · never overclaim) ───────────────────────────────────────────────
// REAL · two separate browser contexts, two separate anonymous sign-ins, the genuine lobby loop through the
//   UI (create → join by code → ready → start), a real game_rooms + room_players + game_sessions row, and
//   the app's OWN authenticated supabase client for every write. Nothing is service-role.
// REAL · the ENDING is a complete game played by the real engine (src/store/gameStore driven directly, not
//   reimplemented), to its own natural 'scoring' phase, with real placements carrying real placedBy stamps.
// REAL · that finished state is delivered to both browsers through the ACTUAL wire · one UPDATE to
//   game_sessions.state by a real member, picked up by both clients' postgres_changes subscription and
//   applied by syncFromServer. So this also happens to be the first live proof that placedBy survives the
//   real round trip (T2 unit-tested it; nothing had watched it cross the network).
// NOT REAL · the 56 cards are not played out through the UI. A natural game end takes hundreds of turns and
//   is infeasible in a browser E2E · two-human.e2e.js has said so since S7. The engine plays them instead,
//   which is the same code, and the browsers render and RECORD the result, which is the part under test.
//
// COST · 2 anonymous sign-ins (one per human) + 1 for the suite's globalTeardown. Nightly-class, never the
// merge gate. The ENGINE test above it costs nothing and runs anywhere.
// Run locally:  npm run test:e2e -- multiplayer-endgame-live
//
// ⚠ RUN IT AGAINST A DEV SERVER NOBODY ELSE IS EDITING. On the shared localhost:5173 this failed four times
// at THREE different points in the lobby loop · a room code that never rendered, a join that never advanced ·
// with ZERO non-2xx responses from Supabase, while another terminal was saving components into that same
// server. On an isolated `git worktree` pinned to one commit with its own port it went 4 for 4. Neither the
// lobby nor this spec is flaky; a live spec driven through a dev server someone else is hot-reloading is.
// Same hazard that made a practice game look like it had frozen at turn 4 in S35 (Rule 57).

import { test, expect } from '@playwright/test'
import { loadEnv, uniqueName, deleteRoomAsHost, BOARD } from './seedHelpers'
import { useGameStore, PRODUCTION_TILES, shuffleArray } from '../../src/store/gameStore'
import { DECK } from '../../src/lib/projectCards'
import { getClusterTotal } from '../../src/lib/patternMatcher'

let ENV = null
try { ENV = loadEnv() } catch { /* no creds · the live half skips · the engine half still runs */ }

const SEATS = [0, 1]
const NAME_INPUT = 'Builder name (max 20)'
// Mirrors useGameRoom.serializableState() · drops action functions, collapses Sets. Same as four-player-live.
const serializable = () => JSON.parse(JSON.stringify(useGameStore.getState()))

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE ENGINE · a greedy but LEGAL player, adapted from four-player-live.e2e.js for two seats.
//
// Every move goes through the engine's own validators and the engine is the judge of whether it landed: a
// placement counts only if actionsRemaining actually decreased. placeElement returns void and silently
// no-ops on an illegal move, so a harness that assumed success would drift out of sync with the board and
// then blame the engine for its own bad moves.
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
function takeTurn(seat) {
  const s = () => useGameStore.getState()
  let placements = 0
  let guard = 0

  while (s().actionsRemaining > 0 && guard++ < 40) {
    const before = s().actionsRemaining
    let moved = false
    for (const factory of s().factories) {
      for (const regionId of factory.betweenRegions) {
        const spots = s().getValidPlacements(factory.id, regionId)
        if (!spots?.length) continue
        const live = s().factories.find(f => f.id === factory.id)
        const el = live?.elements.find(e => e.count > 0)
        if (!el) continue
        s().placeElement(seat, factory.id, el.type, spots[0].q, spots[0].r, regionId)
        if (s().actionsRemaining < before) { moved = true; placements++; break }
      }
      if (moved) break
    }
    if (!moved) break // nothing legal anywhere · do not spin
  }

  // Build whatever is completable. tryScoreCard owns the rule, so this can only succeed on a real pattern.
  // The field is `cardId`, NOT `id` · reading `.id` here silently produced "zero districts in a whole game"
  // in four-player-live, which reads exactly like a product defect and was entirely that harness's fault.
  let built = 0
  for (const regionId of [0, 1, 2]) {
    for (let g = 0; g < 10; g++) {
      const buildable = s().getBuildableCards(regionId) ?? []
      if (!buildable.length) break
      if (!s().tryScoreCard(seat, buildable[0].cardId, regionId)) break
      built++
    }
  }

  // A player with no cards can never build one.
  const me = s().players.find(p => p.seat === seat)
  if (me && me.hand.length < 3 && s().theOffer.length > 0) s().drawCard(seat, 'offer', 0)

  return { placements, built }
}

/**
 * Deal and play one complete two-player game with the real engine, and hand back its finished state.
 * `identities` are the REAL anon user ids of the two browsers, because FinalScore finds mySeat by matching
 * auth.uid() against the roster · a state seeded with placeholder ids would leave mySeat null in both tabs
 * and every write under test would be skipped for the RIGHT reason, which is the worst kind of green.
 */
function playCompleteTwoPlayerGame(identities) {
  useGameStore.getState().initGame(
    identities.map(({ userId, username }) => ({ userId, username })),
    shuffleArray([...DECK]),
    shuffleArray([...PRODUCTION_TILES]),
    'classic',
  )

  const MAX_TURNS = 400 // a bound, not an expectation · a game needing more has stalled
  let turns = 0
  let totalPlacements = 0
  let totalBuilt = 0
  while (useGameStore.getState().phase === 'playing' && turns < MAX_TURNS) {
    const { placements, built } = takeTurn(useGameStore.getState().currentSeat)
    totalPlacements += placements
    totalBuilt += built
    useGameStore.getState().endTurn()
    turns++
  }

  const end = useGameStore.getState()
  const state = serializable()
  const clusters = SEATS.map(seat => getClusterTotal(state.regions, seat))
  const totals = SEATS.map(seat => end.getFinalScore(seat))
  const owned = state.regions.reduce((n, r) =>
    n + Object.values(r.hexes ?? {}).filter(h => h?.element && typeof h.placedBy === 'number').length, 0)

  return { state, clusters, totals, turns, totalPlacements, totalBuilt, owned, MAX_TURNS, phase: end.phase }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// Lobby UI helpers · selectors mirrored from the real Lobby.jsx / Landing.jsx (Rule 36). Deliberately a
// local copy rather than a refactor of two-human.e2e.js's identical set: that spec was wired into CI by
// another lane in this same session, and rewriting a file somebody is watching land is how a green gate
// turns red for a reason nobody can find. The duplication is flagged in comms as a real debt, not hidden.
// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
async function gotoLobby(page) {
  await page.goto('/')
  const input = page.getByPlaceholder(NAME_INPUT)
  const enterCiv = page.getByRole('button', { name: /enter the civilization/i })
  await expect(input.or(enterCiv).first()).toBeVisible({ timeout: 15_000 })
  if (await enterCiv.isVisible()) {
    await enterCiv.click()
    await expect(input).toBeVisible({ timeout: 15_000 })
  }
}

async function claimName(page, name) {
  await gotoLobby(page)
  await page.getByPlaceholder(NAME_INPUT).fill(name)
  await page.getByRole('button', { name: /enter neotopia/i }).click()
}

async function readRoomCode(page) {
  const el = page.locator('[style*="monospace"]').first()
  await expect(el).toBeVisible({ timeout: 15_000 })
  const code = (await el.textContent())?.trim() ?? ''
  expect(code, `room code "${code}" is not 6 chars A-Z0-9`).toMatch(/^[A-Z0-9]{6}$/)
  return code
}

const authUid = (page) => page.evaluate(() => {
  const raw = localStorage.getItem('neotopia-auth')
  if (!raw) return null
  try {
    const s = JSON.parse(raw)
    const id = s?.user?.id ?? s?.currentSession?.user?.id
    if (id) return id
  } catch { /* fall through */ }
  const m = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i)
  return m ? m[0] : null
})

// The app's OWN reader, imported from the page so it runs against the app's OWN authenticated client (Vite
// serves the already-loaded module, so this is the same instance · the card-art spec relies on the same
// property). Reading through getMyProfileStats rather than a fresh admin query is deliberate: these three
// columns had a writer and no reader for six weeks, which is how games_played sat at 0 while people played.
const readMyStats = (page) => page.evaluate(async () => {
  const m = await import('/src/lib/supabase.js')
  return m.getMyProfileStats()
})

// The Global NeoTopia Index contribution · the civilization's headline number, per player. There is no
// exported reader for this column (getMyProfileStats deliberately returns the three ladder columns), so
// this asks for it directly through the same authenticated client, own row only, exactly as RLS allows.
const readMyIndex = (page) => page.evaluate(async () => {
  const m = await import('/src/lib/supabase.js')
  const { data: { user } = {} } = await m.supabase.auth.getUser()
  if (!user) return null
  const { data } = await m.supabase
    .from('player_profiles').select('neotopia_index').eq('user_id', user.id).maybeSingle()
  return data ? Number(data.neotopia_index) : null
})

// Parse the score breakdown line FinalScore renders per player:
//   `${best} + ${second} + (${worst} × 3)[ + (${unused} × 3)][ + ${cluster} cluster] = ${total}`
// Read off the rendered DOM rather than the store · the claim is about what a HUMAN sees. The cluster term
// is absent from the string when it is 0, which is itself part of the contract, so absent parses as 0.
const readScoreLines = (page) => page.evaluate(() => {
  const RX = /^(\d+) \+ (\d+) \+ \((\d+) × 3\)(?: \+ \((\d+) × 3\))?(?: \+ (\d+) cluster)? = (\d+)$/
  const out = []
  for (const el of document.querySelectorAll('div')) {
    if (el.children.length) continue
    const t = el.textContent.replace(/\s+/g, ' ').trim()
    const m = RX.exec(t)
    if (m) out.push({
      best: +m[1], second: +m[2], worst: +m[3],
      unused: m[4] ? +m[4] : 0, cluster: m[5] ? +m[5] : 0, total: +m[6], text: t,
    })
  }
  return out
})

const sortedNums = (a) => [...a].sort((x, y) => x - y)

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
test.describe('the end of a real multiplayer game · the four writes nobody has watched', () => {

  // ── FREE, OFFLINE, AND THE REASON THE LIVE TEST'S FIXTURE CAN BE TRUSTED ────────────────────────────────
  // Runs anywhere, signs nothing in. If the cluster term ever stops being able to differ · a caller passes
  // the board total again, placedBy stops being stamped, the seat argument gets dropped somewhere · this
  // goes red here for free instead of in a nightly that costs two identities to discover it.
  test('ENGINE · a finished 2-player game gives the two players DIFFERENT cluster scores', async () => {
    test.setTimeout(120_000)
    // 30 rather than 10, and the reason is a measurement rather than a preference. The first version ran 10
    // and gated on >= 8; it returned exactly 8, which is a coin flip away from a red gate on working code.
    // Two seats driven by the SAME greedy policy tie more often than T2's 60/60 figure suggests, because
    // that measurement was of a different comparison. 30 games at ~0.8 makes a run below 18 vanishingly
    // unlikely, while the regression this guards against · a term that has gone board-global again · scores
    // exactly 0 out of 30 and cannot squeak past. A whole game costs ~10ms, so the sample is free.
    const GAMES = 30
    const runs = []
    for (let i = 0; i < GAMES; i++) {
      runs.push(playCompleteTwoPlayerGame([
        { userId: `engine-seat-0-${i}`, username: 'Alpha' },
        { userId: `engine-seat-1-${i}`, username: 'Beta' },
      ]))
    }

    for (const r of runs) {
      expect(r.turns, 'the game never reached an endgame · it stalled').toBeLessThan(r.MAX_TURNS)
      expect(r.phase, 'the game never reached scoring').toBe('scoring')
      expect(r.totalPlacements, 'no element was ever placed · the game was empty').toBeGreaterThan(0)
      // Every placed element must carry an owner, or the cluster term is arithmetically incapable of
      // differing no matter what the scorer does · Rule 73, at its root rather than at its symptom.
      expect(r.owned, 'placements landed with no placedBy stamp · cluster scores cannot differ').toBeGreaterThan(0)
      for (const t of r.totals) expect(Number.isFinite(t), 'a seat has no computable final score').toBe(true)
    }

    const differing = runs.filter(r => r.clusters[0] !== r.clusters[1]).length
    console.log(`[mp-endgame] ENGINE · ${differing}/${GAMES} finished games gave the two players different ` +
      `cluster scores · ${runs.map(r => r.clusters.join('v')).join(' ')}`)
    // A tie is a legitimate outcome, so this is not GAMES/GAMES. It is high enough that a term which has
    // gone board-global again (identical for everybody, every game · the S18-S35 state) cannot pass it,
    // and low enough that an unlucky run of ties cannot red a working build.
    expect(differing, `only ${differing}/${GAMES} games had cluster scores that differ between the two ` +
      'players · a term identical for everybody cannot decide anything (Rule 73)')
      .toBeGreaterThanOrEqual(Math.ceil(GAMES * 0.6))
  })

  // ── THE EXPENSIVE ONE ──────────────────────────────────────────────────────────────────────────────────
  test('two real humans finish a real room · the ledger, the win, and two different cluster scores on screen',
    async ({ browser }) => {
      test.skip(!ENV, 'no Supabase creds (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) · nightly-class live test')
      test.setTimeout(240_000)

      const ctx1 = await browser.newContext()
      const ctx2 = await browser.newContext()
      const p1 = await ctx1.newPage() // host · seat 0 · writes the game_end audit row
      const p2 = await ctx2.newPage() // joiner · seat 1
      const pages = { host: p1, joiner: p2 }

      // Watch BOTH tabs for the whole game. The console lines are the ones FinalScore emits under Rule 61 ·
      // they carry the live sessionId and the award STATUS, which is the difference between a credited win
      // and a success string over a zero-row write.
      const logs = { host: [], joiner: [] }
      const rpcs = { host: [], joiner: [] }
      // EVERY non-2xx from Supabase, for the whole run. Three consecutive runs of this spec failed at three
      // DIFFERENT points in the lobby loop · a room code that never rendered, a join that never advanced ·
      // and a Playwright locator timeout describes all three identically ("element not found"), which is
      // the least informative true statement available. The backend's own refusals distinguish a rate limit
      // from an RLS rejection from a genuine product bug, and they cost nothing to collect.
      const httpErrors = { host: [], joiner: [] }
      for (const [who, page] of Object.entries(pages)) {
        page.on('console', (m) => {
          const t = m.text()
          if (/\[NeoTopia\]/.test(t)) logs[who].push(t)
        })
        // RESPONSES, not requests. "The RPC fired" and "the RPC succeeded" are different claims, and a
        // run of this spec once showed both counters flat with every call present · which a request-only
        // listener reports as "everything fired", the most misleading possible summary. The status is what
        // separates a write that landed from one the server refused.
        page.on('response', (r) => {
          const m = /\/rest\/v1\/rpc\/([a-z_]+)/.exec(r.url())
          if (m) rpcs[who].push(`${m[1]}:${r.status()}`)
          if (r.status() >= 400 && /supabase\.co/.test(r.url())) {
            httpErrors[who].push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}${new URL(r.url()).search}`)
          }
        })
      }

      let roomId = null
      let hostSession = null
      try {
        // ── [1] THE REAL LOBBY LOOP ────────────────────────────────────────────────────────────────────
        await claimName(p1, uniqueName('E2EMH'))
        await p1.getByRole('button', { name: 'Create Room' }).click({ timeout: 15_000 })
        const code = await readRoomCode(p1)

        await claimName(p2, uniqueName('E2EMG'))
        await p2.getByRole('button', { name: 'Join Room' }).click({ timeout: 15_000 })
        await p2.getByPlaceholder('ABC234').fill(code)
        await p2.getByRole('button', { name: 'Join', exact: true }).click({ timeout: 15_000 })

        // INSTRUMENTED, because the bare click timed out once here and a Playwright timeout on a locator
        // says only "the button never appeared" · which is equally consistent with a rate-limited sign-in,
        // a rejected room code, a name collision, and a genuine product bug in the join path. The screen
        // itself distinguishes them, and it costs two anonymous identities to get back to this moment, so
        // the diagnostic is captured rather than re-earned. (Rule 57 · tell a harness race from a defect.)
        // expect().toBeVisible(), NOT locator.isVisible(): isVisible is a POINT-IN-TIME check that ignores
        // the timeout option entirely, so the first draft of this guard answered microseconds after the
        // click, reported "the joiner never reached the waiting room", and was measuring nothing but its
        // own impatience. A probe that returns instantly to a question about waiting has not answered it.
        const ready = p2.getByRole('button', { name: /click when ready/i })
        try {
          await expect(ready).toBeVisible({ timeout: 25_000 })
        } catch {
          const screen = await p2.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 500))
          throw new Error(`the joiner never reached the waiting room after joining "${code}" · screen: ${screen}`)
        }
        await ready.click({ timeout: 10_000 })

        const startBtn = p1.getByRole('button', { name: /^start game$/i })
        await expect(startBtn, 'presence never converged · the host could not start')
          .toBeVisible({ timeout: 30_000 })
        await startBtn.click()

        await p1.waitForURL(/\/game\/[0-9a-f-]+/i, { timeout: 20_000 })
        await p2.waitForURL(/\/game\/[0-9a-f-]+/i, { timeout: 20_000 })
        await expect(p1.locator(BOARD)).toBeVisible({ timeout: 20_000 })
        await expect(p2.locator(BOARD)).toBeVisible({ timeout: 20_000 })
        roomId = new URL(p1.url()).pathname.split('/').pop()
        hostSession = await p1.evaluate(() => localStorage.getItem('neotopia-auth'))

        const uids = { host: await authUid(p1), joiner: await authUid(p2) }
        expect(uids.host, 'the host has no persisted anon identity').toBeTruthy()
        expect(uids.joiner, 'the joiner has no persisted anon identity').toBeTruthy()
        expect(uids.host).not.toBe(uids.joiner)

        // ── [2] THE BASELINE, READ BEFORE ANYTHING CAN MOVE IT ─────────────────────────────────────────
        // Two brand-new anonymous humans. If these are not 0/0 the increments below prove nothing, so the
        // baseline is asserted rather than merely recorded.
        const before = { host: await readMyStats(p1), joiner: await readMyStats(p2) }
        console.log('[mp-endgame] baseline', JSON.stringify(before))
        for (const who of ['host', 'joiner']) {
          expect(before[who], `${who} has no player_profiles row · claimUsername did not run`).toBeTruthy()
          expect(before[who].gamesPlayed, `${who} is not a fresh identity`).toBe(0)
          expect(before[who].gamesWon, `${who} is not a fresh identity`).toBe(0)
        }

        // ── [3] PLAY THE WHOLE GAME WITH THE REAL ENGINE, KEYED TO THESE TWO REAL IDENTITIES ───────────
        // Bounded retry for a game whose cluster scores differ · the engine test above proves that is the
        // overwhelmingly common case, so this is a guard against an unlucky tie, not a search for a lucky
        // fixture. If every attempt tied, the test says so rather than quietly proving something weaker.
        let game = null
        for (let attempt = 0; attempt < 6 && !game; attempt++) {
          const g = playCompleteTwoPlayerGame([
            { userId: uids.host, username: 'Host' },
            { userId: uids.joiner, username: 'Joiner' },
          ])
          // Seat 0 must also have BUILT something · the refresh measurement in step [6] is about that
          // player's district contribution, and a host with zero districts would make it vacuously true.
          const hostBuilt = (g.state.players[0].scoredCardIds?.length ?? 0) > 0
          if (g.phase === 'scoring' && g.clusters[0] !== g.clusters[1] && hostBuilt) game = g
        }
        expect(game, 'six finished games in a row gave the two seats equal cluster scores · either the term ' +
          'has gone board-global again or the engine is not reaching scoring').toBeTruthy()
        console.log(`[mp-endgame] engine game · turns ${game.turns} · placed ${game.totalPlacements} ` +
          `· districts ${game.totalBuilt} · clusters ${JSON.stringify(game.clusters)} ` +
          `· totals ${JSON.stringify(game.totals)}`)

        // ── [4] DELIVER IT THROUGH THE REAL WIRE ───────────────────────────────────────────────────────
        // One UPDATE by a real member, using the app's OWN authenticated client, with the same column
        // mapping useGameSync.pushState uses · including 'scoring' → 'finished', because the column's CHECK
        // rejects the store's terminal phase outright and an un-mapped write 400s the whole row. The jsonb
        // `state` still carries the true store phase, which is what syncFromServer reads.
        const writeErr = await p1.evaluate(async ({ roomId, state }) => {
          const m = await import('/src/lib/supabase.js')
          const { error } = await m.supabase.from('game_sessions').update({
            state,
            current_seat: state.currentSeat,
            turn_number: state.turnNumber,
            actions_remaining: state.actionsRemaining,
            production_tiles_remaining: state.productionTilesRemaining,
            phase: 'finished',
          }).eq('room_id', roomId)
          return error ? `${error.code ?? ''} ${error.message}` : null
        }, { roomId, state: game.state })
        expect(writeErr, 'the finished state could not be written to game_sessions').toBeNull()

        // Both tabs must arrive at the record on their OWN, from the subscription · nothing is dispatched
        // into them. That is the claim: the terminal phase reached two real clients over the wire.
        for (const [who, page] of Object.entries(pages)) {
          await expect(page.getByRole('dialog', { name: /final civilization record/i }),
            `${who} never rendered the civilization record after the finished state landed`)
            .toBeVisible({ timeout: 30_000 })
        }

        // ── [5] TWO DIFFERENT CLUSTER SCORES, ON A REAL SCREEN, FOR THE FIRST TIME ──────────────────────
        const lines = { host: await readScoreLines(p1), joiner: await readScoreLines(p2) }
        console.log('[mp-endgame] host screen   ', JSON.stringify(lines.host.map(l => l.text)))
        console.log('[mp-endgame] joiner screen ', JSON.stringify(lines.joiner.map(l => l.text)))

        for (const who of ['host', 'joiner']) {
          expect(lines[who], `${who}'s record shows ${lines[who].length} score breakdowns, expected 2`)
            .toHaveLength(2)
          const shownClusters = lines[who].map(l => l.cluster)
          expect(new Set(shownClusters).size,
            `${who} sees the SAME cluster score for both players (${shownClusters.join(' and ')}) · that is ` +
            'the pre-S35 board-global term, which cannot decide anything (Rule 73)').toBe(2)
          // The screen must agree with the engine, not merely be interesting. Compared as multisets because
          // FinalScore sorts by total, which need not be seat order.
          expect(sortedNums(shownClusters), `${who}'s cluster scores disagree with the engine`)
            .toEqual(sortedNums(game.clusters))
          expect(sortedNums(lines[who].map(l => l.total)), `${who}'s totals disagree with the engine`)
            .toEqual(sortedNums(game.totals))
        }
        // And both humans are looking at the same civilization.
        expect(sortedNums(lines.host.map(l => l.total))).toEqual(sortedNums(lines.joiner.map(l => l.total)))

        // ── [6] THE REFRESH · AND WHY IT SITS HERE, BEFORE THE COUNTERS ARE JUDGED ─────────────────────
        // A player reloading their own final score is a real thing a real person does, and it is also the
        // recovery path FinalScore's award effect documents for itself ("the extra callers are the recovery
        // path for the lowest seat closing its tab"). Two separate things are measured through it.
        //
        // THE FIRST IS A BUG, WITH A NUMBER. increment_neotopia_index (migration 004) is a BARE increment ·
        // it clamps one call to [0,56] and carries no idempotency key at all. Every other write on this
        // screen has one: record_civilization_score is UNIQUE(session_id, player_id) ON CONFLICT DO NOTHING,
        // award_game_win is keyed on game_wins.session_id, and the game_end audit row was given an explicit
        // per-room localStorage guard precisely so a reload during 'scoring' stays idempotent. The district
        // contribution · the one feeding the civilization's headline number · is the only one whose guard is
        // a useRef, and a reload destroys those. MEASURED LIVE: neotopia_index 3 -> 6 across one refresh by
        // a player with 3 districts. Refresh twice and it triples.
        //
        // THE SECOND IS NOT A BUG, and finding that out is why this took two experiments. In development
        // both seats call award_game_win exactly once, get 'no_game_end' because the audit row has not
        // landed yet, and NEVER RETRY · so games_won stays 0 and nobody is credited. That looks exactly like
        // a serious product defect and it is not one. The award effect burns its one-shot ref BEFORE the
        // async retry loop and cancels the loop in its cleanup, so React's DEVELOPMENT double-invoke
        // (mount → cleanup → mount) kills the retry on the first cleanup, every time. Proved by changing
        // exactly one thing on the same commit in an isolated worktree · <StrictMode> removed from main.jsx,
        // nothing else · and the same spec then logged "attempt 2 · awarded" and credited the win (Rule 74:
        // one variable, same commit). React's StrictMode is a no-op in a production build, so the retry loop
        // is live for real players. The FRAGILITY is still worth knowing (Rule 76's family: a latch burned
        // before a loop that its own cleanup cancels means any single dep churn disables the retry forever ·
        // it survives today only because sessionId and mySeat are stable primitives at 'scoring').
        //
        // So the reload happens first and the counters are judged after it: it is a legitimate user action,
        // it exercises the product's own documented recovery, and it makes this spec state the truth in
        // both environments rather than reporting the dev harness as a product failure.
        const idxBefore = await readMyIndex(p1)
        const rpcsBeforeReload = rpcs.host.length
        await p1.reload({ waitUntil: 'domcontentloaded' })
        await expect(p1.getByRole('dialog', { name: /final civilization record/i }),
          'the score screen did not survive a refresh').toBeVisible({ timeout: 30_000 })
        await p1.waitForTimeout(3_000) // the writes are fire-and-forget · give them room to land
        const idxAfter = await readMyIndex(p1)
        console.log(`[mp-endgame] REFRESH · neotopia_index ${idxBefore} -> ${idxAfter} ` +
          `(delta ${idxAfter - idxBefore}) · host rpcs after reload ` +
          JSON.stringify(rpcs.host.slice(rpcsBeforeReload)))

        // CHARACTERISATION, not approval. hostDistricts is what the player actually contributed once; the
        // delta across a refresh SHOULD be 0 and is not. Asserted rather than logged so it cannot drift
        // unnoticed in either direction · the day somebody gives this write an idempotency key, this line
        // goes red, and the fix is to change the expected value to 0. The fixture guarantees the host built
        // something, so the claim is never vacuously true.
        const hostDistricts = game.state.players[0].scoredCardIds?.length ?? 0
        expect(hostDistricts, 'the fixture must give seat 0 at least one district or this proves nothing')
          .toBeGreaterThan(0)
        expect(idxAfter - idxBefore,
          `refreshing the final score changed this player's Global Index contribution by ` +
          `${idxAfter - idxBefore} · it should be 0, and it is their district count (${hostDistricts}) ` +
          'because increment_neotopia_index has no idempotency key and its client guard is a useRef')
          .toBe(hostDistricts)

        // ── [7] THE LEDGER, THE WIN, AND THE TWO COUNTERS ──────────────────────────────────────────────
        const after = {}
        let polled = 0
        try {
          await expect.poll(async () => {
            after.host = await readMyStats(p1)
            after.joiner = await readMyStats(p2)
            polled = (after.host?.gamesPlayed ?? 0) + (after.joiner?.gamesPlayed ?? 0) +
                     (after.host?.gamesWon ?? 0) + (after.joiner?.gamesWon ?? 0)
            return polled
          }, {
            timeout: 45_000,
            message: 'games_played / games_won never moved for either player after a finished multiplayer game',
          }).toBeGreaterThanOrEqual(3) // 1 + 1 played, and exactly one win
        } finally {
          // ALWAYS, even on the failing path. A run of this once timed out here with the wire dump sitting
          // BELOW the assertion, so the one piece of evidence that would have explained it was never
          // printed · a diagnostic that only runs when everything worked is not a diagnostic.
          console.log('[mp-endgame] after   ', JSON.stringify(after))
          console.log('[mp-endgame] rpcs    ', JSON.stringify(rpcs))
          console.log('[mp-endgame] host log', JSON.stringify(logs.host))
          console.log('[mp-endgame] join log', JSON.stringify(logs.joiner))
        }

        const called = (who, name) => rpcs[who].filter(x => x.startsWith(`${name}:`))
        for (const who of ['host', 'joiner']) {
          expect(called(who, 'record_civilization_score').length,
            `${who} never called record_civilization_score · the ledger row was not written`).toBeGreaterThan(0)
          expect(called(who, 'award_game_win').length,
            `${who} never called award_game_win · the RPC that sat with no caller for two sessions has one, ` +
            'and it has to fire from every seat').toBeGreaterThan(0)
          // Every write the score screen makes must have been ACCEPTED. A 2xx here is the difference
          // between "the client tried" and "the civilization's record actually changed".
          for (const call of rpcs[who]) {
            const [name, status] = call.split(':')
            expect(Number(status) < 400, `${who}'s ${name} was refused with HTTP ${status} · the write the ` +
              'whole score screen exists to make did not land').toBe(true)
          }
          expect(after[who].gamesPlayed, `${who}'s games_played did not move · migration 019 increments it ` +
            'server-side inside record_civilization_score, so this failing means the ledger write did not land')
            .toBe(1)
        }

        // THE SHAPE OF THE WIRE, pinned rather than left implicit · the same technique the practice ledger
        // proof uses in reverse. There a finished game must send NOTHING; here it must send exactly these
        // four and nothing else, so a future change that starts writing something new to a real player's
        // permanent record has to come through this line and say what it is.
        //   get_global_neotopia_index · READ · the counter on the record (and on the landing page)
        //   increment_neotopia_index  · WRITE · recordCivilizationContribution · this seat's own district
        //     count only, which is why BOTH seats firing it is correct rather than a double count
        //   record_civilization_score · WRITE · the per-player ledger row · games_played rides on it
        //   award_game_win            · WRITE · the win credit, idempotent per session
        const EXPECTED_RPCS = new Set([
          'get_global_neotopia_index', 'increment_neotopia_index', 'record_civilization_score', 'award_game_win',
        ])
        for (const who of ['host', 'joiner']) {
          for (const name of new Set(rpcs[who].map(x => x.split(':')[0]))) {
            expect(EXPECTED_RPCS.has(name),
              `an unexpected RPC left a finished multiplayer game from the ${who}: ${name}`).toBe(true)
          }
          expect(called(who, 'increment_neotopia_index').length,
            `${who} never recorded its own districts to the Global Index`).toBeGreaterThan(0)
        }

        // EXACTLY ONE WIN between them. Both seats ask, and asking twice must not credit twice · game_wins
        // is keyed on session_id with ON CONFLICT DO NOTHING, and that idempotency is the whole reason the
        // second caller is safe to have. This is the honest reading of "the same result from every seat":
        // not the same status STRING (the first gets 'awarded', the second 'already_awarded') but the same
        // outcome, credited once, to the same player.
        const wins = after.host.gamesWon + after.joiner.gamesWon
        expect(wins, `games_won moved by ${wins} across the two players · exactly one win exists in a ` +
          'finished 2-player game, and a 2 would mean award_game_win is not idempotent').toBe(1)

        // The winner on screen must be the player the server credited. FinalScore sorts by total, so the
        // engine's higher total names the seat, and seat 0 is the host by construction of the roster above.
        const winningSeat = game.totals[0] > game.totals[1] ? 0 : game.totals[1] > game.totals[0] ? 1 : null
        if (winningSeat !== null) {
          const expectedWinner = winningSeat === 0 ? 'host' : 'joiner'
          expect(after[expectedWinner].gamesWon,
            `the engine's winner is seat ${winningSeat} (${expectedWinner}) but the credit went elsewhere · ` +
            `host ${after.host.gamesWon}, joiner ${after.joiner.gamesWon}`).toBe(1)
        }

        // AT LEAST ONE SEAT REACHED A TERMINAL STATUS. Deliberately not per-seat, and the first draft of
        // this WAS per-seat and red on a passing game · a correction worth keeping. FinalScore's own comment
        // is explicit: a seat that asks before the lowest seat's audit row lands gets 'no_game_end' and
        // writes nothing, which is HARMLESS · the failure mode is every seat asking early and nobody
        // retrying. So the contract is "somebody credited the win", and the DB assertion above is what
        // actually pins it. Both seats are still required to have ASKED (the rpcs check above).
        const allAwards = [...logs.host, ...logs.joiner].filter(l => l.includes('award_game_win:'))
        expect(allAwards.length, 'neither seat logged an award_game_win status').toBeGreaterThan(0)
        expect(allAwards.some(l => !/no_game_end/.test(l)),
          `every award_game_win call from both seats returned 'no_game_end' · nobody was credited: ` +
          JSON.stringify(allAwards)).toBe(true)

      } finally {
        // Printed on EVERY path, pass or fail. On a pass it is two empty arrays and costs a line; on a
        // fail it is usually the whole answer.
        console.log('[mp-endgame] http errors', JSON.stringify(httpErrors))
        await ctx1.close()
        await ctx2.close()
        // The room is BROWSER-owned, so it is deleted as the host with the host's own session · no service
        // role. One statement cascades away room_players + game_sessions + game_events (migration 005).
        await deleteRoomAsHost(hostSession, roomId)
      }
    })
})
