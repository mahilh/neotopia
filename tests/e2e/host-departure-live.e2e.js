// NeoTopia · WHAT THE OTHER PLAYER SEES WHEN THE HOST'S PHONE DIES (T3 S51).
//
// The one beta-relevant path with ZERO coverage, and unlike the endgame it is GUARANTEED to happen in the
// first week: somebody's battery goes, somebody closes the tab, somebody walks into a lift. `grep` for a
// host-departure scenario across tests/e2e/ returned nothing before this file.
//
// ── I CORRECTED MY OWN S50 DIAGNOSIS TO WRITE THIS, AND THE CORRECTION IS THE INTERESTING PART ───────────
// In S50 I reported: "useGameRoom.js:614 sets status='finished' when the host leaves, with no check that a
// game is in progress", and proposed measuring two cases · host clicks Leave, and host's tab closes. The
// first case DOES NOT EXIST. `leaveRoom` has exactly ONE caller in the whole product · Lobby.jsx:579, the
// "← Leave" button in the WAITING ROOM · and GameRoom never calls it. A host cannot click Leave during a
// game because there is no such control on that screen.
// I had read the function's BODY and not its CALLERS, which is Rule 84 in my own words ("ask what SHIPPING
// code calls it"), and it went into a session brief as a priority because a recommendation is consumed by
// someone who reasonably assumes the proposer checked (Rule 108a). So the FREE half of this file is a guard
// that pins the caller set, below · the fact is cheap to state and was expensive to get wrong.
//
// ── WHAT THIS MEASURES, AND WHY THE COUNTERWEIGHT IS THE WHOLE TEST ──────────────────────────────────────
// The finding here is an ABSENCE · the peer sees nothing, learns nothing, and the game does not advance.
// An absence is the easiest thing in the world to measure by accident: a peer whose websocket never
// connected, or whose store was never seeded, also "sees nothing", and would produce an identical green.
// So the counterweight is written FIRST and it is not a comment (Rule 90): before the host departs, the
// host takes a REAL action and the peer's store must be observed to MOVE. Only once this client has been
// proven to be listening does its later silence mean anything at all.
//
// COST · ZERO SIGN-INS AS OF T3 S62 · it was 2 anonymous ones, and that cost was the stated reason this
// spec was routed to the nightly and then never wired. Both contexts now take pool members 0 and 1
// (seedPoolCredential), so it mints nothing at all. The caller-set guard costs zero and is offline.
// RUNS-NOWHERE: eleven sessions and counting · routed to T2 in comms/t3-s51, t3-s60 and now t3-s62.
// THE ASK IS NOW ONE RUN LINE FOR A SPEC THAT COSTS NO IDENTITIES. Nothing else about it has changed.
// DELETE THIS DECLARATION IN THE SAME COMMIT THAT WIRES THE FILE.
// Run locally:  node scripts/with-project-env.cjs npx playwright test tests/e2e/host-departure-live.e2e.js
// ⚠ with-project-env is not optional · the shell exports another project's Supabase URL and it beats
//   .env.local in both Vite and loadEnv, so a bare `npx playwright test` drives a dead host (Rule 93).

import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadEnv, uniqueName, deleteRoomAsHost } from './seedHelpers'
import { runTwoHumanLobby } from './lobby'
import { seedPoolCredential, reportPoolOutcome } from './poolBrowser'
import { spendOneAction, read } from './driver'

let ENV = null
try { ENV = loadEnv() } catch { /* no creds · the live test skips · the offline guard still runs */ }

// What the peer's SCREEN says, as opposed to what its store holds. Both matter and they can disagree:
// the store is what the client believes, the screen is what the human is told about it.
const PEER_VIEW = () => {
  const root = document.querySelector('[data-my-turn]')
  const el = (sel) => document.querySelector(sel)
  return {
    myTurn: root?.getAttribute('data-my-turn') ?? null,
    // every visible string that could plausibly be carrying a warning to the player
    statusText: (el('[data-testid="turn-status"]') ?? el('[data-testid="status-text"]'))?.textContent?.trim() ?? null,
    endTurnDisabled: el('[data-testid="end-turn"]')?.disabled ?? null,
    // the whole point: is the word "left"/"disconnect"/"waiting" anywhere on screen at all?
    mentionsDeparture: /\b(left|disconnect|offline|lost connection|opponent gone)\b/i.test(document.body.innerText),
    bodyChars: document.body.innerText.length,
  }
}

