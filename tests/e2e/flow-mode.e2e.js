// NeoTopia · Flow-mode lifecycle guard (T3 S17). Flow mode became REAL end-to-end at 133f0b9 (T3 startGame
// passes gameMode → initGame) + 86d0220 (T2 engine reads getModeConfig). There was NO E2E for it · this file
// is the regression guard for the 9-tile end-gate + 15s turn timer that distinguish Flow from Classic.
//
// WHY a gray-box drive (not a click-through bot game): the end-game fires only when the production-tile clock
// hits 0, which in real play takes dozens of force:true placements on valid hexes — exactly the flaky, slow
// path game-ux.e2e.js already owns and the bot keeps tripping on (Rule 33/57: UI-sim flake is a separate
// concern). Instead we drive the SAME real reducers the app uses — through the app's OWN live store instance
// (window.__neotopia_store · DEV-exposed at GameRoom.jsx:127) seeded from the REAL module exports (DECK +
// PRODUCTION_TILES + shuffleArray · the same imports GameRoom's solo-init uses · Rule 36 mirror the real
// setup) — and assert the REAL FinalScore COMPONENT renders in the REAL DOM (Rule 55: the render is the
// witness). This is deterministic, needs no Supabase WRITE, and runs in < 5s.
//
// WHAT THIS GUARDS (honest scope · Rule 63):
//   ✓ a Flow game seeds a 9-tile production clock + 15s turn budget + state.mode='flow' (NOT classic's 12/90)
//   ✓ a Classic game seeds 12 tiles + 90s + clears mode (Flow→Classic must not inherit mode='flow')
//   ✓ exhausting the 9-tile clock fires endGameTriggered, and the end-game rounds resolve to phase='scoring'
//   ✓ FinalScore mounts at game end (the civilization record renders)
// WHAT THIS DOES NOT COVER (owned elsewhere · stated so the suite never lies about its reach):
//   · the factory→element→region→hex placement-commit chain → game-ux.e2e.js (T3 S12)
//   · two-player simultaneous draw over Realtime → not yet built (T2 engine + T3 channel · see S17 comms)
//
// Solo /game (no roomId) means NO anon sign-in / NO Supabase peer · CI-cheap + rate-limit-free, same class as
// mobile.e2e.js. FinalScore's mount fires getGlobalIndex/getGlobalCivilizationTotal (READS · each .catch-guarded
// so the overlay still renders offline) · it does NOT write: recordCivilizationContribution is gated on
// districts>0 (we score none) and recordCivilizationDetail is gated on sessionId (null in solo). Read-only.

import { test, expect } from '@playwright/test'

const PLAY_AGAIN = '[data-testid="play-again-btn"]' // present iff FinalScore is mounted (FinalScore.jsx:363)

// Reach the solo board and wait for GameRoom's solo-init to seed a (Classic) game, so window.__neotopia_store
// is live and phase==='playing' before we re-seed it per-test.
async function gotoSoloBoard(page) {
  await page.goto('/game')
  await page.waitForSelector('[data-game-phase="playing"]', { timeout: 15_000 })
  // The DEV store hook mounts in an effect · assert it is exposed before any test drives it (fail loud if a
  // build strips it · the whole file depends on this contract).
  await expect
    .poll(() => page.evaluate(() => typeof window.__neotopia_store !== 'undefined'), { timeout: 10_000 })
    .toBe(true)
}

// Re-seed the app's live store for `mode` using the REAL canonical deck + tiles (dynamic-import the served
// modules · Rule 36). IMPORTANT: we pull only the pure exports (DECK · PRODUCTION_TILES · shuffleArray) from
// the import and drive window.__neotopia_store (the APP's instance) · a dynamic import of the store module
// yields a SEPARATE useGameStore the React tree does not subscribe to (T1 S6/S16 lesson) — never init through it.
async function seedMode(page, mode) {
  return page.evaluate(async (m) => {
    const { DECK } = await import('/src/lib/projectCards.js')
    const { PRODUCTION_TILES, shuffleArray } = await import('/src/store/gameStore.js')
    const store = window.__neotopia_store
    store.getState().initGame(
      [{ userId: 'flow-e2e', username: 'Builder' }],
      shuffleArray([...DECK]),
      shuffleArray([...PRODUCTION_TILES]),
      m,
    )
    const s = store.getState()
    return { tiles: s.productionTilesRemaining, timer: s.turnTimeRemaining, mode: s.mode, phase: s.phase }
  }, mode)
}

