// NeoTopia E2E · MEASUREMENT · viewport sweeps, reachability self-test, diagnostic self-check (T3 S47).
// Split out of seedHelpers · see lobby.js for why. Nothing here touches the database or the lobby: it
// measures a rendered page and proves its own instruments can still see before their all-clears count.

export async function forEachViewport(page, sizes, measure, { settleMs = 250 } = {}) {
  const original = page.viewportSize()
  const out = []
  try {
    for (const size of sizes) {
      await page.setViewportSize({ width: size.width, height: size.height })
      await page.evaluate(() => {
        window.scrollTo(0, 0)
        for (const el of document.querySelectorAll('*')) {
          if (el.scrollTop) el.scrollTop = 0
          if (el.scrollLeft) el.scrollLeft = 0
        }
      })
      await page.waitForTimeout(settleMs) // measure the settled layout, not mid-reflow
      out.push({ size, result: await measure(page, size) })
    }
  } finally {
    if (original) {
      await page.setViewportSize(original)
      await page.waitForTimeout(settleMs)
    }
  }
  return out
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE REACHABILITY PROBE IS T1's · THIS ONLY PROVES IT CAN STILL SEE (T3 S41)
//
// I wrote my own version of this earlier in the same session and DELETED IT, which is the right outcome and
// worth recording rather than hiding. Mahil ruled one implementation, T1's, because they found the defect
// that a fresh writing gets wrong · three factory cells report an SVG <text> on top and are NOT broken,
// since it sits inside the <g> carrying onFactoryClick. Mine credited the handler ancestor too (I built it
// from T1's published correction), but theirs also carries `measured` and `requireInViewport`, which are
// the two halves mine was weaker on. Two implementations would have been a second contract AND a second
// witness, which is T1's own Rule 94.
//
// SO THE ONLY THING HERE IS THE PART THEIRS DOES NOT DO: proving the probe can still detect a covered board
// before its all-clear is believed. `measured` already catches "the selector matched nothing"; it cannot
// catch "the check credits so much that nothing can ever fail it", which is the live risk precisely BECAUSE
// the probe is deliberately generous about handler-bearing ancestors. One `contains` on the wrong node and
// every cell passes forever, on a gate whose whole job is to be believed.
// So: drop a real full-viewport overlay, require the SAME probe to call every cell blocked, remove it, and
// require the all-clear back. A positive and a negative control in one call. I checked exactly this by hand
// last session in a scratch file I then deleted · a rule stated as a fact gets rediscovered, a rule
// expressed as a function cannot be (Rule 90).
export async function selfTestReachability(page, reachability, opts = {}) {
  const run = () => page.evaluate(reachability, opts)
  const before = await run()
  await page.evaluate(() => {
    const d = document.createElement('div')
    d.id = '__t3_reach_selftest'
    d.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,0.01)'
    document.body.appendChild(d)
  })
  const covered = await run()
  await page.evaluate(() => document.getElementById('__t3_reach_selftest')?.remove())
  const after = await run()
  return {
    probed: before.total,
    measured: before.measured,
    blockedNormally: before.blocked,
    blockedWhenCovered: covered.blocked,
    blockedAfterRemoval: after.blocked,
    sees: before.measured && before.total > 0 && covered.blocked === covered.total && after.blocked === before.blocked,
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE DIAGNOSTIC HAS TO PROVE IT CAN SEE, BEFORE IT IS TRUSTED TO EXPLAIN A FAILURE (T3 S41 · Rule 80 + 90)
//
// endgame-live's diagnose() reports counts of element-btn / region-btn / hex-valid and the value of
// data-ui-phase. EVERY ONE OF THOSE DEGRADES TO A PLAUSIBLE VALUE when its selector is wrong: a renamed
// testid reports 0, which is indistinguishable from an honest "none right now", and a missing root reports
// a string. That is Rule 80 exactly · a counter that cannot measure must say so, never resolve to a number
// · and last session I validated these by hand, in a scratch probe I then deleted. A rule stated as a fact
// gets rediscovered; a rule expressed as a function cannot be (Rule 90).
//
// IT COSTS NOTHING TO RUN, and that is why it can be unconditional. Selecting a factory, an element and a
// region spends NO game action · only the hex click commits (useGameActions.js:116-130) · and clicking the
// same factory again toggles the whole selection off (useGameActions.js:73). So this walks the real 4-step
// interface, requires each selector to MOVE from 0, and puts the board back exactly where it found it.
// A counter that never changes is not measuring; this is the difference between reading a zero and
// believing one.
export async function assertDiagnoseCanSee(page, { expect, factoryId = 0 } = {}) {
  const look = () => page.evaluate(() => {
    const root = document.querySelector('[data-ui-phase]')
    const n = (sel) => document.querySelectorAll(sel).length
    return {
      uiPhase: root?.getAttribute('data-ui-phase') ?? 'NO-ROOT',
      myTurn: root?.getAttribute('data-my-turn') ?? 'unset',
      factory: n('[data-testid="factory"]'),
      elementBtn: n('[data-testid="element-btn"]'),
      regionBtn: n('[data-testid="region-btn"]'),
      hexValid: n('[data-testid="hex-valid"]'),
      cardOffer: n('[data-testid="card-offer"]'),
    }
  })

  // 1 · the selectors that must NEVER legitimately be zero on a dealt board.
  const idle = await look()
  expect(idle.uiPhase, 'data-ui-phase is not on the GameRoom root · diagnose() would report NO-ROOT for the ' +
    'rest of the run and every stall would look like the same one').not.toBe('NO-ROOT')
  expect(idle.myTurn, 'data-my-turn is missing · diagnose() cannot tell "not my turn" from "dead control"')
    .not.toBe('unset')
  expect(idle.factory, 'the factory testid matched nothing on a dealt board · the selector is wrong, and ' +
    'every later reading of 0 would be a broken selector wearing the costume of a measurement').toBe(3)
  expect(idle.cardOffer, 'the card-offer testid matched nothing on a dealt board').toBeGreaterThan(0)

  // 2 · the CONDITIONAL selectors, which are legitimately 0 at idle · so make them move, for free.
  const plan = await page.evaluate((fid) => {
    const g = window.__neotopia_store?.getState?.()
    const f = g?.factories?.find(x => x.id === fid) ?? g?.factories?.[0]
    if (!f) return null
    const el = f.elements.find(e => e.count > 0)
    if (!el) return null
    for (const rid of f.betweenRegions) {
      if (g.getValidPlacements?.(f.id, rid)?.length) return { factoryId: f.id, element: el.type, regionId: rid }
    }
    return null
  }, factoryId)
  if (!plan) return { walked: false, reason: 'no legal opening move to walk · invariants still checked' }

  // force:true throughout · the factory <g> carries an infinite pulse animation, so a plain click never
  // settles and times out (Rule 93 · that swallowed timeout is what hid the tutorial overlay for a session).
  await page.locator(`[data-testid="factory"][data-factory="${plan.factoryId}"]`).click({ force: true, timeout: 5_000 })
  const afterFactory = await look()
  expect(afterFactory.elementBtn, 'a factory was selected and the element-btn selector still matched ' +
    'nothing · diagnose() cannot see the element step, so "factory-inert" would be unfalsifiable')
    .toBeGreaterThan(0)

  await page.locator(`[data-testid="element-btn"][data-element="${plan.element}"]`).first().click({ timeout: 5_000 })
  const afterElement = await look()
  expect(afterElement.regionBtn, 'an element was selected and the region-btn selector still matched nothing')
    .toBeGreaterThan(0)

  await page.locator(`[data-testid="region-btn"][data-region="${plan.regionId}"]`).first().click({ timeout: 5_000 })
  const afterRegion = await look()
  expect(afterRegion.hexValid, 'a region was selected and the hex-valid selector still matched nothing · ' +
    'diagnose() cannot see the board, so "region-inert" would fire on a working game').toBeGreaterThan(0)

  // 3 · put it back. Clicking the SAME factory toggles the selection off (useGameActions.js:73). Nothing
  // was committed, so the game under test is exactly where it was · this must never cost the caller a turn.
  await page.locator(`[data-testid="factory"][data-factory="${plan.factoryId}"]`).click({ force: true, timeout: 5_000 })
  const back = await look()
  expect(back.uiPhase, 'the self-check left the interface mid-selection · it has to hand the board back ' +
    'untouched or it is not free').toBe('idle')

  return {
    walked: true,
    saw: { elementBtn: afterFactory.elementBtn, regionBtn: afterElement.regionBtn, hexValid: afterRegion.hexValid },
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// THE ACTION DRIVER · MOVED OUT OF endgame-live.e2e.js SO IT CAN BE TESTED WITHOUT PAYING FOR A ROOM (T3 S46)
//
// It lived inside the live spec, which meant the ONLY way to find out whether it worked was a two-anon-sign-in
// run against the real backend · so every driver defect cost a live run to observe, and five of them did.
// Nothing in here is multiplayer: it drives the four-step placement path and the offer, both of which exist
// on the free practice board. Importing a spec to reuse a function would register that spec's tests, so the
// right home is here, where nothing runs on import.
// The caller passes `expect` rather than this module importing @playwright/test · seedHelpers is loaded by
// vitest-adjacent code paths too, and a Playwright import at module scope would drag the runner in.
