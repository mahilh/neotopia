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
// COST · 2 anonymous sign-ins. Nightly-class (Rule 79b). The caller-set guard costs zero and is offline.
// RUNS-NOWHERE: new this session · routed to T2 with endgame-live, comms/t3-s51-host-departure.md
// Run locally:  node scripts/with-project-env.cjs npx playwright test tests/e2e/host-departure-live.e2e.js
// ⚠ with-project-env is not optional · the shell exports another project's Supabase URL and it beats
//   .env.local in both Vite and loadEnv, so a bare `npx playwright test` drives a dead host (Rule 93).

import { test, expect } from '@playwright/test'
import { readFileSync, readdirSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { loadEnv, uniqueName, deleteRoomAsHost } from './seedHelpers'
import { runTwoHumanLobby } from './lobby'
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
    // The observation window alone is 45s and the lobby handshake is not free · the default 60s timeout
    // killed the first successful run AFTER it had printed every measurement, which reads as a failed
    // test and was a finished one.
    test.setTimeout(180_000)

    const ctxHost = await browser.newContext()
    const ctxPeer = await browser.newContext()
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
      console.log('[host-departure] host context closed · watching the peer for 45s')

      const samples = []
      for (let i = 0; i < 9; i++) {
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

      // THE SOFT-LOCK, MEASURED · this is the finding, and every number here came out of the run rather
      // than out of my head (Rule 81). The departed player owns the turn and keeps it: nine samples over
      // 45 seconds returned a byte-identical seat and turn, on a client that had just been PROVEN to be
      // listening. There is no turn timeout anywhere in the product to rescue it · turnSecondsLeft has
      // exactly two consumers, its own useState and a display prop · while the Tutorial and the Lobby
      // both promise the player "90 seconds per turn". So this is not slow, it is permanent (Rule 103c ·
      // measure past the timeout before saying permanent; 45s is already half of the 90 the UI promises
      // and nothing exists that could fire at 90).
      expect({ seat: peerAfter.currentSeat, turn: peerAfter.turnNumber },
        'TODAY: the turn never leaves the departed player. The peer cannot act (correctly · it is not ' +
        'their turn), the host cannot act (they are gone), and no timeout exists to move it on. A ' +
        'friends-and-family game ends here, silently, the first time a phone dies.')
        .toEqual({ seat: peerBefore.currentSeat, turn: peerBefore.turnNumber })

      expect(viewAfter.myTurn, 'TODAY: the peer is left showing data-my-turn="false" forever · their own ' +
        'controls are correctly disabled and will never re-enable').toBe('false')

      // NOT A DEFECT, and worth keeping when this is fixed: the room is still 'playing', so a host whose
      // phone comes back can rejoin (useGameRoom rejoinable = status !== 'finished'). Whatever fix lands
      // must not "clean up" the room and take that away.
      console.log('[host-departure] VERDICT · peer listening, host gone, turn frozen at ' +
        `seat ${peerAfter.currentSeat}/turn ${peerAfter.turnNumber} for 45s · room still ${statusAfter} ` +
        '(recoverable if the host returns) · nothing on screen mentions it')
    } finally {
      if (!hostClosed) await ctxHost.close()
      await ctxPeer.close()
      await deleteRoomAsHost(hostSession, roomId)
    }
  })
})
