// NeoTopia · Card-art reveal guard (T3 S22). Cards 01-20 got real painterly PNGs (03292b6 · 20/56 in
// public/art/cards/card_NN.png). Until now the CardFrame art path had NO E2E · only the shimmer placeholder
// was ever exercised. This file is the regression guard for the reveal seam: a card whose PNG exists must
// (1) actually decode a non-broken image and fade it in (opacity 0→1 · .art-reveal · index.css), and
// (2) UNMOUNT its shimmering .art-skeleton placeholder once loaded (CardFrame.jsx · conditional render).
// If a future change breaks the art URL, the <img>, or the imgLoaded flip, this goes red instead of silently
// reverting every card to the procedural placeholder (which looks intentional · the failure would hide).
//
// WHY a solo gray-box drive (mirrors flow-mode.e2e.js · NOT a two-human lobby game): CardFrame renders in
// GameRoom's hand + offer, which need a started game. The deterministic, Supabase-free way to get there is
// the DEV store hook (window.__neotopia_store · GameRoom.jsx) seeded through the app's OWN initGame with the
// REAL DECK export (Rule 36 · mirror the real setup path · never a separately-imported store). initGame deals
// hand=deck.splice(0,3) + offer=deck.splice(0,4) from the FRONT of the deck (gameStore.js), so FRONT-LOADING
// the 20 art-bearing ids makes the 7 visible CardFrames deterministically art-bearing · no shuffle-luck flake
// (Rule 32/33). Solo /game (no roomId · no anon sign-in) · CI-cheap · rate-limit-free · same class as
// flow-mode.e2e.js / mobile.e2e.js · read-only (no Supabase write).
//
// SCOPE (honest · Rule 63): proves the art-reveal CONTRACT for a card that HAS a PNG. It does NOT assert how
// MANY of the 56 cards have art (that climbs as Mahil generates more · asserting a count would be a brittle
// lie the day card 21 lands) · only that the reveal mechanism works for the art that exists today.

import { test, expect } from '@playwright/test'

// Reach the solo board and confirm the DEV store hook is live before driving it. Resilience copied from
// flow-mode.e2e.js (T3 S20): a slow-but-healthy store init on a loaded CI runner must SKIP (visible in the
// report), not RED · a flaky timeout reading like a real regression is worse than an honest skip (Rule 57).
async function gotoSoloBoard(page) {
  await page.goto('/game')
  await page.waitForSelector('[data-game-phase="playing"]', { timeout: 15_000 })
  const SEED_BUDGET_MS = 2_000
  let seeded = true
  try {
    await expect
      .poll(() => page.evaluate(() => typeof window.__neotopia_store !== 'undefined'), { timeout: SEED_BUDGET_MS })
      .toBe(true)
  } catch {
    seeded = false
  }
  if (!seeded) console.warn(`[card-art] store seed exceeded ${SEED_BUDGET_MS}ms · slow init · SKIPPING (not failing)`)
  test.skip(!seeded, `store seed exceeded ${SEED_BUDGET_MS}ms (slow store initialization) · skipped to avoid a flaky CI failure`)
}

test.describe('Card art reveal (solo · real store · cards 01-20 live)', () => {

  test('a card with a real PNG decodes a non-broken image and sheds its shimmer placeholder', async ({ page }) => {
    await gotoSoloBoard(page)

    // Seed the hand + offer with art-bearing cards through the REAL initGame (front-loaded deck · see header).
    const seeded = await page.evaluate(async () => {
      const { DECK } = await import('/src/lib/projectCards.js')
      const { PRODUCTION_TILES, shuffleArray } = await import('/src/store/gameStore.js')
      const ART_IDS = Array.from({ length: 20 }, (_, i) => `card_${String(i + 1).padStart(2, '0')}`)
      const byId = Object.fromEntries(DECK.map(c => [c.id, c]))
      const artFirst = ART_IDS.map(id => byId[id]).filter(Boolean) // the 20 ids that have PNGs, in order
      const rest = DECK.filter(c => !ART_IDS.includes(c.id))
      const store = window.__neotopia_store
      store.getState().initGame(
        [{ userId: 'card-art-e2e', username: 'Builder' }],
        [...artFirst, ...rest],
        shuffleArray([...PRODUCTION_TILES]),
        'classic',
      )
      const s = store.getState()
      return { artAvailable: artFirst.length, hand: s.players[0].hand.map(c => c.id), offer: s.theOffer.map(c => c.id) }
    })

    // Sanity: the seed put art cards exactly where CardFrame renders them (proves the premise before the DOM
    // assertions · a 0-art hand would make a passing art test meaningless).
    expect(seeded.artAvailable, 'expected 20 art-bearing cards available to seed').toBe(20)
    const IS_ART = /^card_(0[1-9]|1[0-9]|20)$/
    expect([...seeded.hand, ...seeded.offer].some(id => IS_ART.test(id)),
      `seeded hand/offer must contain an art card · hand=${seeded.hand} offer=${seeded.offer}`).toBe(true)
    console.log('[card-art] seeded hand:', seeded.hand, '· offer:', seeded.offer)

    // Wait until at least one art-reveal <img> has DECODED a real PNG (complete + naturalWidth>0 · the
    // canonical non-broken-image proof · a 404/broken src stays at naturalWidth 0) AND the reveal has settled
    // to full opacity (the 0.4s .art-reveal fade is done · so the snapshot below is timing-stable, not caught
    // mid-transition). One poll covers both the network load and the CSS transition.
    await expect.poll(() => page.evaluate(() => {
      const im = [...document.querySelectorAll('img.art-reveal')].find(i => i.complete && i.naturalWidth > 0)
      return im ? getComputedStyle(im).opacity : '0'
    }), {
      message: 'no card art PNG decoded to full opacity · /art/cards/card_NN.png not serving, <img> broken, or reveal stuck',
      timeout: 15_000,
    }).toBe('1')

    // Snapshot the full contract now that a reveal has completed.
    const report = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.project-card')]
      const loaded = cards.filter(c => {
        const img = c.querySelector('img.art-reveal')
        return img && img.complete && img.naturalWidth > 0
      })
      const sample = loaded[0]?.querySelector('img.art-reveal')
      return {
        totalCards: cards.length,
        loadedCount: loaded.length,
        // A card whose PNG loaded must have UNMOUNTED its shimmer placeholder (CardFrame drops .art-skeleton
        // once imgLoaded). Any loaded card still carrying one means the reveal half-fired · a real bug.
        loadedStillShimmering: loaded.filter(c => c.querySelector('.art-skeleton')).length,
        sampleSrc: sample ? new URL(sample.src).pathname : null,
        sampleNaturalW: sample ? sample.naturalWidth : 0,
      }
    })
    console.log('[card-art]', JSON.stringify(report))

    expect(report.loadedCount, 'at least one card PNG must be loaded & non-broken').toBeGreaterThan(0)
    expect(report.sampleNaturalW, 'a loaded card image must have real pixel dimensions (non-broken)').toBeGreaterThan(0)
    expect(report.sampleSrc, 'loaded art must be served from /art/cards/card_NN.png').toMatch(/^\/art\/cards\/card_\d{2}\.png$/)
    expect(report.loadedStillShimmering, 'every card whose art loaded must have shed its .art-skeleton shimmer').toBe(0)
  })
})
