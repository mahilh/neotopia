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

// Reach the solo board and confirm the DEV store hook is live before driving it.
//
// THIS USED TO SKIP ITSELF, and that was wrong (T3 S35 · fixing my own S34 finding).
//   The old shape was `test.skip(!seeded, 'store seed exceeded 2000ms')`, copied from flow-mode.e2e.js
//   on the reasoning that a slow-but-healthy CI runner should not read as a regression. The reasoning is
//   sound in general and does not apply here, which is the part I got wrong the first time.
//
//   A skipped test is indistinguishable from a passing one in a green tick · the same pathology as
//   bot-health being red for 32 runs while carrying no information. This one runs on the MERGE GATE
//   (.github/workflows/e2e.yml), so the failure mode is: somebody deletes the dev store seam, card-art
//   silently skips, the gate goes green, and the only E2E covering the art-reveal path has quietly
//   stopped covering anything.
//
//   MEASURED before changing it, 6 runs: the gap between [data-game-phase="playing"] appearing and
//   window.__neotopia_store existing was 9, 9, 10, 10, 10, 25 ms. The old budget was 2000ms · eighty
//   times the worst observation. Nothing that slow is "a slow runner": the seam is assigned by the same
//   component render that sets data-game-phase, which this line has ALREADY waited up to 15s for. So a
//   2s overrun does not mean slow, it means gone · and gone is precisely the regression worth failing on.
//
//   Kept generous rather than tight (10s · 400x the worst observation) so this still cannot flake on a
//   loaded runner. The change is not "less patient", it is "a skip is not a pass". (Rule 63.)
async function gotoSoloBoard(page) {
  await page.goto('/game')
  await page.waitForSelector('[data-game-phase="playing"]', { timeout: 15_000 })
  await expect
    .poll(() => page.evaluate(() => typeof window.__neotopia_store !== 'undefined'), {
      timeout: 10_000,
      message: 'the board rendered but window.__neotopia_store never appeared · the dev store seam this ' +
        'spec drives is gone, so every assertion below would be testing nothing. Failing rather than ' +
        'skipping: on the merge gate a skip is indistinguishable from a pass.',
    })
    .toBe(true)
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

    // RACE GUARD (T3 S22 · adversarial-review finding): the `loaded` set is read from DOM decode state
    // (img.complete && naturalWidth>0) but .art-skeleton unmounts only when React's imgLoaded state COMMITS
    // (CardFrame onLoad). A straggler PNG can be decode-complete one event-loop turn BEFORE its onLoad task +
    // React re-render drop the skeleton · a single snapshot caught in that window would false-RED on working
    // art. So poll until the SETTLED state: at least one card loaded AND zero loaded cards still carry a
    // skeleton. Returns -1 (keep polling) until a card loads, then the still-shimmering count, which settles
    // to 0. If the reveal genuinely never unmounts the skeleton, this times out · an honest RED, clear message.
    await expect.poll(() => page.evaluate(() => {
      const cards = [...document.querySelectorAll('.project-card')]
      const loaded = cards.filter(c => { const im = c.querySelector('img.art-reveal'); return im && im.complete && im.naturalWidth > 0 })
      if (loaded.length === 0) return -1
      return loaded.filter(c => c.querySelector('.art-skeleton')).length
    }), {
      message: 'loaded cards never settled shimmer-free · CardFrame did not unmount .art-skeleton after load',
      timeout: 15_000,
    }).toBe(0)

    // Snapshot the full contract now that the reveal has completed AND settled (race-free per the poll above).
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
