// NeoTopia · the FINAL multiplayer proof (T3 S8).
// "When the game ends, both tabs show FinalScore at the same moment via postgres_changes."
// Run:  npx playwright test phase-over-wire            (headless · CI)
//       npx playwright test phase-over-wire --headed    (watch both tabs flip together)
//
// WHAT THIS PROVES
//   ONE authoritative write sets game_sessions.state.phase='scoring' (exactly what a player's natural
//   endTurn does — gameStore.endTurn flips phase, useGameActions persists 'turn_end', useGameSync.pushState
//   writes `phase: s.phase`). postgres_changes then delivers that state to EVERY subscribed client, where
//   syncFromServer Object.assigns phase='scoring' and GameRoom renders the FinalScore overlay. Both tabs —
//   crucially p2, which did NOTHING locally — show the civilization record from a DB change alone.
//
// WHY NOT THE DEV GATE (Cmd+Shift+E)
//   That shortcut calls setPhase('scoring') LOCALLY (GameRoom.jsx · no pushState), so it is per-tab and
//   deliberately does NOT hit the DB · it cannot prove cross-tab propagation. The authoritative write below
//   is the faithful stand-in for the real end-of-game (and is the path production actually uses).
//
// DESIGN (deterministic · no presence handshake)
//   Both tabs only need to SUBSCRIBE to the room's game_sessions channel (public SELECT · they need not be
//   members). createSeededGame()'s admin IS a member, so it owns the one authoritative write. We assert the
//   board renders on BOTH tabs (channel SUBSCRIBED) and that NEITHER shows the record BEFORE the write — so
//   the write is provably the sole cause.

import { test, expect } from '@playwright/test'
import { createSeededGame, updateSessionState, cleanupSeeded, BOARD } from './seedHelpers'

const final = page => page.getByText('2055', { exact: true }) // the FinalScore "2055" headline node

test.describe('Phase over the wire (T3 S8)', () => {

  test('phase=scoring written to game_sessions renders FinalScore on BOTH tabs via postgres_changes', async ({ browser }) => {
    let game
    const ctx1 = await browser.newContext()
    const ctx2 = await browser.newContext()
    const p1 = await ctx1.newPage()
    const p2 = await ctx2.newPage()
    try {
      game = await createSeededGame('neotopia-e2e-pow')

      // [1] Both tabs subscribe to the room and seed the PLAYING board (channel SUBSCRIBED before the write).
      await p1.goto(`/game/${game.roomId}`)
      await p2.goto(`/game/${game.roomId}`)
      await expect(p1.locator(BOARD)).toBeVisible({ timeout: 20_000 })
      await expect(p2.locator(BOARD)).toBeVisible({ timeout: 20_000 })

      // Precondition: PLAYING · neither tab shows the end record yet (so the write below is the sole cause).
      await expect(final(p1)).toHaveCount(0)
      await expect(final(p2)).toHaveCount(0)

      // [2] ONE authoritative write · a member flips phase to 'scoring' in game_sessions (state jsonb +
      // the denormalised column · exactly as endTurn's pushState does). Neither browser tab triggers it.
      // The jsonb state carries the true store phase 'scoring' (what syncFromServer reads + FinalScore
      // triggers on) · the denormalised column gets the CHECK-valid 'finished' (game_sessions_phase_check
      // forbids 'scoring') · this mirrors the FIXED pushState boundary (sessionPhaseColumn) exactly.
      await updateSessionState(
        game.admin,
        game.roomId,
        s => ({ ...s, phase: 'scoring' }),
        { phase: 'finished' },
      )

      // [3] THE PROOF · postgres_changes → syncFromServer → FinalScore on BOTH tabs (p2 did nothing local).
      // Typical propagation is well under a second · the timeout is CI headroom, not the expected latency.
      await Promise.all([
        expect(final(p1)).toBeVisible({ timeout: 10_000 }),
        expect(final(p2)).toBeVisible({ timeout: 10_000 }),
      ])

      // [4][5] The full record is on BOTH tabs (Global Index + the CTA · not a partial paint).
      for (const p of [p1, p2]) {
        await expect(p.getByText(/the civilization is complete/i)).toBeVisible()
        await expect(p.getByText(/global neotopia index/i)).toBeVisible()
        await expect(p.getByRole('button', { name: /start new civilization/i })).toBeVisible()
      }
    } finally {
      await ctx1.close()
      await ctx2.close()
      await cleanupSeeded(game)
    }
  })
})
