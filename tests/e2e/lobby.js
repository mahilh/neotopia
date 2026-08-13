// NeoTopia E2E · THE LOBBY LOOP · split out of seedHelpers (T3 S47).
//
// seedHelpers had grown to 734 lines holding the DB seeding core, the lobby loop, viewport measurement,
// reachability self-tests, a store snapshot and the action driver · imported by 15 specs, so a change for
// one caller risked all of them. I had already collided with my own three-sessions-older code (a second
// `clicked`), and I called that "a warning, not an accident" · this is acting on it before T1 adds a
// coupling assertion and T2 exports a fixture into the same file.
// Split by CONCERN, and the concerns are real: this one drives the multiplayer lobby UI and knows nothing
// about the database; seedHelpers writes rows and knows nothing about the UI.

import { BOARD } from './seedHelpers'
import { assertProjectAgreement } from './projectAgreement.js'

// NOT retro-fitted to two-human.e2e.js or multiplayer-endgame-live.e2e.js in the same session: both are
// wired into CI and green, and rewriting a file somebody is watching land is how a green gate turns red for
// a reason nobody can find. Routed in comms with this exact note instead.
const NAME_INPUT = 'Builder name (max 20)'

async function gotoLobby(page, expect) {
  await page.goto('/')
  const input = page.getByPlaceholder(NAME_INPUT)
  const enterCiv = page.getByRole('button', { name: /enter the civilization/i })
  await expect(input.or(enterCiv).first()).toBeVisible({ timeout: 15_000 })
  if (await enterCiv.isVisible()) {
    await enterCiv.click()
    await expect(input).toBeVisible({ timeout: 15_000 })
  }
}

/**
 * Drive two real browser pages through create → join → ready → start, entirely through the UI.
 * `expect` is passed in so this module stays importable by vitest (which does not have Playwright's expect).
 * Returns { code, roomId }. Throws with the offending SCREEN, never a bare locator timeout.
 */