test.describe('Flow mode lifecycle (solo · real store · no Supabase write)', () => {

  test('Flow seeds a 9-tile clock + 15s timer · Classic seeds 12 + 90s (the mode-clock seam · 133f0b9 + 86d0220)', async ({ page }) => {
    await gotoSoloBoard(page)

    // FLOW: 9-tile production clock · 15s turn budget · lazy state.mode='flow' · still playing.
    const flow = await seedMode(page, 'flow')
    expect(flow.tiles, 'Flow must seed a 9-tile production clock (regression: classic 12 leaked into flow)').toBe(9)
    expect(flow.timer, 'Flow must seed a 15s turn budget').toBe(15)
    expect(flow.mode, "Flow must persist the lazy state.mode='flow'").toBe('flow')
    expect(flow.phase).toBe('playing')

    // CLASSIC: 12-tile clock · 90s · and mode CLEARED (Flow→Classic re-init must not inherit 'flow' · T2 fix).
    const classic = await seedMode(page, 'classic')
    expect(classic.tiles, 'Classic must seed all 12 production tiles').toBe(12)
    expect(classic.timer, 'Classic must seed a 90s turn budget').toBe(90)
    expect(classic.mode, 'Classic must CLEAR mode (lazy field · undefined · no flow leak)').toBeUndefined()
    expect(classic.phase).toBe('playing')

    // Proves the mode value actually CHANGES the seeded clock (not a constant) · the core of the 133f0b9 seam.
    console.log('[flow-mode] seam OK · flow:', JSON.stringify(flow), '· classic:', JSON.stringify(classic))
  })

  test('exhausting the 9-tile Flow clock ends the game and FinalScore renders (Rule 55 · the render is the witness)', async ({ page }) => {
    await gotoSoloBoard(page)

    // Seed a fresh Flow game (independent of the test above · Rule 33), then drain the production clock through
    // the REAL refill reducer (factoryRefill → refillFactoryDraft · the same code path a factory-empty triggers
    // in play) and run end-game rounds to the terminal 'scoring' phase. Solo (1 seat) → nextSeat is always 0,
    // so two endTurn()s after endGameTriggered resolve endGameRoundsRemaining 2→1→0 → phase='scoring'.
    const drive = await page.evaluate(async () => {
      const { DECK } = await import('/src/lib/projectCards.js')
      const { PRODUCTION_TILES, shuffleArray } = await import('/src/store/gameStore.js')
      const store = window.__neotopia_store
      store.getState().initGame(
        [{ userId: 'flow-e2e', username: 'Builder' }],
        shuffleArray([...DECK]),
        shuffleArray([...PRODUCTION_TILES]),
        'flow',
      )
      const factoryId = store.getState().factories[0].id

      // Drain the clock one tile per refill · count the refills it actually takes to hit 0.
      let refills = 0
      while (store.getState().productionTilesRemaining > 0 && refills < 50) {
        store.getState().factoryRefill(factoryId)
        refills++
      }
      const endGameTriggered = store.getState().endGameTriggered

      // Burn the end-game rounds to reach the terminal phase.
      let endTurns = 0
      while (store.getState().phase !== 'scoring' && endTurns < 10) {
        store.getState().endTurn()
        endTurns++
      }
      return { refills, endGameTriggered, finalPhase: store.getState().phase, endTurns }
    })

    // The Flow clock is 9 · exhausting it took exactly 9 refills (a Classic regression would take 12 · the
    // forge's `tilesPlaced <= 9` made strict to the deterministic truth).
    expect(drive.refills, 'Flow clock must exhaust in exactly 9 refills (12 = classic regression)').toBe(9)
    expect(drive.refills).toBeLessThanOrEqual(9)
    expect(drive.endGameTriggered, 'draining the production clock must arm endGameTriggered').toBe(true)
    expect(drive.finalPhase, 'end-game rounds must resolve to the terminal scoring phase').toBe('scoring')

    // THE RENDER IS THE WITNESS (Rule 55): the store reached 'scoring' · prove FinalScore actually MOUNTS in the
    // DOM. The play-again CTA lives ONLY inside FinalScore, which renders ONLY when phase==='scoring'
    // (GameRoom.jsx:205) — so its visibility is a strict superset witness of "the board entered the end-game"
    // (a bare data-game-phase attribute check would be weaker AND races with dev-server HMR if another lane saves
    // the store module mid-run · CI has no HMR · this single strong poll is both honest and robust · Rule 63).
    await expect(page.locator(PLAY_AGAIN), 'FinalScore must render at game end (play-again CTA present → phase is scoring)').toBeVisible({ timeout: 15_000 })
    console.log('[flow-mode] end-gate OK · drive:', JSON.stringify(drive), '· FinalScore rendered')
  })
})
