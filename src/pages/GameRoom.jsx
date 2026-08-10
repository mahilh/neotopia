import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useGameStore } from '../store/gameStore'
import { ELEMENT_COLORS } from '../utils/hexUtils'
import { useAuth } from '../hooks/useAuth'
import { useGameSync } from '../hooks/useGameSync'
import { useLocalSession, clearSaved, PRACTICE_HUMAN_ID, PRACTICE_STORAGE_KEY } from '../hooks/useLocalSession'
import { useBotTurns } from '../hooks/useBotTurns'
import { useGameActions } from '../hooks/useGameActions'
import { useDrawCard } from '../hooks/useDrawCard'
import { usePatternHighlight } from '../hooks/usePatternHighlight'
import GameBoard from '../components/Board/GameBoard'
import ActionBar from '../components/ActionBar'
import FinalScore from '../components/FinalScore'
import Tutorial, { tutorialSeen } from '../components/Tutorial'
import { ScoreFlash } from '../components/ProjectCard'
import CardFrame from '../components/CardFrame'
import ActionLog from '../components/ActionLog'
import MilestoneOverlay from '../components/MilestoneOverlay'
import { ELEMENT_SOUL_METAL, elementSoulMetalLabel } from '../components/Board/ElementIcon'
import { DECK } from '../lib/projectCards'
import { PRODUCTION_TILES, shuffleArray } from '../store/gameStore'
import { TURN_TIME_LIMIT } from '../store/gameConfig'

const REGION_NAMES = ['Sacred City', 'Living Earth', 'Free Energy']
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// A card's primary element = the most common element type across its pattern · drives the CardFrame
// theme colour. Cards store element types per pattern cell, not a single top-level element.
function cardPrimaryElement(card) {
  const counts = {}
  for (const cell of card?.pattern ?? []) counts[cell.type] = (counts[cell.type] ?? 0) + 1
  let best = 'community', max = 0
  for (const [type, n] of Object.entries(counts)) if (n > max) { max = n; best = type }
  return best
}

// ── WHO PAYS FOR AN IDENTITY · the two shells below are the whole zero-sign-in guarantee ───────────
// Mahil's constraint on practice mode is that it costs ZERO anonymous sign-ins, and until now this file
// broke it on its own: useAuth() was called unconditionally at the top of the board, and useAuth mints
// an anonymous user the moment INITIAL_SESSION reports none stored. So /practice · the one path in the
// product built for somebody who arrived alone, on a rate limit that is per-IP and shared by every
// terminal and every CI runner · was spending exactly the resource it exists to survive. I stated that
// plainly as unfinished in S32 rather than claiming the constraint held; this is the half that closes it.
//
// Rules of hooks say a hook cannot be called conditionally. It does not say a COMPONENT cannot be. Two
// shells around one board is the honest shape: which one React mounts is decided by the route, once, and
// the practice shell simply has no useAuth in its tree to call. Not a flag read at runtime · an absence.
// `practice` is route-derived and constant for a mount, so the swap can never happen mid-game.
function AuthedBoard(props) {
  const { user } = useAuth()
  return <Board {...props} user={user} />
}
function LocalBoard(props) {
  // No auth hook anywhere below this line. A visitor who cannot sign in can still play.
  return <Board {...props} user={null} />
}

/**
 * @param {boolean} practice     the /practice route · a local game with no room, no session, no writes
 * @param {number}  practiceBots opponents the player chose (0-3) · 0 is free exploration
 * @param {() => void} onExitPractice  navigation out, fired AFTER the local session tears itself down
 */
export default function GameRoom({ practice = false, practiceBots = 0, onExitPractice }) {
  return practice
    ? <LocalBoard practice practiceBots={practiceBots} onExitPractice={onExitPractice} />
    : <AuthedBoard practice={false} practiceBots={0} />
}