test.describe('the host departs mid-game · what the peer is told (T3 S51)', () => {

  // ── FREE · the caller-set guard that my S50 mistake earns ───────────────────────────────────────────────
  // Offline, no identities, merge-gate class. It encodes the fact I got wrong: leaveRoom marks a room
  // 'finished' with no in-game check, and that is SAFE today only because its single caller is the
  // pre-game lobby. Wire it into GameRoom without adding a guard and this reds and says why.
  test('OFFLINE · leaveRoom is reachable only from the pre-game lobby', async () => {
    const srcFiles = []
    const walk = (dir) => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.isDirectory()) walk(`${dir}/${e.name}`)
        else if (/\.(js|jsx)$/.test(e.name) && !/\.test\./.test(e.name)) srcFiles.push(`${dir}/${e.name}`)
      }
    }
    walk(new URL('../../src', import.meta.url).pathname)

    // COUNTERWEIGHT FIRST: if the scan finds no files, or the symbol has been renamed, every assertion
    // below passes by having nothing to look at (Rule 86).
    expect(srcFiles.length, 'no source files scanned · this guard is auditing an empty set').toBeGreaterThan(20)
    const mentioning = srcFiles.filter(f => /\bleaveRoom\b/.test(readFileSync(f, 'utf8')))
    expect(mentioning.length, 'leaveRoom appears nowhere in src/ · it has been renamed or removed, and ' +
      'this guard is now watching a symbol that does not exist').toBeGreaterThan(0)

    // The definition + the hook's return object live in useGameRoom; the only CONSUMER is the lobby.
    const consumers = mentioning
      .map(f => f.split('/src/')[1])
      .filter(f => f !== 'hooks/useGameRoom.js')
    expect(consumers.sort(), 'leaveRoom sets game_rooms.status = "finished" with NO check that a game is ' +
      'in progress (useGameRoom.js:614). That is safe ONLY while its single caller is the pre-game lobby. ' +
      'A new caller on the GAME screen would let a host end a live game for everyone else by walking away ' +
      '· and the peer has no game_rooms subscription, so it would not even be told. If you are adding one ' +
      'on purpose, add the in-game guard first, then update this list.').toEqual(['pages/Lobby.jsx'])
  })

  test('LIVE · the host tab dies mid-game and the peer is told nothing', async ({ browser }) => {
    test.skip(!ENV, 'no Supabase creds · nightly-class live test')
    // The observation window is now 45s inside the budget plus ~100s past it and the lobby handshake is not free · the default 60s timeout
    // killed the first successful run AFTER it had printed every measurement, which reads as a failed
    // test and was a finished one.
    test.setTimeout(360_000)

    const ctxHost = await browser.newContext()
    const ctxPeer = await browser.newContext()
    // POOL (T3 S62) · the header above says "COST · 2 anonymous sign-ins. Nightly-class", and that cost
    // is the stated reason this spec has never been wired. It is now ZERO. Members 0 and 1 · DIFFERENT
    // ones, because seat resolution is by userId and one member across both contexts would seat the
    // host and the peer as the SAME player. seedPoolCredential refuses that outright rather than
    // trusting this comment.
    const poolHost = await seedPoolCredential(ctxHost, { index: 0, label: 'host-departure host' })
    const poolPeer = await seedPoolCredential(ctxPeer, { index: 1, label: 'host-departure peer' })
    const host = await ctxHost.newPage()
    const peer = await ctxPeer.newPage()
    let roomId = null
    let hostSession = null
    let hostClosed = false

    try {
      const lobby = await runTwoHumanLobby(host, peer, {
        expect, hostName: uniqueName('E2EHDH'), joinerName: uniqueName('E2EHDP'),
      })
      roomId = lobby.roomId
      // Read from the PAGE, never from the identity counter · the teardowns already reuse member 0, so
      // auth.users moves for their reason and cannot separate them from a browser (T2's condition).
      await reportPoolOutcome(host, { ...poolHost, label: 'host-departure host' })
      await reportPoolOutcome(peer, { ...poolPeer, label: 'host-departure peer' })
      hostSession = await host.evaluate(() => localStorage.getItem('neotopia-auth'))
      expect(roomId, 'no roomId from the host URL').toBeTruthy()

      const client = createClient(ENV.url, ENV.key, { auth: { persistSession: false } })
      const roomStatus = async () => (await client.from('game_rooms')
        .select('status').eq('id', roomId).maybeSingle()).data?.status ?? null

      // ── COUNTERWEIGHT · PROVE THE PEER IS LISTENING BEFORE TRUSTING ITS SILENCE ───────────────────────
      // Without this the test would pass identically against a peer whose realtime never connected.
      const before = await read(peer)
      expect(before, 'the peer never seeded a store · nothing below would mean anything').toBeTruthy()

      // WHICH PAGE MAY ACT · ask the APP, do not derive it (Rule 95a). The first draft parsed the auth
      // blob out of localStorage to map user -> seat and compare against currentSeat. That is a second
      // implementation of something the product already publishes: GameRoom stamps `data-my-turn` on its
      // root and flips it per turn. The derived version silently picked the wrong page when the uid shape
      // did not match, the wrong page still committed an action, and the counterweight failed with the
      // actor and the watcher being the same client · which reads exactly like a broken product.
      const turnOwner = async (page) =>
        (await page.locator('[data-my-turn]').first().getAttribute('data-my-turn')) === 'true'
      const hostActs = await turnOwner(host)
      const peerActs = await turnOwner(peer)
      console.log('[host-departure] data-my-turn · host:', hostActs, '· peer:', peerActs)
      // Exactly one of them must own the turn. Both-false means neither page has resolved its seat (the
      // real failure the first draft hid); both-true is impossible and would mean the attribute is wrong.
      expect(hostActs !== peerActs, `data-my-turn is ${hostActs}/${peerActs} on host/peer · exactly one ` +
        'client must own the turn. Both false = neither page resolved its seat, so no action can be ' +
        'taken and nothing below is measurable.').toBe(true)
      const actor = hostActs ? host : peer
      const watcher = hostActs ? peer : host

      const watcherBefore = await read(watcher)
      const acted = await spendOneAction(actor, { expect })
      expect(acted?.stage, `the actor could not take an action (${JSON.stringify(acted)}) · the ` +
        'counterweight cannot be established, so the silence measured later proves nothing').toBe('ok')

      await expect.poll(async () => {
        const now = await read(watcher)
        return now.actionsRemaining !== watcherBefore.actionsRemaining ||
               now.placed !== watcherBefore.placed || now.offer !== watcherBefore.offer
      }, { timeout: 20_000, message: 'THE COUNTERWEIGHT FAILED · the peer never observed the actor\'s ' +
           'real action, so this client is not listening and its later silence is unmeasured, not a finding' })
        .toBe(true)
      console.log('[host-departure] counterweight OK · the watcher observed a real action cross the wire')

      // ── THE DEPARTURE · a dead battery, not a click. Nothing in the app runs on tab close: there is no
      //    beforeunload/pagehide/unload handler in useGameRoom, useGameSync, usePresence or GameRoom.
      const peerBefore = await read(peer)
      const viewBefore = await peer.evaluate(PEER_VIEW)
      const statusBefore = await roomStatus()

      await ctxHost.close()
      hostClosed = true
      console.log('[host-departure] host context closed · watching the peer')

      // ⚠ THE MEANING OF THIS WINDOW CHANGED IN S52 AND THE NUMBER DID NOT · which is exactly the rot I
      // criticised in my own S51 write-up: "if someone adds a 120s timeout tomorrow, my spec still passes
      // at 45s while its own comment becomes false." Someone did, and it was me. In S51 a frozen board at
      // 45s meant NOTHING WILL EVER HAPPEN. Today it means WE ARE STILL INSIDE THE BUDGET the UI prints ·
      // Classic is 90s, and a remote client adds GRACE*(1+seat) before it will end someone else's turn.
      // So the window is now split, and the second half is the assertion that could not exist before.
      const samples = []
      for (let i = 0; i < 9; i++) {                       // 45s · INSIDE the budget
        await peer.waitForTimeout(5000)
        samples.push({ t: (i + 1) * 5, ...(await read(peer)) })
      }
      const peerAfter = samples.at(-1)
      const viewAfter = await peer.evaluate(PEER_VIEW)
      const statusAfter = await roomStatus()

      console.log('[host-departure] room status  before/after:', statusBefore, '/', statusAfter)
      console.log('[host-departure] peer store   before:', JSON.stringify(peerBefore))
      console.log('[host-departure] peer store   after :', JSON.stringify(peerAfter))
      console.log('[host-departure] peer view    before:', JSON.stringify(viewBefore))
      console.log('[host-departure] peer view    after :', JSON.stringify(viewAfter))
      console.log('[host-departure] seat over time:', samples.map(s => `${s.t}s:seat${s.currentSeat}/turn${s.turnNumber}`).join(' '))

      // ── CHARACTERISATION · WHAT IS TRUE TODAY, ASSERTED SO THAT FIXING IT GOES RED ────────────────────
      // This is a citation, not an endorsement (Rule 97/101). Every assertion below describes a DEFECT.
      // When someone fixes one, this test must go red and be updated in the same commit · that is the
      // point of writing it down rather than filing it.
      expect(statusAfter, 'a closed tab does not mark the room finished · nothing runs on unload, so the ' +
        'room stays open and the host CAN come back (this half is good news and worth keeping)')
        .toBe(statusBefore)

      expect(viewAfter.mentionsDeparture, 'TODAY: nothing on the peer\'s screen mentions that the other ' +
        'player is gone. There is no game_rooms subscription during a game and GameRoom renders nothing ' +
        'from presence, so the peer has no mechanism to be told. If this is now false, someone shipped ' +
        'the fix · update this test in the same commit.').toBe(false)

      // ── HALF ONE · INSIDE THE BUDGET, THE BOARD HOLDS ─────────────────────────────────────────────────
      // This is the S51 measurement and it still holds · but it now means something completely different,
      // and that is the whole reason this file had to change in the same commit as the fix (Rule 101).
      // In S51 this said "no timeout exists, so this is permanent". Today it says "the clock has not run
      // out yet", which is what a promised 90-second turn is SUPPOSED to look like at 45 seconds. The
      // assertion is unchanged; the claim under it is the opposite.
      expect({ seat: peerAfter.currentSeat, turn: peerAfter.turnNumber },
        'the turn moved BEFORE the budget the UI prints · a player who stepped away for forty seconds ' +
        'just lost their turn, which is the exact harm the timeout must not cause')
        .toEqual({ seat: peerBefore.currentSeat, turn: peerBefore.turnNumber })

      expect(viewAfter.myTurn, 'the peer is not yet on turn · correct while the budget is unspent')
        .toBe('false')

      // ── HALF TWO · PAST THE DEADLINE, THE BOARD UNFREEZES ITSELF ──────────────────────────────────────
      // THE ASSERTION THAT COULD NOT EXIST BEFORE S52, and the one that makes this a mechanism check
      // rather than an observation. The peer holds seat 1, so its grace is GRACE*(1+1) on top of the
      // Classic 90s; the poll runs well past that and stops the moment the seat moves, so a fix that
      // fires EARLIER than the budget is caught by half one and a fix that never fires is caught here.
      // Nobody is present to press anything · the only client left is not the one whose turn it is.
      const deadlineMs = 90_000 + 10_000
      console.log(`[host-departure] past ${(deadlineMs / 1000)}s · waiting for the clock to unfreeze it`)
      let unfroze = null
      const startedWaiting = Date.now() - 45_000        // the 45s already observed counts toward the budget
      while (Date.now() - startedWaiting < deadlineMs + 30_000) {
        const now = await read(peer)
        if (now.turnNumber !== peerBefore.turnNumber || now.currentSeat !== peerBefore.currentSeat) {
          unfroze = { ...now, afterMs: Date.now() - startedWaiting }
          break
        }
        await peer.waitForTimeout(5000)
      }

      expect(unfroze, 'THE BOARD NEVER UNFROZE. The active player is gone, the only client left cannot ' +
        'act because it is not their turn, and the turn clock did not end the turn · so the game is over ' +
        'without ending. This is the S51 measurement returning, and it means useGameSync turn timeout is ' +
        'not running in a real room (it is unit-proven in useGameSync.turntimeout.test.js, so suspect the ' +
        'wiring, not the arithmetic · Rule 103a, a composition needs a browser).').not.toBeNull()

      console.log('[host-departure] VERDICT · peer listening, host gone · held for 45s inside the budget, ' +
        `then the clock ended the absent player's turn after ~${Math.round(unfroze.afterMs / 1000)}s → ` +
        `seat ${unfroze.currentSeat}/turn ${unfroze.turnNumber} · room still ${statusAfter} ` +
        '(recoverable if the host returns)')

      // NOT A DEFECT, and worth keeping: the room is still 'playing', so a host whose phone comes back can
      // rejoin (useGameRoom rejoinable = status !== 'finished'). No fix should tidy the room away.
      expect(statusAfter, 'the room was closed · a returning phone can no longer rejoin its own game')
        .toBe('playing')
    } finally {
      if (!hostClosed) await ctxHost.close()
      await ctxPeer.close()
      await deleteRoomAsHost(hostSession, roomId)
    }
  })
})

