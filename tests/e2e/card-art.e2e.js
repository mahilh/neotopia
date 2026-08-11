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
      // WHICH CARDS HAVE ART IS ASKED OF THE SERVER, NOT HARDCODED (T3 S42). This block used to build
      // `card_01..card_20` from a literal 20 and assert that exact count, which was true on the day it was
      // written and is a tripwire aimed at the wrong lane: T2 owns this data, and the moment they ship the
      // remaining PNGs the merge gate would go RED for everybody, reporting a SUCCESS as a regression.
      // That is precisely the mistake I made in S39 (asserting a finding another lane was about to make
      // false), and it is cheaper to remove than to explain. A HEAD request per id is the real contract:
      // CardFrame builds `/art/cards/${card.id}.png` (CardFrame.jsx:121), so what the server serves IS
      // what the player gets, and this tracks 20 or 56 with no edit.
      // ⚠ r.ok IS NOT ENOUGH, AND IT LIED HERE FIRST (T3 S42). The Vite dev server SPA-falls-back any
      // unknown path to index.html with HTTP 200, so a HEAD for a card with no PNG returns ok:true and
      // text/html. The first version of this line reported 56/56 art on a deck that has 20 files on disk,
      // and it was caught only because that contradicted `ls public/art/cards`. Rule 95, one session
      // later, in the probe written to replace a hardcode. The content type is the honest question · a
      // player's <img> gets that same HTML, fails to decode, and falls back to the placeholder, which is
      // exactly why "the request succeeded" is the wrong thing to ask.
      const has = await Promise.all(DECK.map(c =>
        fetch(`/art/cards/${c.id}.png`, { method: 'HEAD' })
          .then(r => r.ok && (r.headers.get('content-type') || '').startsWith('image/'))
          .catch(() => false)))
      const artIdSet = new Set(DECK.filter((_, i) => has[i]).map(c => c.id))
      const byId = Object.fromEntries(DECK.map(c => [c.id, c]))
      const artFirst = DECK.filter(c => artIdSet.has(c.id))   // every id the server actually has, in deck order
      const rest = DECK.filter(c => !artIdSet.has(c.id))
      const store = window.__neotopia_store
      store.getState().initGame(
        [{ userId: 'card-art-e2e', username: 'Builder' }],
        [...artFirst, ...rest],
        shuffleArray([...PRODUCTION_TILES]),
        'classic',
      )
      const s = store.getState()
      return {
        artAvailable: artFirst.length, deckSize: DECK.length,
        artIds: [...artIdSet],
        hand: s.players[0].hand.map(c => c.id), offer: s.theOffer.map(c => c.id),
      }
    })

    // Sanity: the seed put art cards exactly where CardFrame renders them (proves the premise before the DOM
    // assertions · a 0-art hand would make a passing art test meaningless).
    // AT LEAST ONE, not exactly twenty. The premise this needs is "there is art to reveal", and that is the
    // only thing worth failing on · the exact count is T2's to move and is reported instead.
    expect(seeded.artAvailable, 'the server serves NO card art at all · every assertion below would be ' +
      'testing the placeholder path and calling it a reveal').toBeGreaterThan(0)
    const artSet = new Set(seeded.artIds)
    expect([...seeded.hand, ...seeded.offer].some(id => artSet.has(id)),
      `seeded hand/offer must contain an art card · hand=${seeded.hand} offer=${seeded.offer}`).toBe(true)
    console.log(`[card-art] art on the server: ${seeded.artAvailable}/${seeded.deckSize} · seeded hand: ` +
      `${seeded.hand} · offer: ${seeded.offer}`)

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

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// NO CARD IS EVER BLANK · ALL 56, IN A REAL BROWSER, AT 320 AND 1440 (T3 S42)
//
// Mahil's requirement: every card shows an image, no blanks, fits on mobile and laptop, no gaps, aligned.
// T2 owns the data, T1 owns the render, and proving it in a browser is mine.
//
// THE SPEC ABOVE ONLY EVER SEES THE CARDS IT HAPPENS TO DEAL · seven of fifty-six, art-bearing by
// construction, because it was built to prove the REVEAL path. That is the exact gap the brief names: a
// deck where half the art 404s passes it easily. This asserts the NEGATIVE instead, over the whole deck.
//
// WHAT "BLANK" ACTUALLY MEANS HERE · AND MY FIRST ANSWER WAS WRONG, WHICH A MUTATION CAUGHT.
// I wrote that a card goes empty "exactly when its primary element falls outside PROCEDURAL", then
// removed 'community' from that set to prove the gate had teeth · and the gate stayed GREEN, correctly.
// T1 built TWO levels of fallback, not one (CardFrame.jsx:382-386):
//     art PNG  →  ProceduralArt (when hasProceduralArt(el))  →  ElementIcon (when it does not)
// So losing the procedural geometry is not a blank at all; the icon still draws. The reasoned mechanism
// was a claim, and the mutation was the thing that tested it (Rule 81 · compute the constraint, do not
// reason it · here the constraint was a code path).
// MEASURED, the reachable blank is narrower and worse: an element value that BOTH fallbacks fail to
// recognise. Forcing `el` to an unknown string renders neither geometry nor icon, and this gate goes red.
// That is a live risk rather than a hypothetical, because el is `card.element || 'community'` and the
// fallback only catches FALSY · GameRoom passes cardPrimaryElement(card), the most common `type` across
// the card's own pattern cells, so a renamed or newly-typed cell arrives here truthy and unknown.
// Today every pattern cell type in the deck is one of the four known ones (measured: energy 44,
// biofarming 43, technology 40, community 63), so there are no blanks · but that is a fact about DATA,
// and T2 has renamed cards before. This is the gate that notices.
//
// IT IS ALSO THE ASSERTION THAT SURVIVES THE ART LANDING. "Every card shows a PNG" is false today and
// true when T2 ships; "no card is ever blank" is true in both worlds and is the thing a player actually
// experiences. The PNG count is REPORTED next to it, so the day it reaches 56/56 the log says so without
// anybody having to edit a number (Rule 63 · gate what is true, and my own S39 lesson about asserting a
// finding another lane is about to make false).
test.describe('Every card in the deck renders something · no blanks (T3 S42)', () => {
  test('all 56 cards render art or a drawn placeholder · never an empty frame · at 320 and 1440',
    async ({ page }) => {
      await gotoSoloBoard(page)

      const deck = await page.evaluate(async () => {
        const { DECK } = await import('/src/lib/projectCards.js')
        return DECK.map(c => c.id)
      })
      expect(deck.length, 'the deck is not 56 cards · this gate claims to cover all of them').toBe(56)

      // ── COUNTERWEIGHT FIRST (Rule 90) · the classifier must be able to SAY blank ─────────────────────
      // "zero blanks" is satisfiable by a classifier that can only ever return 'art' or 'placeholder', and
      // that is the likely failure here because both branches are generous: an <img> that never loaded and
      // a skeleton with no geometry could both be mis-read as fine. So before trusting a single all-clear,
      // strip the geometry out of one rendered card and require the SAME classifier to call it blank.
      // Checked by breaking the INPUT, not by reading the output once (Rule 80).
      const CLASSIFY = (sel) => {
        const out = []
        for (const frame of document.querySelectorAll(sel)) {
          const img = frame.querySelector('img.art-reveal')
          const imgOk = !!img && img.complete && img.naturalWidth > 0 &&
            parseFloat(getComputedStyle(img).opacity || '0') > 0.9
          const skel = frame.querySelector('.art-skeleton')
          const drawn = !!skel && skel.querySelector('svg') &&
            skel.querySelector('svg').children.length > 0
          const brokenShown = !!img && img.complete && img.naturalWidth === 0 &&
            parseFloat(getComputedStyle(img).opacity || '0') > 0.9
          out.push({
            id: frame.getAttribute('data-card-id') || null,
            verdict: imgOk ? 'art' : drawn ? 'placeholder' : 'BLANK',
            brokenShown,
          })
        }
        return out
      }
      const SEL = '[data-testid="card-hand"], [data-testid="card-offer"]'

      // SETTLE FIRST · and this line exists because the counterweight below was VACUOUS without it.
      // Run straight after the board mounts and the first card is still mid-decode: no loaded <img>, an
      // empty skeleton, so the classifier legitimately reads BLANK. Then "stripping" it changes nothing,
      // `verdict === 'BLANK'` is trivially true, and `restored === before` is BLANK === BLANK. The guard
      // reported itself as PRESENT while proving nothing · Rule 86, in the guard I wrote to prevent it.
      // Caught only because the log prints its own inputs ("a BLANK card reads BLANK once stripped").
      await page.evaluate(() => Promise.all(
        [...document.querySelectorAll('img.art-reveal')].map(i => i.decode().catch(() => {}))))
      await expect.poll(async () => await page.evaluate(({ sel, fn }) => {
        // eslint-disable-next-line no-new-func
        return new Function(`return (${fn})`)()(sel)[0]?.verdict
      }, { sel: SEL, fn: CLASSIFY.toString() }), {
        timeout: 10_000,
        message: 'no card ever settled into art or a placeholder, so the classifier self-test would have ' +
          'been run against a card that was already blank and could not have failed',
      }).not.toBe('BLANK')

      const canSayBlank = await page.evaluate(({ sel, fn }) => {
        // eslint-disable-next-line no-new-func
        const classify = new Function(`return (${fn})`)()
        const frame = document.querySelector(sel)
        if (!frame) return { ran: false }
        const img = frame.querySelector('img.art-reveal')
        const skel = frame.querySelector('.art-skeleton')
        const before = classify(sel)[0]?.verdict   // whatever this card legitimately is right now
        // REMOVE the node rather than dimming it. Setting img.style.opacity = '0' does NOT work here and
        // that mattered: .art-reveal carries `transition: opacity 0.4s`, so computed opacity is still ~1
        // the instant after the assignment and the classifier correctly read 'art'. A strip that the
        // subject can out-wait is not a strip · once every card had real art this counterweight started
        // reporting the wrong thing, which is the second way it tried to be vacuous in one session.
        const parent = img ? img.parentNode : null
        const nextTo = img ? img.nextSibling : null
        const keptSkel = skel ? skel.innerHTML : null
        if (img) img.remove()                     // no revealed image, with no animation to wait out
        if (skel) skel.innerHTML = ''             // and the placeholder drew nothing
        const verdict = classify(sel)[0]?.verdict
        if (img && parent) parent.insertBefore(img, nextTo)
        if (skel) skel.innerHTML = keptSkel ?? ''
        return { ran: true, before, verdict, restored: classify(sel)[0]?.verdict }
      }, { sel: SEL, fn: CLASSIFY.toString() })
      expect(canSayBlank.ran, 'no card frame was on screen to self-test the classifier against').toBe(true)
      expect(canSayBlank.verdict, 'the classifier called a card with NO revealed image and NO drawn ' +
        'geometry something other than BLANK · it cannot report the thing this test exists to find, so ' +
        'its all-clear is worthless').toBe('BLANK')
      // Restored to what it WAS, not merely to "not blank" · the constant version reported "the self-test
      // did not put the card back" on a board where the card was legitimately blank to begin with, which
      // is a confusing red pointing at the wrong line. Compare against the card's own prior verdict.
      expect(canSayBlank.before, 'the self-test ran against a card that was ALREADY blank · stripping it ' +
        'proves nothing and the whole counterweight passes for free').not.toBe('BLANK')
      expect(canSayBlank.restored, 'the self-test did not put the card back the way it found it')
        .toBe(canSayBlank.before)
      console.log(`[card-art] classifier self-test · a ${canSayBlank.before} card reads ` +
        `${canSayBlank.verdict} once stripped, and restores to ${canSayBlank.restored}`)

      // ── EVERY CARD, IN BATCHES, AT BOTH WIDTHS ───────────────────────────────────────────────────────
      // hand 3 + offer 4 = 7 rendered at a time, so the deck is walked in 8 front-loaded deals through the
      // REAL initGame rather than by hand-setting state (Rule 36 · mirror the path the product uses).
      const seenBy = {}
      for (const size of [{ width: 320, height: 568 }, { width: 1440, height: 900 }]) {
        await page.setViewportSize(size)
        const label = `${size.width}x${size.height}`
        const verdicts = []
        for (let batch = 0; batch * 7 < deck.length; batch++) {
          await page.evaluate(async (i) => {
            const { DECK } = await import('/src/lib/projectCards.js')
            const { PRODUCTION_TILES, shuffleArray } = await import('/src/store/gameStore.js')
            const front = DECK.slice(i * 7, i * 7 + 7)
            const rest = DECK.filter(c => !front.includes(c))
            window.__neotopia_store.getState().initGame(
              [{ userId: 'card-art-e2e', username: 'Builder' }],
              [...front, ...rest], shuffleArray([...PRODUCTION_TILES]), 'classic',
            )
          }, batch)
          // Let every <img> settle · a card mid-decode is neither art nor blank yet, and reading it there
          // would be a race reported as a defect.
          await page.waitForTimeout(350)
          await page.evaluate(() => Promise.all(
            [...document.querySelectorAll('img.art-reveal')].map(i => i.decode().catch(() => {}))))
          const rows = await page.evaluate(({ sel, fn }) => {
            // eslint-disable-next-line no-new-func
            return new Function(`return (${fn})`)()(sel)
          }, { sel: SEL, fn: CLASSIFY.toString() })
          verdicts.push(...rows)
        }

        const blanks = verdicts.filter(v => v.verdict === 'BLANK')
        const broken = verdicts.filter(v => v.brokenShown)
        expect(blanks, `at ${label}, ${blanks.length} of ${verdicts.length} rendered cards showed an EMPTY ` +
          'art area · no PNG and no drawn placeholder. A player sees a hole in the card. This happens when ' +
          "a card's primary element falls outside PROCEDURAL (CardFrame.jsx:41), which is a DATA change, " +
          'not a render one').toEqual([])
        expect(broken, `at ${label}, ${broken.length} cards are displaying a BROKEN image at full opacity`)
          .toEqual([])

        const art = verdicts.filter(v => v.verdict === 'art').length
        seenBy[label] = { rendered: verdicts.length, art, placeholder: verdicts.length - art }
        console.log(`[card-art] ${label} · ${verdicts.length} card renders · ${art} showed a PNG · ` +
          `${verdicts.length - art} drew the placeholder · 0 blank · 0 broken`)
      }

      // REPORTED, NOT GATED · this is T2's number to move and mine to publish. The day it reads 56 the log
      // says so, and nothing here needs editing for that to happen.
      const onServer = await page.evaluate(async () => {
        const { DECK } = await import('/src/lib/projectCards.js')
        const has = await Promise.all(DECK.map(c =>
          fetch(`/art/cards/${c.id}.png`, { method: 'HEAD' })
            .then(r => r.ok && (r.headers.get('content-type') || '').startsWith('image/'))
            .catch(() => false)))
        return has.filter(Boolean).length
      })
      console.log(`[card-art] DECK ART COVERAGE · ${onServer}/${deck.length} cards have a real PNG · ` +
        JSON.stringify(seenBy))
    })
})