export async function runTwoHumanLobby(p1, p2, { expect, hostName, joinerName, boardSelector = BOARD, mode = 'classic' }) {
  await gotoLobby(p1, expect)
  await p1.getByPlaceholder(NAME_INPUT).fill(hostName)
  await p1.getByRole('button', { name: /enter neotopia/i }).click()

  // ── THE TEST PROCESS AND THE BROWSER MUST BE ON ONE PROJECT (T3 S67) ──────────────────────────────
  // HERE and not in the spec, for the same reason this helper exists at all: every two-human live spec
  // passes through it, so no spec can forget it and none can inherit a fourth copy (Rule 100).
  // AND HERE rather than a line later, because p2's context has not navigated yet · a mismatch caught
  // now costs ONE identity, and the run it replaces cost two plus a five-minute driver failure that
  // read as a multiplayer sync defect. UNMEASURED never throws, so this cannot red anybody's gate.
  // ⚠ THE VERDICT IS NOW REQUIRED, NOT PRINTED (T3 S69). S67 shipped this logging `[project] AGREE` and
  // asserting nothing, with a comment saying "AGREE and UNMEASURED are different facts and only one of
  // them is protection". That was true and it was addressed to a human reading a log · so the state the
  // line existed to expose could occur on every run and nothing would fail. It throws on UNMEASURED now,
  // naming which half was missing; a caller that genuinely cannot measure passes { require: false, why }.
  console.log(`[project] ${await assertProjectAgreement(p1, { context: 'runTwoHumanLobby · host signed in' })}`)

  // MODE MUST BE CHOSEN BEFORE Create Room, not after (T3 S54). Create Room reads the CURRENT gameMode
  // as its argument, so a toggle clicked afterwards changes nothing and the room is silently Classic
  // (Rule 61 · verify the value, not just the signature · flow-mode-live's header makes the same point).
  // The aria-pressed wait is what makes this deterministic rather than a race against a re-render.
  if (mode === 'flow') {
    const toggle = p1.locator('[data-testid="mode-flow"]')
    await expect(toggle, 'the Flow toggle is missing · a caller asking for flow would silently get a ' +
      'Classic room, and every timing assertion built on the 15s turn would be measuring 90').toBeVisible({ timeout: 15_000 })
    await toggle.click()
    await expect(toggle, 'clicking Flow did not select it before Create Room read gameMode').toHaveAttribute('aria-pressed', 'true')
  }

  await p1.getByRole('button', { name: 'Create Room' }).click({ timeout: 15_000 })

  const codeEl = p1.locator('[style*="monospace"]').first()
  await expect(codeEl).toBeVisible({ timeout: 15_000 })
  const code = (await codeEl.textContent())?.trim() ?? ''
  expect(code, `room code "${code}" is not 6 chars A-Z0-9`).toMatch(/^[A-Z0-9]{6}$/)

  await gotoLobby(p2, expect)
  await p2.getByPlaceholder(NAME_INPUT).fill(joinerName)
  await p2.getByRole('button', { name: /enter neotopia/i }).click()
  await p2.getByRole('button', { name: 'Join Room' }).click({ timeout: 15_000 })
  await p2.getByPlaceholder('ABC234').fill(code)
  await p2.getByRole('button', { name: 'Join', exact: true }).click({ timeout: 15_000 })

  const ready = p2.getByTestId('ready-btn')
  try {
    await expect(ready).toBeVisible({ timeout: 25_000 })
  } catch {
    throw new Error(`the joiner never reached the waiting room after joining "${code}" · screen: ` +
      await p2.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 500)))
  }
  await ready.click({ timeout: 10_000 })

  // ENABLED, not visible. This is the line the copies were missing.
  const start = p1.getByTestId('start-btn')
  await expect(start, 'the Start control never appeared for the host').toBeVisible({ timeout: 15_000 })
  try {
    await expect(start).toBeEnabled({ timeout: 30_000 }) // presence convergence · the genuinely slow step
  } catch {
    throw new Error('Start Game never became enabled · presence did not converge. host screen: ' +
      await p1.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 400)))
  }
  await start.click()

  try {
    await p1.waitForURL(/\/game\/[0-9a-f-]+/i, { timeout: 25_000 })
    await p2.waitForURL(/\/game\/[0-9a-f-]+/i, { timeout: 25_000 })
  } catch {
    throw new Error('a player never reached the board after Start. host: ' +
      await p1.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200)) + ' | joiner: ' +
      await p2.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 200)))
  }
  await expect(p1.locator(boardSelector)).toBeVisible({ timeout: 20_000 })
  await expect(p2.locator(boardSelector)).toBeVisible({ timeout: 20_000 })

  // ── AND DISMISS THE TUTORIAL, IN BOTH BROWSERS, OR NOTHING BELOW THIS CAN BE CLICKED ──────────────────
  // MEASURED (T3 S40), after a whole session last time spent guessing at this exact stall. GameRoom holds
  // `useState(() => !tutorialSeen())` (GameRoom.jsx:196) and tutorialSeen reads localStorage
  // (Tutorial.jsx:15). EVERY Playwright context starts with empty localStorage, so the tutorial is up for
  // every live spec, always · and it renders on `phase === 'playing'`, which is the instant a driver starts
  // clicking. On the practice board, with the tutorial up, document.elementFromPoint at the centre of all
  // three factories returned a plain HTML <div>/<p> with `containsHit: false`, and a real mouse click left
  // uiPhase at 'idle'. With it dismissed the same click gives 'factorySelected' and the hit is a <text>
  // INSIDE the factory <g> (containsHit true · Rule 83's `el.contains(top)` correction, exactly).
  // THAT is what stalled S39: seat 0 held 2 actions and 4 offer cards and neither a placement nor a draw
  // committed, because every click was landing on the tutorial. Not uiPhase, which was my hypothesis and is
  // falsified twice over (handleDrawCard never reads it, and the dim-the-rest CSS is opacity-only).
  // It belongs HERE rather than in one spec: every live spec that reaches a board needs it, and the two
  // that already exist were both missing it, silently, because an overlay does not announce itself.
  for (const p of [p1, p2]) {
    const skip = p.getByTestId('tutorial-skip')
    if (await skip.isVisible().catch(() => false)) await skip.click({ timeout: 10_000 })
    await expect(p.getByRole('dialog', { name: /how to play/i }),
      'the tutorial is still up · every click below it lands on the overlay, not on the board')
      .toBeHidden({ timeout: 10_000 })
  }

  return { code, roomId: new URL(p1.url()).pathname.split('/').pop() }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════════════════
// MULTI-VIEWPORT MEASUREMENT · scroll reset BY CONSTRUCTION (T3 S39 · P3)
//
// Measuring the same page at several sizes contaminated itself three sessions running: resizing to 320 after
// a pass at 1280 inherited that pass's scrollTop, so "how far below the fold ON ARRIVAL" was read from a
// container somebody had already scrolled · 489px instead of the true 1038px. Plausible, wrong, and naming
// something it had not measured. Three occurrences of one mistake is a missing harness step, not a slip.
//
// So the reset is not a line a caller has to remember: this helper resets the window AND every scrollable
// element on the page between viewports, then lets layout settle, then calls the measurement. A caller
// cannot inherit scroll from the previous size because there is no code path in which it survives.