// ── WHAT COULD NOT BE MANUFACTURED HERE, AND WHY · RECORDED WHERE THE WORK WOULD START (T3 S54) ────────
//
// THE TARGET: a peer whose local state has DIVERGED, writing a stale timeout snapshot, to prove the
// state_version predicate refuses it rather than letting it clobber a placement its author never saw.
// Identical snapshots race harmlessly (S53 proved that seam); a STALE one is the whole hazard, and the
// turn clock now ends turns on other people's behalf.
//
// IT DOES NOT WORK THROUGH THIS DOOR, measured over three live runs, and the reason generalises: EVERY
// MECHANISM THAT BLINDS A CLIENT ALSO DISTURBS THE STATE IT IS SUPPOSED TO BE HOLDING.
//   · routeWebSocket alone · intercepts only NEW connections. The peer socket is already open by the time
//     the counterweight has run, so it stayed perfectly synced (server 3 placements, peer 3). Caught by
//     the staleness assertion, which is the only reason it was not reported as a passing test.
//   · socket cut + REST GET blocked · the peer does go stale, and then falls all the way back: measured
//     phase 'lobby', writeorder version 0, 0 placements. That is a RESET client, not a diverged one, and
//     the turn clock correctly declines to run for it (gamePhase !== 'playing'). Nothing was refused
//     because nothing was ever written.
// So the honest state is: the divergence is reachable in the UNIT harness, where a stale payload and a
// stale version can be issued deliberately (useGameSync.writeorder.test.js · T3 S54), and NOT through the
// browser without a network shim faithful enough to keep the client playing while starving it. Building
// that shim is a real piece of work and should be scoped as one rather than discovered mid-session.
//
// ⚠ ONE UNEXPLAINED OBSERVATION FROM THOSE RUNS, recorded because it is cheap to state and expensive to
// lose · NOT a claim, it was seen ONCE and this harness had two defects in it: the persisted board went
// from 3 placements to 2 as state_version went 3 → 4, with only one client writing. Nothing in scoreCard
// or factoryRefill clears a hex, so game rules do not explain it. Reproduce before believing it.
// ── THE DIVERGENT-STORE RACE · THE WORST FAILURE THIS FEATURE COULD HAVE (T3 S54) ────────────────────────
//
// The turn clock now ends turns ON OTHER PEOPLE'S BEHALF. So the failure that matters is not "it does not
// fire" · it is a timeout write that CLOBBERS a placement its author never saw. I claimed in S52 that
// concurrent fires are "safe by construction" and S53 closed half of it: two clients, one accepted write.
// But that test states its own limit in the file · two renderHooks share ONE Zustand store, so it cannot
// express clients whose local state has DIVERGED, which is the only shape where a clobber is possible at
// all. Identical snapshots race harmlessly; a stale one is the whole hazard.
//
// HOW THE DIVERGENCE IS MANUFACTURED, and the first design did not work: blinding only the websocket is
// not enough, because the transport-drop path calls fetchAndSeed over REST and re-syncs the client within
// seconds (useGameSync's `system` handler → scheduleReconnect). So the peer is blinded on BOTH read paths
// while its WRITES are left alive · realtime aborted via routeWebSocket, and GET on game_sessions aborted
// while PATCH continues. That is a client that cannot learn and can still speak, which is exactly a phone
// on a dying connection.
//
// FLOW MODE for the clock: 15s turns and a 2.25s-per-seat grace, so the whole race resolves in ~25s
// instead of ~100s. It also exercises the proportional grace shipped in S52, which until now was
// unit-tested only.
//
// COST · 2 anonymous sign-ins. Nightly-class (Rule 79b).