function Board({ user, practice, practiceBots, onExitPractice }) {
  // Route-param multiplayer: /game/:roomId → real game · /game (no param) → solo dev.
  // roomId from the URL survives a refresh (free rejoin · T3) · it is the clean signal for
  // "this is a real session" · NOT useGameStore.getState().roomId (T3 never populates that).
  const { roomId } = useParams()

  // useGameSync subscribes to game_sessions + seeds the store when roomId is set (no-op when null).
  // Lives here so moves persist (pushState) and remote moves stream in for the whole /game lifetime.
  const sync = useGameSync(roomId ?? null, user?.id)

  // ── PRACTICE · settle a leftover game BEFORE the local transport can restore it ───────────────────
  // DECLARED ABOVE useLocalSession ON PURPOSE. Effects inside one component run in declaration order, so
  // this is the only place that gets to speak first.
  //
  // useLocalSession restores a saved game before dealing a new one, and that is right: a refresh
  // mid-practice must not lose the board. But it is handed only the count being asked for NOW and keeps
  // no memory of the count the saved game was dealt with, so it cannot tell a refresh apart from a
  // player who came back and chose differently. The caller knows both numbers. Without this, picking
  // "1 bot", leaving with the Back button, and picking "3 bots" hands back the old one-bot game · the
  // opponent selector would silently do nothing, which is the exact "the offer and the game disagree"
  // failure this feature was built to stop making.
  //
  // Both sources are checked because they fail differently: sessionStorage survives a reload, the store
  // survives in-app navigation, and zero-opponent practice never touches the transport at all · its own
  // guard is phase === 'lobby', so dropping the phase is what re-arms it.
  useEffect(() => {
    if (!practice) return
    const store = useGameStore.getState()
    const live = store.phase !== 'lobby' && store.players.length > 0 ? store.players.length - 1 : null
    let saved = null
    try {
      const raw = sessionStorage.getItem(PRACTICE_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : null
      if (Array.isArray(parsed?.players) && parsed.players.length > 0) saved = parsed.players.length - 1
    } catch { /* storage blocked · then there is nothing persisted to disagree with */ }
    const stale = (live != null && live !== practiceBots) || (saved != null && saved !== practiceBots)
    if (!stale) return
    clearSaved()
    store.setPhase('lobby')
  }, [practice, practiceBots])

  // THE LOCAL TRANSPORT (T3 S32) · returns useGameSync's shape, so the board below cannot tell which one
  // it is holding · that is the point of it. Active only from one bot upward: useLocalSession clamps to
  // MIN_BOTS=1, so asking it for zero opponents would deal a bot the player did not ask for. Free
  // exploration therefore stays on this file's own local-init path below, which already worked and is
  // live. (Written to comms for T3: MIN_BOTS=0 would let both cases share one transport and give free
  // exploration refresh-survival for free. Their constant, their call · not mine to change.)
  // `rearming` is the one commit in which the local transport is deliberately switched OFF so that it
  // will deal a NEW table on the next one · see restartPractice below. useLocalSession documents itself
  // as "inert in every observable way while active is false", and its own init effect resets its
  // one-game latch on the way down, so this uses the hook exactly as written rather than reaching into it.
  const [rearming, setRearming] = useState(false)
  const local = useLocalSession(practice && practiceBots >= 1 && !rearming, { bots: practiceBots })

  // One handle for both worlds. Every consumer below takes this, never `sync` directly, so a practice
  // game persists to its tab and a real game persists to Postgres through identical call sites.
  const transport = practice ? local : sync

  // Bot seats play themselves. Mounted UNCONDITIONALLY, exactly as its author specified: it is inert
  // until some seat carries isBot, and initGame is the only writer of that flag, which only the local
  // transport ever sets. A second gate here (`enabled: practice`) would be a second contract answering
  // the same question, which is the mistake this session already found once in this very feature.
  useBotTurns()

  // ── LEAVING PRACTICE · explicit, because a route change does not do it ────────────────────────────
  // T3's note, honoured: navigating away leaves the store holding a finished practice game at
  // phase 'playing', so nothing downstream re-arms and the next visit stares at the old board. Without
  // a teardown, "replayable indefinitely" is false the second time · re-entering with the same opponent
  // count would resume the same game forever, with no way to ask for a new one.
  //
  // leavingRef is not defensive clutter: endPractice drops the store to 'lobby', and the local-init
  // effect below now watches `phase` precisely so it can re-arm · which means without this latch, Leave
  // would tear the game down and instantly deal a fresh one in the same commit, before the navigation
  // lands. The latch is never cleared because the component is going away.
  const leavingRef = useRef(false)
  const endPractice = local.endPractice
  const leavePractice = useCallback(() => {
    leavingRef.current = true
    // Safe for zero opponents too · endPractice carries no `active` guard, it resets unconditionally.
    endPractice?.()
    clearSaved()
    onExitPractice?.()
  }, [endPractice, onExitPractice])

  // ── PLAYING AGAIN, WITHOUT LEAVING (T1 S36) ───────────────────────────────────────────────────────
  // "Start New Civilization" on the end screen sent a PRACTICE player to '/lobby' · the multiplayer
  // screen, which needs the anonymous sign-in that practice mode exists to survive without, and which
  // never ran the teardown. In practice that button now means what it says to the person reading it:
  // another practice game, same opponents, right here.
  //
  // NO leavingRef here · that latch exists to stop the solo-init effect dealing a board on the way out,
  // and this is the opposite intention. Both paths back to a fresh table are already built and neither
  // is mine to duplicate:
  //   · zero opponents · endPractice drops the store to 'lobby' and the local-init effect below watches
  //     `phase`, so it re-arms on its own. `rearming` is a no-op there (the transport is already off).
  //   · one or more · the transport owns that table, and its init effect keys on `active`, not on the
  //     store. Switching it off for exactly one commit is what makes it deal again.
  // endPractice already clears the snapshot itself, so the clearSaved in the effect below is a SECOND
  // one, and it is deliberate rather than copied: the persistence subscription stays live until React
  // commits the unsubscribe, so any store write landing in that window is saved · and endPractice's
  // blank slate has a non-empty players array, which is precisely what readSaved() will happily restore
  // instead of dealing. The write I have in mind is a bot move timer that was already in flight when
  // the game ended. STATED AS UNPROVEN: removing this second clear leaves every test in
  // GameRoom.practiceexit green, because the driver is mocked out there and nothing else writes. It
  // costs one storage call to close a window I can reason about but have not reproduced.
  const restartPractice = useCallback(() => {
    endPractice?.()
    setRearming(true)
  }, [endPractice])
  useEffect(() => {
    if (!rearming) return
    clearSaved()
    setRearming(false)
  }, [rearming])

  // Atomic seat-scoped draw (T3 S22 · migration 011 · draw_card_for_seat). The whole-state snapshot
  // (pushState) lets two simultaneous draws clobber each other (17f5931 · last-write-wins · a draw is
  // silently LOST). This RPC serializes concurrent draws on a FOR UPDATE row lock and writes back
  // game_sessions.state, so the drawn card lands in every client's hand via useGameSync's
  // postgres_changes re-seed · no local store mutation here (the DB row update IS the sync · Rule 16).
  const { drawCard: drawViaRpc, isDrawing: isDrawingCard, error: drawError } = useDrawCard()

  const [scoreFlash, setScoreFlash] = useState(null) // { card, regionName } · the score story moment
  // First-turn onboarding (T1 S8). Shown once ever per browser (localStorage) · the first playtest
  // never discovered "place an element". We gate on isMyTurn + phase below, NOT on turnNumber: turns
  // may count per-player-turn, so a turnNumber<=1 gate would skip the 2nd player's first turn entirely.
  const [showTutorial, setShowTutorial] = useState(() => !tutorialSeen())

  // Action log · the shared game memory rendered left of the board (T1 S15). A monotonic id keeps React
  // keys stable as entries scroll; the turn is captured per entry so the log fades older lines by age.
  const [actionLog, setActionLog] = useState([])
  const logIdRef = useRef(0)
  const addLogEntry = (text, color = 'rgba(255,255,255,0.6)') => {
    const turn = useGameStore.getState().turnNumber
    setActionLog(prev => [...prev, { id: logIdRef.current++, text, color, turn }].slice(-30))
  }

  // Subscribe to individual slices · avoids a full re-render on every state change.
  const phase         = useGameStore(s => s.phase)
  const actionsLeft   = useGameStore(s => s.actionsRemaining)
  const currentSeat   = useGameStore(s => s.currentSeat)
  const turnNumber    = useGameStore(s => s.turnNumber)
  const turnTimeRemaining = useGameStore(s => s.turnTimeRemaining)
  const theOffer      = useGameStore(s => s.theOffer)
  const factories     = useGameStore(s => s.factories)
  const regions       = useGameStore(s => s.regions)
  const players       = useGameStore(s => s.players)
  const currentPlayer = players.find(p => p.seat === currentSeat)

  // This client's seat · derived from the synced roster by matching our auth id (no need to thread
  // seat through navigation · it also restores correctly on rejoin-after-refresh). null in solo.
  // In practice there is no auth id to match, so the human is found by the id the local transport gave
  // them. This is NOT cosmetic: useGameActions reads `isMyTurn = mySeat == null || currentSeat === mySeat`,
  // so leaving mySeat null with bots at the table would let the player act on a BOT's turn · take its
  // elements, spend its actions, score into its regions. A one-player local game was fine with null
  // because seat 0 was always the current seat; the moment a second seat exists, null stops meaning
  // "solo" and starts meaning "no turn gate at all".
  const mySeat = useMemo(
    () => (practice
      ? players.find(p => p.userId === PRACTICE_HUMAN_ID)?.seat ?? null
      : players.find(p => p.userId && p.userId === user?.id)?.seat ?? null),
    [practice, players, user?.id],
  )

  // Dual-score view (T1 S13) · the "my" column follows my seat · in solo dev mySeat is null, so fall back
  // to the active player · opponent = the other SEATED real player (absent in solo → single column · no crash).
  const myPlayer = players.find(p => p.seat === mySeat) ?? currentPlayer
  const opponent = players.find(p => p.userId && p.seat != null && p.seat !== myPlayer?.seat)

  // Local per-second turn countdown · DISPLAY ONLY. The store holds no clock (rule 32 · the reducer only
  // RESETS turnTimeRemaining to TURN_TIME_LIMIT each turn), so we tick a local copy down for a live
  // readout and re-anchor it whenever the turn changes (currentSeat/turnNumber) or the synced value
  // updates. Never writes the store · forward-compatible if T2 later drives the decrement via sync (T1 S12).
  const [turnSecondsLeft, setTurnSecondsLeft] = useState(turnTimeRemaining)
  useEffect(() => {
    setTurnSecondsLeft(turnTimeRemaining)
    if (phase !== 'playing') return
    const id = setInterval(() => setTurnSecondsLeft(s => Math.max(0, s - 1)), 1000)
    return () => clearInterval(id)
  }, [turnTimeRemaining, currentSeat, turnNumber, phase])

  // LOCAL-INIT · the one-player board. Serves /game (solo dev) and practice with zero opponents, which
  // is a complete experience and the only one a rate-limited visitor can always reach.
  // Gated on the route roomId per T3 · never inits a local game over a real session.
  //
  // The old `initialized` useState is gone. The phase guard was always the real one (initGame sets
  // phase='playing', so this cannot loop), and the extra latch actively prevented re-arming: after the
  // stale-game effect above drops the store to 'lobby', a component that had already initialised once
  // would sit in front of an empty board forever. Depending on the subscribed `phase` slice instead
  // means the re-arm is what re-runs this.
  useEffect(() => {
    if (roomId) return
    if (leavingRef.current) return            // on the way out · do not deal a board nobody asked for
    if (practice && practiceBots >= 1) return // the local transport deals that table, not this
    if (phase !== 'lobby') return
    useGameStore.getState().initGame(
      // Same identity the transport uses, so mySeat resolves the same way at either table.
      [practice ? { userId: PRACTICE_HUMAN_ID, username: 'You' } : { userId: 'dev-1', username: 'Builder' }],
      shuffleArray([...DECK]),
      shuffleArray([...PRODUCTION_TILES]),
    )
  }, [roomId, practice, practiceBots, phase])

  // DEV-only · force the end-game civilization record without playing all 56 cards.
  // Cmd+Shift+E sets the real terminal phase ('scoring') · stripped from production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const onKey = (e) => {
      if (e.metaKey && e.shiftKey && e.code === 'KeyE') {
        e.preventDefault()
        useGameStore.getState().setPhase('scoring')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // DEV-only · expose the live store on window for state-driven visual testing (milestones, phases).
  // The SAME instance the app uses (not a fresh dynamic-import copy) · stripped from production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return
    window.__neotopia_store = useGameStore
    return () => { if (window.__neotopia_store === useGameStore) delete window.__neotopia_store }
  }, [])

  const {
    selectedFactory, selectedElement, selectedRegion,
    validTargets, patternHighlight, buildableMatches, uiPhase, isMyTurn,
    handleFactoryClick, handleElementSelect, handleRegionSelect,
    handleHexClick, handleCardScore, handleDrawCard, handleEndTurn,
  } = useGameActions({ sync: transport, mySeat })

  const factory = factories.find(f => f.id === selectedFactory)

  // ── THE BOARD ANSWERS THE CLICK (T1 S30) ────────────────────────────────────────────────────────
  // Measured this session: after clicking a factory, NOTHING on the board changed except a ring on the
  // factory itself, and the panel that did respond was 381px away at a 375px viewport (651px at 1280).
  // The player's eye is on the board · they just clicked there · so "nothing happened" is the honest
  // reading of the screen, and the old tutorial then sent them to click empty hexes, which do nothing.
  // So: the moment a factory is picked, show every hex that factory can actually reach, in the regions
  // it borders. This is a PREVIEW, drawn dashed and distinct from the solid pulsing ring that means
  // "click me now" · promising a click that does not work is the same lie the old copy told.
  //
  // aimedRegion is what keeps it from being a lie: pointing at a previewed hex chooses that REGION, so
  // the board is answerable rather than decorative. It never places anything · the commit is still the
  // player's own click on a lit hex once the element is chosen.
  const [aimedRegion, setAimedRegion] = useState(null)
  const isChoosing = uiPhase === 'factorySelected' || uiPhase === 'elementSelected'
  const reachable = useMemo(() => {
    if (!isChoosing || selectedFactory === null) return { regions: [], targets: [] }
    const f = factories.find(x => x.id === selectedFactory)
    if (!f) return { regions: [], targets: [] }
    const store = useGameStore.getState()
    // Once aimed, narrow the preview to the one region · the picture matches the decision made so far.
    const shown = aimedRegion != null && f.betweenRegions.includes(aimedRegion) ? [aimedRegion] : f.betweenRegions
    const targets = shown.flatMap(rid =>
      (store.getValidPlacements?.(selectedFactory, rid) ?? []).map(t => ({ ...t, regionId: rid })))
    return { regions: f.betweenRegions, targets }
    // `regions` is in the deps because the preview depends on what is already on the board.
  }, [isChoosing, selectedFactory, factories, regions, aimedRegion])

  // Aim → region, one hop. handleRegionSelect refuses until an element exists (its own guard, T2's
  // lane), so the aim is held until that is true and then applied · the lit hexes appear on the same
  // click that picks the element instead of costing a second trip to the panel.
  useEffect(() => {
    if (aimedRegion == null) return
    if (uiPhase === 'idle' || uiPhase === 'scorePending') { setAimedRegion(null); return }
    // Re-check the border rule at the moment of use (Rule 64): a different factory may have been picked
    // since the aim was taken, and handleRegionSelect would happily select a region it cannot serve,
    // leaving the player at 'regionSelected' with zero lit hexes · a worse dead end than the one fixed.
    if (uiPhase === 'elementSelected' && reachable.regions.includes(aimedRegion)) handleRegionSelect(aimedRegion)
  }, [aimedRegion, uiPhase, reachable.regions, handleRegionSelect])

  // Below 600px the sidebar is a 240px strip UNDER the board (index.css), and it scrolls. The step that
  // just became live is inserted at its top, so if the strip is scrolled at all the new choice appears
  // above the fold of a panel the player is not looking at. Bring it into view when it becomes the
  // decision. `block:'nearest'` so it never scrolls when it is already visible (the desktop case).
  const stepPanelRef = useRef(null)
  useEffect(() => {
    if (!isChoosing) return
    stepPanelRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [isChoosing, uiPhase])

  // Draw a card from The Offer. In a REAL authenticated room we route through the atomic RPC so
  // concurrent draws can't clobber (the bug T2 flagged · 17f5931); the card returns and also lands in
  // hand when the RPC's game_sessions.state write streams back via postgres_changes. The RPC needs the
  // session UUID (sync.sessionId · NOT roomId, which is room_id) and enforces seat ownership + auth
  // server-side. Solo dev has no auth/session (sessionId is null · the RPC would reject), so it keeps the
  // local deterministic draw path · this also preserves the bot harness and the existing unit tests.
  // Practice can never satisfy this: there is no roomId and useLocalSession returns sessionId null on
  // purpose, so the RPC path is unreachable and the local deterministic draw is used instead.
  const isRealRoom = !!(roomId && transport?.sessionId && mySeat != null)
  const onDrawOffer = async (i) => {
    const card = theOffer[i]
    if (!card) return
    if (isRealRoom) {
      const { card: drawn, error } = await drawViaRpc({
        sessionId: sync.sessionId, seat: mySeat, source: 'offer', cardIndex: i,
      })
      // error is surfaced inline under The Offer (drawError) · never tear down the turn (do not crash).
      if (!error) addLogEntry(`drew ${drawn?.name ?? card.name}`)
    } else if (handleDrawCard('offer', i)) {
      addLogEntry(`drew ${card.name}`)
    }
  }

  // Near-miss psychology · usePatternHighlight (T2) computes per region · merge all 3.
  // Only nudge "place here" while the player can still act (no actions = no placement).
  const ph0 = usePatternHighlight(0)
  const ph1 = usePatternHighlight(1)
  const ph2 = usePatternHighlight(2)
  const keyToQR = (k) => { const [q, r] = k.split(',').map(Number); return { q, r } }
  const partialHighlight = useMemo(
    () => (actionsLeft > 0 ? [ph0, ph1, ph2].flatMap(ph => [...ph.partialKeys].map(keyToQR)) : []),
    [ph0, ph1, ph2, actionsLeft],
  )
  const completionCandidates = useMemo(
    () => (actionsLeft > 0 ? [ph0, ph1, ph2].flatMap(ph => ph.completionCandidates.map(c => keyToQR(c.missingKey))) : []),
    [ph0, ph1, ph2, actionsLeft],
  )

  // ── AUTO-END-TURN (T1 S35) ────────────────────────────────────────────────────────────────────
  // "No actions left · end your turn" beside an End Turn button is a required click that
  // communicates nothing: the game already knows the turn is over and is asking the player to agree.
  //
  // THE LANE, since it is not obvious: the turn-end ACTION is T2's (useGameActions.handleEndTurn),
  // but the decision to end is T1's and always has been · gameConfig.js says so in its header, from
  // T2 S9. This calls the existing handler and touches nothing in their lane.
  //
  // WHAT MAKES THIS DANGEROUS IS NOT THE TIMING. Scoring a card costs NO action · tryScoreCard
  // deliberately spends none, because a district is the consequence of a placement rather than an
  // action of its own. So a player whose THIRD action completes a pattern is sitting at
  // actionsRemaining 0 with a district still to build, and ending the turn there silently destroys
  // it. The gate is therefore not "out of actions" but "out of actions AND nothing left to do":
  // uiPhase idle, which reset() only reaches once a pattern has been scored or there never was one.
  //
  // Held back while the score story is on screen. A turn that changes underneath the flash takes
  // away the one moment that tells a player what they just did.
  //
  // NOTHING ELSE IS SPENDABLE AT ZERO ACTIONS, and that is load-bearing rather than incidental: the
  // store has useBonus and 'Automation · +1 action this turn', but no control anywhere calls it, so
  // a bonus token cannot buy an action today (they are worth 3 points each unspent, which is the
  // only thing they currently do). IF a bonus is ever wired to a button, this gate needs a
  // `bonusTokens.length === 0` term or it will end the turn out from under the player using it.
  // THE DEPENDENCY LIST IS THE FEATURE, and getting it wrong killed this outright the first time.
  // `handleEndTurn` is a NEW FUNCTION EVERY RENDER: it is a useCallback on `persist`, which is a
  // useCallback on `sync`, and the practice transport returns a fresh object literal from every
  // render (useLocalSession is not memoised). Listing it as a dep therefore re-runs this effect on
  // every render · and the turn countdown ticks a state update once a SECOND, which is less than
  // AUTO_END_MS, so the cleanup cancelled the pending end before it could ever fire. The turn would
  // simply never have ended, in every real game, with nothing in the console. Same shape as the S33
  // bot deadlock: a timer cancelled by its own effect re-running.
  // So the handler is held in a ref and the deps are values only. Flagged to T3 · an unmemoised
  // transport object is a footgun for every consumer, not just this one.
  const AUTO_END_MS = 1100
  const autoEndKeyRef = useRef(null)
  const endTurnRef = useRef(handleEndTurn)
  endTurnRef.current = handleEndTurn
  const logRef = useRef(addLogEntry)
  logRef.current = addLogEntry
  const canAutoEnd =
    phase === 'playing' && isMyTurn && actionsLeft === 0 &&
    uiPhase === 'idle' && buildableMatches.length === 0 && !scoreFlash
  useEffect(() => {
    if (!canAutoEnd) return
    // Keyed on the TURN, not on a boolean · a re-render inside the window must not queue a second
    // end, and a seat must never be ended twice.
    const key = `${currentSeat}:${turnNumber}`
    if (autoEndKeyRef.current === key) return
    const id = setTimeout(() => {
      autoEndKeyRef.current = key
      endTurnRef.current()
      const st = useGameStore.getState()
      logRef.current(`Turn ${st.turnNumber} · ${st.players.find(p => p.seat === st.currentSeat)?.username ?? ''}`, 'rgba(255,255,255,0.4)')
    }, AUTO_END_MS)
    return () => clearTimeout(id)
  }, [canAutoEnd, currentSeat, turnNumber])

  // Persistent "what to do next" line (colonist.io pattern). The first playtest reached turn 17 with an
  // empty board because nothing ever told the players what their options were · this never lets that happen.
  const instruction = (() => {
    if (!isMyTurn) return `Waiting for ${currentPlayer?.username ?? 'the other player'}`
    // SCORING OUTRANKS "out of actions", and the old order had it the other way round. Because
    // scoring costs no action, a completed pattern is still live at zero · so the line was telling a
    // player to end their turn while a district was sitting there waiting to be built. That is the
    // one moment in the game where the instruction line can cost real points.
    if (uiPhase === 'scorePending') return 'Pattern complete · select a glowing card to score'
    if (actionsLeft <= 0) return 'No actions left · ending your turn'
    switch (uiPhase) {
      case 'factorySelected': return aimedRegion != null
        ? `Pick an element · it goes into ${REGION_NAMES[aimedRegion]}`
        : 'Pick an element · the dashed hexes show where it can go'
      case 'elementSelected':  return 'Choose a region to place into'
      case 'regionSelected':   return 'Click a highlighted hex to place the element'
      default:                 return 'Click a factory to take an element · or draw a card from the Offer'
    }
  })()
  // Pulse the factories to invite the first action · only on your turn, with actions left, before a pick.
  const factoriesPulse = isMyTurn && actionsLeft > 0 && selectedFactory === null

  // The header's own exit, which is the right home for it while there is a board to leave. Once the
  // game ends the FinalScore overlay owns the screen and carries the exit itself.
  const headerExit = practice && phase !== 'scoring'

  // Instruction-bar theming (T1 S13) · echo the SELECTED element's colour while the player chooses where
  // to place, confirming what they just picked · scorePending stays green · only themes on your own turn.
  const instructionColor =
    uiPhase === 'scorePending' ? '#1DC864'
    : isMyTurn && selectedElement && (uiPhase === 'elementSelected' || uiPhase === 'regionSelected')
      ? (ELEMENT_COLORS[selectedElement] ?? 'rgba(255,255,255,0.5)')
    : 'rgba(255,255,255,0.5)'
  const instructionWeight = uiPhase === 'scorePending' ? 600 : uiPhase === 'regionSelected' ? 500 : 400

  // Multiplayer loading gate (AFTER all hooks · Rules of Hooks): in a real room, wait for
  // useGameSync to seed the store before rendering the board. Solo (no roomId) skips this.
  // 'scoring' is the end-game phase · let it through so the FinalScore overlay can render.
  if (roomId && phase !== 'playing' && phase !== 'scoring') {
    return (
      <div style={{ height: '100vh', background: '#0a0a0f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, letterSpacing: 1 }}>Connecting to the board…</p>
      </div>
    )
  }

  return (
    <div
      // Persistent, turn-sensitive attributes the bot/E2E can waitForSelector on (no isVisible timeout
      // race against the DB-sync render · T1 S11). data-my-turn flips as soon as currentSeat syncs.
      data-game-phase={phase}
      data-my-turn={isMyTurn ? 'true' : 'false'}
      data-ui-phase={uiPhase}
      // Observable seam for the practice path · 0 today for every route, and the number the player
      // actually asked for once bot seats exist. A test can assert the request ARRIVED here without
      // waiting on the half that consumes it.
      data-practice-bots={practiceBots}
      style={{ height: '100vh', overflow: 'hidden', background: '#0a0a0f', display: 'flex', flexDirection: 'column' }}
    >

      {/* FINAL SCORE · the civilization record · overlays everything once the game ends (phase 'scoring') */}
      {/* mySeat lets FinalScore record THIS client's own districts to the real Global Index (no cross-client over-count). */}
      {/* `practice` is load-bearing, not decorative · see FinalScore's recordCivilizationContribution. */}
      {/* The practice exit and the practice restart are handed DOWN, because this overlay covers the
          header that used to carry them (T1 S36 · T3's measurement) · FinalScore.jsx CTA block. */}
      {phase === 'scoring' && (
        <FinalScore
          players={players} mySeat={mySeat} sync={transport} roomId={roomId} regions={regions} practice={practice}
          onLeavePractice={practice ? leavePractice : null}
          onPlayAgain={practice ? restartPractice : null}
        />
      )}

      {/* FIRST-GAME TUTORIAL · once ever per browser · shows for BOTH players the moment the game starts
          (NOT gated on isMyTurn · S8's isMyTurn gate meant the joining player never saw it until their
          first turn · the waiting player should learn the rules while the host moves · T1 S10). */}
      {showTutorial && phase === 'playing' && (
        <Tutorial onDismiss={() => setShowTutorial(false)} />
      )}

      {/* SCORE FLASH · the civilization "story moment" after a card is scored */}
      {scoreFlash && (
        <ScoreFlash
          card={scoreFlash.card}
          regionName={scoreFlash.regionName}
          onDone={() => setScoreFlash(null)}
        />
      )}

      {/* HEADER
          GRID, not an absolutely-centred overlay (T1 S30). The instruction used to be positioned at
          left:50% with translateX(-50%) over the flow, so it OVERLAPPED the wordmark at every width up
          to 600px (measured: 43px of collision at 320, 31px at 375, 36px at 600) and was truncated by
          its own maxWidth:58% + nowrap at all of them. The single line whose whole job is "always tell
          the player what to do next" was unreadable on a phone. `1fr auto 1fr` keeps it optically
          centred on the viewport (the empty third column mirrors the first) while keeping it IN the
          flow, so it can never sit on top of its neighbours · index.css drops it to its own row below
          720px, where it wraps instead of clipping. */}
      <header className="game-header" style={{
        display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center',
        minHeight: 56, borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '0 20px', gap: 12, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 0 }}>
          <span style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 500, letterSpacing: 3, fontSize: 13, whiteSpace: 'nowrap' }}>
            NEOTOPIA
          </span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            Turn {turnNumber}
          </span>
          {/* Said out loud rather than left for the player to infer · nothing here reaches the
              civilization record, and a player who has just built something deserves to know that
              before the final screen tells them, not after. */}
          {practice && (
            <span data-testid="practice-badge" style={{
              color: 'rgba(200,148,64,0.7)', fontSize: 11, letterSpacing: 1.2,
              textTransform: 'uppercase', whiteSpace: 'nowrap',
            }}>
              Practice
            </span>
          )}
        </div>
        {/* Persistent instruction · always tells the player what to do next (colonist.io). */}
        <div data-testid="instruction" className="game-instruction" style={{
          fontSize: 13, letterSpacing: 0.3, textAlign: 'center', pointerEvents: 'none',
          minWidth: 0, overflowWrap: 'anywhere',
          color: instructionColor,
          transition: 'color 0.25s ease',
          fontWeight: instructionWeight,
        }}>
          {instruction}
        </div>
        {/* Third column mirrors the first so the instruction stays optically centred · `1fr auto 1fr`
            sizes the outer columns equally whatever is in them, so putting a control here costs the
            centring nothing. Empty (and hidden from the a11y tree) outside practice. */}
        {/* At 'scoring' this control moves INTO the FinalScore overlay, which is fixed/inset-0/z-300 and
            paints over this header · leaving it here would keep a second `leave-practice` in the
            document that no player can click, which is worse than one that moved. One at a time. */}
        <div aria-hidden={headerExit ? undefined : 'true'} style={{ display: 'flex', justifyContent: 'flex-end' }}>
          {headerExit && (
            <button
              data-testid="leave-practice"
              onClick={leavePractice}
              style={{
                minHeight: 44, padding: '0 14px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.14)', background: 'transparent',
                color: 'rgba(255,255,255,0.6)', fontSize: 12, letterSpacing: 0.4, whiteSpace: 'nowrap',
              }}
            >
              Leave practice
            </button>
          )}
        </div>
        {/* Actions counter, turn status, and End Turn now live in the bottom ActionBar. */}
      </header>

      {/* MAIN */}
      <div className="game-main" style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

        {/* BOARD */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 0, minWidth: 0, position: 'relative' }}>
          <GameBoard
            regions={regions}
            factories={factories}
            validTargets={validTargets}
            patternHighlight={patternHighlight}
            partialHighlight={partialHighlight}
            completionCandidates={completionCandidates}
            selectedFactory={selectedFactory}
            factoriesPulse={factoriesPulse}
            reachableTargets={reachable.targets}
            reachableRegions={reachable.regions}
            regionScores={currentPlayer?.scores ?? []}
            onHexClick={(q, r, rid) => {
              // Before an element is chosen the board is a preview, not a placement surface. A click on
              // a previewed hex takes aim at its region · a click anywhere else is still inert, which is
              // honest, because those hexes are not drawn as reachable.
              if (isChoosing) {
                if (reachable.targets.some(t => t.q === q && t.r === r && t.regionId === rid)) setAimedRegion(rid)
                return
              }
              const placed = handleHexClick(q, r, rid)
              if (placed) addLogEntry(`placed ${cap(placed.element)} in ${REGION_NAMES[placed.regionId]}`, ELEMENT_COLORS[placed.element])
            }}
            onFactoryClick={(id) => { setAimedRegion(null); handleFactoryClick(id) }}
          />
          <ActionLog entries={actionLog} />
          {/* Sacred milestone celebration · covers the board for 2500ms when a total crosses 7/9/13/18/27/36 */}
          <MilestoneOverlay />
        </div>

        {/* SIDEBAR */}
        <aside className="game-sidebar" style={{
          width: 288, borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', padding: 16, gap: 14, overflowY: 'auto', flexShrink: 0,
        }}>

          {/* STEP 2: element type buttons (factory selected) */}
          {uiPhase === 'factorySelected' && factory && (
            <div ref={stepPanelRef}>
              {/* Soul-metal lore reveals under each element on hover/focus (PLATO_BOOKS · Pillar 1) ·
                  grows within the flow so the sidebar's overflow never clips it (Rule 4: minHeight 44px). */}
              <style>{`
                .neo-soul-tip { max-height: 0; opacity: 0; overflow: hidden; transition: max-height 0.2s ease, opacity 0.2s ease; }
                .neo-soul-btn:hover .neo-soul-tip, .neo-soul-btn:focus-visible .neo-soul-tip { max-height: 20px; opacity: 1; }
                @media (prefers-reduced-motion: reduce) { .neo-soul-tip { transition: none; } }
              `}</style>
              <div style={sectionLabel}>Select element</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {factory.elements.filter(el => el.count > 0).map(el => {
                  const soul = ELEMENT_SOUL_METAL[el.type]
                  return (
                  <button key={el.type}
                    className="neo-soul-btn"
                    data-testid="element-btn"
                    data-element={el.type}
                    title={elementSoulMetalLabel(el.type) ?? undefined}
                    onClick={() => handleElementSelect(el.type)}
                    style={{
                      minHeight: 44, padding: '6px 14px', borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: selectedElement === el.type ? 'rgba(255,255,255,0.1)' : 'transparent',
                      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
                    }}
                  >
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: ELEMENT_COLORS[el.type], flexShrink: 0 }} />
                    <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0 }}>
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, textTransform: 'capitalize' }}>
                        {el.type}
                      </span>
                      {soul && (
                        <span className="neo-soul-tip" style={{
                          fontSize: 10, color: 'rgba(200,148,64,0.85)', letterSpacing: 0.3, whiteSpace: 'nowrap',
                        }}>
                          {soul.metal} · {soul.virtue} · {soul.district}
                        </span>
                      )}
                    </span>
                    <span style={{
                      marginLeft: 'auto', color: 'rgba(255,255,255,0.5)',
                      fontSize: 14, fontVariantNumeric: 'tabular-nums', fontWeight: 600,
                    }}>
                      ×{el.count}
                    </span>
                  </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* STEP 3: region buttons (element selected) */}
          {(uiPhase === 'elementSelected' || uiPhase === 'regionSelected') && factory && (
            <div ref={uiPhase === 'elementSelected' ? stepPanelRef : null}>
              <div style={sectionLabel}>Place into region</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {factory.betweenRegions.map(rid => {
                  const regionNames = ['Sacred City', 'Living Earth', 'Free Energy']
                  const regionColors = ['#7F77DD', '#1D9E75', '#E24B4A']
                  return (
                    <button key={rid}
                      data-testid="region-btn"
                      data-region={rid}
                      onClick={() => handleRegionSelect(rid)}
                      style={{
                        height: 44, padding: '0 14px', borderRadius: 8, cursor: 'pointer',
                        border: selectedRegion === rid
                          ? `1px solid ${regionColors[rid]}`
                          : '1px solid rgba(255,255,255,0.12)',
                        background: selectedRegion === rid ? `${regionColors[rid]}22` : 'transparent',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: regionColors[rid] }} />
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{regionNames[rid]}</span>
                    </button>
                  )
                })}
              </div>
              {uiPhase === 'regionSelected' && (
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, marginTop: 8 }}>
                  Click a highlighted hex on the board
                </p>
              )}
            </div>
          )}

          {/* THE OFFER */}
          <div>
            <div style={sectionLabel}>The Offer</div>
            <div data-offer style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {theOffer.length === 0 && (
                <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12, padding: '8px 0' }}>Deck empty</div>
              )}
              {theOffer.map((card, i) => {
                // isDrawingCard disables every offer card during the RPC round-trip · prevents a
                // double-fire and keeps the affordance honest (CardFrame size is unchanged · 44px · Rule 4).
                const disabled = actionsLeft === 0 || !isMyTurn || isDrawingCard
                return (
                  <CardFrame key={card.id} size="hand" testid="card-offer"
                    card={{ ...card, element: cardPrimaryElement(card) }}
                    onClick={disabled ? undefined : () => onDrawOffer(i)}
                  />
                )
              })}
            </div>
            {/* Draw status · mid-flight hint or the RPC's own refusal message (e.g. 'deck is empty' ·
                'not your turn') · inline + non-blocking so a failed draw never crashes the turn. */}
            {(isDrawingCard || drawError) && (
              <div data-testid="draw-status" style={{
                marginTop: 6, textAlign: 'center', fontSize: 11, letterSpacing: 0.3,
                color: drawError ? 'rgba(226,75,74,0.9)' : 'rgba(255,255,255,0.4)',
              }}>
                {isDrawingCard ? 'Drawing…' : drawError}
              </div>
            )}
          </div>

          {/* HAND */}
          <div>
            <div style={sectionLabel}>Hand · {currentPlayer?.hand?.length ?? 0}</div>
            <div data-hand style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
              {currentPlayer?.hand?.map(card => {
                const isScoreable = uiPhase === 'scorePending' && buildableMatches.some(m => m.cardId === card.id)
                return (
                  <CardFrame key={card.id} size="hand" testid="card-hand" isSelected={isScoreable}
                    card={{ ...card, element: cardPrimaryElement(card) }}
                    onClick={isScoreable ? () => {
                      const scored = handleCardScore(card.id)
                      if (scored?.card) {
                        setScoreFlash({ card: scored.card, regionName: REGION_NAMES[scored.regionId] })
                        addLogEntry(`scored ${scored.card.name}: +${scored.card.points}`, '#C89440')
                      }
                    } : undefined}
                  />
                )
              })}
            </div>
          </div>

          {/* SCORE · my column vs opponent (single column in solo · no <table>, flexbox per touch-gate) */}
          {myPlayer && (
            <div className="score-panel">
              <div style={sectionLabel}>Score</div>
              {opponent && (
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 0 4px' }}>
                  <span style={{ flex: 1 }} />
                  <span style={{ width: 44, textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.6)', letterSpacing: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(myPlayer.username ?? 'You').slice(0, 8)}
                  </span>
                  <span style={{ width: 44, textAlign: 'right', fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {(opponent.username ?? 'Rival').slice(0, 8)}
                  </span>
                </div>
              )}
              {['Sacred City', 'Living Earth', 'Free Energy'].map((name, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center',
                  padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span style={{ flex: 1, color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>{name}</span>
                  <span style={{ width: 44, textAlign: 'right', color: 'white', fontWeight: 700, fontVariantNumeric: 'tabular-nums', fontSize: 16 }}>
                    {myPlayer.scores?.[i] ?? 0}
                  </span>
                  {opponent && (
                    <span style={{ width: 44, textAlign: 'right', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', fontSize: 14 }}>
                      {opponent.scores?.[i] ?? 0}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* ACTION BAR · turn status · action dots · bonus tokens · End Turn */}
      <ActionBar
        playerName={currentPlayer?.username ?? 'Builder'}
        mySeat={mySeat}
        isMyTurn={isMyTurn}
        actionsRemaining={actionsLeft}
        bonusTokens={currentPlayer?.bonusTokens ?? []}
        turnTimeRemaining={turnSecondsLeft}
        turnTimeLimit={TURN_TIME_LIMIT}
        onEndTurn={() => {
          handleEndTurn()
          const st = useGameStore.getState()
          addLogEntry(`Turn ${st.turnNumber} · ${st.players.find(p => p.seat === st.currentSeat)?.username ?? ''}`, 'rgba(255,255,255,0.4)')
        }}
      />
    </div>
  )
}

const sectionLabel = {
  // 12px floor on the sidebar wayfinding labels (Select element · Place into region · Offer · Hand ·
  // Score). game-ux.e2e's font check is soft/informational, but these are functional labels with room
  // to grow · the smallest standalone text gets the bump (CardFrame card-face stays per T3 · T1 S12).
  color: 'rgba(255,255,255,0.35)', fontSize: 12, letterSpacing: 2.5,
  textTransform: 'uppercase', marginBottom: 8, fontWeight: 500,
}
