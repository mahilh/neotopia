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
import { playSound, installSoundUnlock, isMuted, setMuted, subscribeMuted } from '../utils/sound'

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
  // Length, not the array · a draw from an empty deck still SPENDS the action (gameStore.drawCard
  // shifts undefined and decrements anyway), so "is a draw a real move" needs this number.
  const deckCount     = useGameStore(s => s.deck.length)
  const factories     = useGameStore(s => s.factories)
  const regions       = useGameStore(s => s.regions)
  const players       = useGameStore(s => s.players)
  const bonusUsedThisTurn = useGameStore(s => s.bonusUsedThisTurn)
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

  // ── THE BOARD SAYS NO, AND NOW IT SHOWS IT (T1 S58) ─────────────────────────────────────────────
  // The sound shipped in S55 with no visual partner: a rejected tap made a small noise and NOTHING
  // moved. But the brief's premise ("it fires on every rejected tap") turned out to be the smaller
  // half of the story · MEASURED through this exact composed path, the sound was firing where nothing
  // had been refused, and staying silent where something had:
  //     idle              tap any of 60 hexes   ->  'refused' FIRED   · nothing was attempted
  //     factorySelected   tap a non-preview hex ->  silent            · an aim that missed
  //     elementSelected   tap a non-preview hex ->  silent            · an aim that missed
  //     regionSelected    tap a non-target hex  ->  'refused' fired   · the real refusal, 59 of 60 hexes
  // In idle the board is not a placement surface · no factory is picked · so a tap there is
  // exploratory, and answering it with a rejection buzz punishes a non-action. Sixty hexes is the
  // biggest target on a phone screen. So the cue is scoped to the one phase where the player has
  // committed a factory, an element AND a region and the board has then refused: uiPhase
  // 'regionSelected'. That is a rule that can be stated · THE CUE FIRES ONLY WHERE THE UI PROMISED
  // SOMETHING AND THEN SAID NO · rather than a list of cases someone extended once per bug.
  // Deliberately still silent in factorySelected/elementSelected: those draw a dashed PREVIEW and
  // never claimed the hex you tapped was live, so refusing it is not news.
  const [refusedHex, setRefusedHex] = useState(null)
  const refuseSeq = useRef(0)

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

  // ── THE REWARD MUST BE ON SCREEN (T1 S44) ──────────────────────────────────────────────────────
  // MEASURED in a browser audit: "Pattern complete · select a glowing card to score" fired with
  // exactly ONE glowing card, at y=1580 in a 749px viewport · 831px BELOW THE FOLD, sidebar
  // scrollTop 0, no auto-scroll, visible false. Meanwhile End Turn was enabled and the brightest
  // control on screen. So the game told the player they had earned a district, hid the only way to
  // take it, and lit the button that throws it away. That is the one moment in this game where the
  // interface can cost real points, and it was costing them.
  // The step panel above already scrolls for the CHOOSING phases and scorePending is not one of
  // them · the affordance existed and simply did not cover the case that mattered most.
  // `block: 'center'` rather than 'nearest': nearest is satisfied by one pixel of the card touching
  // the scrollport, which on a 168px card is not a card anybody can see.
  const scoreCardRef = useRef(null)
  const firstScoreableId = uiPhase === 'scorePending'
    ? (currentPlayer?.hand ?? []).find(c => buildableMatches.some(m => m.cardId === c.id))?.id ?? null
    : null
  useEffect(() => {
    if (uiPhase !== 'scorePending') return
    // After paint · the glowing card only exists once buildableMatches has rendered it.
    const id = requestAnimationFrame(() => {
      scoreCardRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    })
    return () => cancelAnimationFrame(id)
  }, [uiPhase, buildableMatches])

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
  // SOMETHING ELSE IS SPENDABLE AT ZERO ACTIONS NOW, and this is the note my past self left for the
  // moment it became true (T1 S43). The old text read: "no control anywhere calls useBonus, so a
  // bonus token cannot buy an action today · IF a bonus is ever wired to a button, this gate needs a
  // `bonusTokens.length === 0` term or it will end the turn out from under the player using it."
  // The button shipped this session, so the term is here. Without it the sequence is: third action
  // spent, panel opened to spend Automation for a fourth, and 1100ms later the turn ends underneath
  // the open panel · the one case the whole feature exists for.
  // IT IS A HELD TOKEN, NOT A USABLE ONE, deliberately: `bonusUsedThisTurn` already blocks a second
  // spend, so gating on "can still spend" would re-open the hole the moment a player holds a token
  // they cannot use this turn. Holding any token at all buys the pause; auto-end still fires the
  // instant the last one is spent or the player ends the turn themselves.
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
    uiPhase === 'idle' && buildableMatches.length === 0 && !scoreFlash &&
    (currentPlayer?.bonusTokens?.length ?? 0) === 0
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
  // ── WHAT CAN ACTUALLY BE DONE RIGHT NOW (T1 S44) ───────────────────────────────────────────────
  // A player reached Turn 33 with 2 actions remaining and the game stopped accepting input FOREVER:
  // deck empty, every reachable region 19/19 full, so no placement and no draw existed · and End
  // Turn was disabled because it demanded all three actions be SPENT. Reloading restored the lock
  // from sessionStorage. The engine was never the problem: handleEndTurn gates on isMyTurn alone and
  // would have ended that turn happily. The UI's enable condition was the whole cage.
  //
  // THIS PREDICATE IS THE ANSWER TO "IS THERE ANYTHING TO DO", and it is deliberately the same one
  // for the escape hatch, the instruction line and the region buttons · three surfaces that were
  // each guessing separately, which is how the header came to promise dashed hexes that do not
  // exist. One source, so they cannot disagree (Rule 45).
  //
  // WHAT COUNTS, in the order it is cheapest to check:
  //   · a district waiting to be scored · costs NO action, so it is live even at zero (S36)
  //   · a draw · but only if a card can really be TAKEN. The engine spends the action either way:
  //     `const card = state.deck.shift(); if (card) player.hand.push(card)` still decrements. So an
  //     empty deck is not a move, it is a way to lose an action. Flagged to T2.
  //   · a placement · a factory holding at least one element AND a region it borders with at least
  //     one legal hex. Asked of getValidPlacements rather than reasoned about, because centre-first
  //     and adjacency are the engine's rules and a second copy of them here would drift (Rule 45).
  //
  // AND THE COST IS MEASURED, NOT ASSUMED (T1 S45). I shipped this in S44 having deleted the words
  // "obviously cheap" from this comment without replacing them with a number, which is the same
  // reasoning Rule 81 forbids · it just looks humbler. `regions` and `factories` change identity on
  // every placement and this component re-renders once a second for the turn clock, so the honest
  // worry was a per-second sweep on the smallest device.
  // MEASURED at 320x568 against the live engine, worst case (54 tokens down, every factory stocked
  // so the `stock === 0` short-circuit never fires), 200 runs:
  //     6 engine calls per sweep · median 0.10ms · p95 0.30ms · max 0.70ms
  //     p95 is 1.8% OF A 60fps FRAME · roughly 50x of headroom
  // So the gate I proposed (only sweep at actionsLeft > 0 && uiPhase === 'idle') is NOT warranted:
  // it would add a second condition to the predicate three surfaces now share, to save 0.3ms.
  // Caveat stated rather than hidden: that is a desktop JS engine at a phone VIEWPORT, not a phone
  // CPU. Even at 10x slower it is 3ms, inside a frame · but if this file ever gets a real device
  // budget, this is the line to re-measure rather than re-reason.
  const legalPlacements = useMemo(() => {
    if (!isMyTurn || phase !== 'playing' || actionsLeft <= 0) return { total: 0, byRegion: {}, byFactory: {} }
    const store = useGameStore.getState()
    const byRegion = {}, byFactory = {}
    let total = 0
    for (const f of factories) {
      const stock = (f.elements ?? []).reduce((n, e) => n + (e.count ?? 0), 0)
      byFactory[f.id] = 0
      if (stock === 0) continue
      for (const rid of (f.betweenRegions ?? [])) {
        const n = (store.getValidPlacements?.(f.id, rid) ?? []).length
        if (!n) continue
        byRegion[rid] = (byRegion[rid] ?? 0) + n
        byFactory[f.id] += n
        total += n
      }
    }
    return { total, byRegion, byFactory }
    // `regions` is in the deps because a placement's legality depends on what is already down.
  }, [isMyTurn, phase, actionsLeft, factories, regions])

  const canDraw = actionsLeft > 0 && (theOffer.length > 0 || deckCount > 0)
  const hasLegalMove = buildableMatches.length > 0 || canDraw || legalPlacements.total > 0
  // The escape hatch. Not "the game is over" · just "this player cannot act", which is the only
  // condition that has to unlock End Turn early. T2 is shipping real terminal-state detection in
  // parallel; this is deliberately narrower and they do not conflict (see comms).
  const noLegalMove = isMyTurn && phase === 'playing' && actionsLeft > 0 && !hasLegalMove

  const instruction = (() => {
    if (!isMyTurn) return `Waiting for ${currentPlayer?.username ?? 'the other player'}`
    // SCORING OUTRANKS "out of actions", and the old order had it the other way round. Because
    // scoring costs no action, a completed pattern is still live at zero · so the line was telling a
    // player to end their turn while a district was sitting there waiting to be built. That is the
    // one moment in the game where the instruction line can cost real points.
    if (uiPhase === 'scorePending') return 'Pattern complete · select a glowing card to score'
    if (actionsLeft <= 0) return 'No actions left · ending your turn'
    // ── AND THE LINE MUST NOT PROMISE WHAT THE BOARD CANNOT DO (T1 S44) ──────────────────────────
    // Every string below used to be static, so each described the HAPPY path and kept describing it
    // after the board ran out. All three were unrecoverable except by an undocumented click on the
    // same factory again. They are gated on real counts now · the same counts the buttons use.
    if (noLegalMove) return 'No legal move left · end your turn'
    switch (uiPhase) {
      case 'factorySelected': {
        // "the dashed hexes show where it can go" was printed even when strokeDasharray matched ZERO
        // polygons · a factory with stock whose regions are all full, or an empty factory.
        const reach = legalPlacements.byFactory[selectedFactory] ?? 0
        if (reach === 0) return 'This factory has nowhere to place · pick another'
        return aimedRegion != null
          ? `Pick an element · it goes into ${REGION_NAMES[aimedRegion]}`
          : 'Pick an element · the dashed hexes show where it can go'
      }
      case 'elementSelected':  return 'Choose a region to place into'
      case 'regionSelected':   return 'Click a highlighted hex to place the element'
      default:                 return canDraw
        ? 'Click a factory to take an element · or draw a card from the Offer'
        : 'Click a factory to take an element'
    }
  })()
  // ── ESCAPE CANCELS THE PLACEMENT FLOW (T1 S44) ─────────────────────────────────────────────────
  // Measured `escapeWorked: false`. A player four clicks into a placement had exactly one way back
  // and it is undocumented: click the SAME factory again, which handleFactoryClick treats as a
  // toggle-off. Nothing on screen says so, and the header meanwhile insists on picking an element.
  // It uses that existing toggle rather than a second cancel path · reset() is not exported from
  // useGameActions (T2's lane) and a private copy of the teardown would be a second contract that
  // drifts the first time a step is added to the machine (Rule 45).
  // Handler in a ref, deps empty: this component re-renders once a second for the turn clock, and an
  // effect that re-subscribes on every render is the S35/S76 hazard. Values change, the listener
  // does not.
  // ── THE PHONE SHEET (T1 S49) ────────────────────────────────────────────────────────────────────
  // Below 600px the sidebar stops being a column and becomes a bottom sheet, so the board can have
  // the whole of `main`. index.css owns the geometry; this owns WHEN it is up.
  //
  // IT IS FLOW-AWARE, AND THAT IS THE WHOLE DESIGN. The 4-step placement alternates between controls
  // that live in the SHEET and a target that lives on the BOARD:
  //     factorySelected  pick an element   -> in the sheet   -> OPEN
  //     elementSelected  pick a region     -> in the sheet   -> OPEN
  //     regionSelected   TAP A VALID HEX   -> on the board   -> CLOSED, always
  //     scorePending     tap a glowing card-> in the sheet   -> OPEN
  //     idle             look at the board                  -> CLOSED
  // So the sheet is never up at the moment the player has to reach the board. That is not a nicety:
  // an overlay that covers the thing you must tap is this project's most-repeated defect (Rules 78a,
  // 87, and S39's action log, which covered 31 of 57 cells while still passing clicks through).
  const SHEET_PHASES = ['factorySelected', 'elementSelected', 'scorePending']
  const [sheetOpen, setSheetOpen] = useState(false)
  // Derived on every uiPhase CHANGE, not latched · a manual tap on the handle holds until the flow
  // moves, and then the flow wins. Deps are one string, so no identity churn can cancel this (Rule 76).
  useEffect(() => { setSheetOpen(SHEET_PHASES.includes(uiPhase)) }, [uiPhase]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── REGION FOCUS · THE BOARD FOLLOWS THE SELECTION THE PLAYER HAS ALREADY MADE (T1 S50) ────────
  // Step 3 of the 4-step placement IS "which region", so by the time the target is a hex the player
  // has named one. The board scopes to it rather than asking a fifth question · a separate map-and-
  // zoom view would add a click to a flow that took two sessions to make honest.
  // MEASURED, not asserted: the whole board cannot give a phone a 44px hex at any layout (827x866
  // user units against 320 = 27.8px ceiling). One region measures ~69px. See computeViewBox.
  //
  // PHONE ONLY, AND ON THE SHEET'S OWN BREAKPOINT. At 1280 the full board already renders 53.9px
  // hexes and showing all three regions is strictly better for deciding where to place · focus is
  // an accommodation, not an improvement. It reuses index.css's 600px rather than introducing a
  // second threshold, because the sheet layout and this are one design and two numbers that must
  // agree is a second contract (Rule 45).
  // jsdom has NEITHER matchMedia NOR addEventListener on its result · verified, not assumed · so
  // both are optional-chained and the jsdom default is `false`, i.e. the desktop board. That makes
  // the unit gate below explicit about which branch it is in rather than silently testing one.
  const [isPhone, setIsPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 600px)')
    if (!mq) return
    const apply = () => setIsPhone(mq.matches)
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])
  // ── card-complete AND bonus-earned · THE TWO SOUNDS THAT SHIPPED AND NEVER PLAYED (T1 S56) ─────
  // I wired eight of ten last session and found the gap while writing the handoff, not while
  // measuring · the writer-with-no-caller shape this project has now found six times
  // (award_game_win, useBonus, games_played, getFinalScore, and these two, which I created myself).
  //
  // ⚠ WHICH GUARD IS LOAD-BEARING, STATED, BECAUSE I GOT THIS WRONG ONCE AND GATED THE WRONG ONE.
  // These describe STATES ("a pattern is complete", "you hold a token"), and a sound fired on a
  // state would re-fire on every render · this component re-renders ONCE A SECOND for the countdown.
  // THE DEP ARRAY IS WHAT PREVENTS THAT, and it is sufficient on its own: buildableMatches is
  // useState and the other deps are numbers, so every dep is identity-stable and React does not
  // re-run these effects on a tick. I wrote five tests to gate the refs below and made all three
  // call sites level-triggered; nothing reddened, because there was nothing left to break.
  // THE REFS ARE DEFENCE FOR ONE CASE THE DEPS DO NOT COVER: a state update carrying a NEW ARRAY
  // with the SAME CONTENTS. buildableMatches is recomputed after every placement, so a second
  // placement that leaves the same card completable hands the effect a new identity and a level
  // check would fire a duplicate. That case is real and no test in this repo can construct it ·
  // buildableMatches is local to useGameActions. It is UNCOVERED, deliberately, and recorded here
  // rather than behind a green assertion that passes for the wrong reason (Rule 86).
  // If you change these effects: the dep array is the guard, the ref is the belt.
  //
  // card-complete is the one that matters most, and the reason is my own S52 measurement: a player
  // who completes a pattern gets an 11px line in error red while a BOT got a full-screen starburst.
  // The sound is the cheapest half of fixing that asymmetry.
  const prevMatchIds = useRef('')
  useEffect(() => {
    if (phase !== 'playing') return
    // The IDENTITY of the set, not its size · going from one completable card to a different one is
    // a new thing to hear about, and 1 -> 1 would be silent on a length check.
    const ids = buildableMatches.map(m => m.cardId).sort().join(',')
    const had = prevMatchIds.current
    prevMatchIds.current = ids
    // Only on the RISING edge, and only for MY board · a pattern completing on the opponent's turn
    // is their event, not mine.
    if (ids && ids !== had && isMyTurn) playSound('card-complete')
  }, [buildableMatches, isMyTurn, phase])

  const prevBonusCount = useRef(null)
  useEffect(() => {
    const n = myPlayer?.bonusTokens?.length ?? 0
    const before = prevBonusCount.current
    prevBonusCount.current = n
    // `before === null` is the first observation · a player rejoining a game already holding two
    // tokens must not be told they just earned them.
    if (before !== null && n > before) playSound('bonus-earned')
  }, [myPlayer?.bonusTokens?.length])

  // TURN-START · only when it becomes MINE, and keyed on turnNumber so it cannot re-fire on an
  // unrelated re-render (this app re-renders every second for the countdown · Rule 76/107).
  const lastAnnouncedTurn = useRef(null)
  useEffect(() => {
    if (phase !== 'playing' || !isMyTurn) return
    if (lastAnnouncedTurn.current === turnNumber) return
    lastAnnouncedTurn.current = turnNumber
    playSound('turn-start')
  }, [isMyTurn, turnNumber, phase])

  const focusRegion = isPhone && uiPhase === 'regionSelected' ? selectedRegion : null

  // THE OFFER'S COLLAPSE STATE (T1 S53 · see the block at "THE OFFER" for the measurement).
  // Default CLOSED, and `offerExpanded` folds the viewport in so desktop can never be collapsed by
  // a stale piece of state · at 1280 there is room for all three panels and the toggle is not even
  // rendered, so a `false` sitting in this variable must not be able to hide anything there.
  // SOUND (T1 S55). The unlock is bound to the first pointer/key event · see utils/sound.js for why
  // the first sound must not be one the browser will refuse.
  useEffect(() => installSoundUnlock(), [])
  const [muted, setMutedState] = useState(isMuted)
  useEffect(() => subscribeMuted(setMutedState), [])

  const [offerOpen, setOfferOpen] = useState(false)
  const offerExpanded = !isPhone || offerOpen

  // ── "THERE IS MORE BELOW" · AND IT HAS TO BE TRUE IN BOTH DIRECTIONS ────────────────────────────
  // The sheet has been a scroll surface since S47 and has never said so. Collapsing the Offer removes
  // most of the overflow but not all of it, and an indicator that is merely decorative would be worse
  // than none: a hint that shows when nothing is below teaches the player to ignore it, and by the
  // time it is right nobody is looking (Rule 88c's failure mode, in the one place they are trying to
  // orient). So it is computed from the real geometry and re-measured on scroll, on resize, and
  // whenever the content itself changes.
  const sheetRef = useRef(null)
  const [sheetMore, setSheetMore] = useState(false)
  const measureSheet = useCallback(() => {
    const el = sheetRef.current
    if (!el) return
    // 8px of slack · a sub-pixel remainder is not "more content", and a hint that flickers at the
    // bottom of a scroll is the same lie in a shorter costume.
    setSheetMore(el.scrollHeight - el.scrollTop - el.clientHeight > 8)
  }, [])
  useEffect(() => {
    measureSheet()
    const el = sheetRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    // The CONTENT resizes without the box changing (a card drawn, the Offer expanded), so observe
    // both · watching only the container would miss every change that matters here.
    const ro = new ResizeObserver(measureSheet)
    ro.observe(el)
    for (const c of el.children) ro.observe(c)
    return () => ro.disconnect()
  }, [measureSheet, uiPhase, offerExpanded, sheetOpen])

  // ── THE SHEET DRAGS THE BOARD OFF SCREEN IF ITS BUTTON KEEPS FOCUS (T1 S50) ─────────────────────
  // MEASURED at 600x800 the moment region focus landed: `.game-board-area` at top -250 inside a
  // `.game-main` that sits at 122..736, i.e. the board had been SCROLLED UP by 372px. 6 hexes of the
  // focused region off the top of the window and 7 more behind the header.
  // THE MECHANISM, and it is worth stating because `overflow: hidden` reads as "cannot scroll":
  // hidden containers are still PROGRAMMATICALLY scrollable, and clicking a region button leaves it
  // focused · then the sheet translates 100%+44px downwards out of view, and the browser dutifully
  // scrolls the nearest scrollable ancestor to keep the focused control visible. The board is what
  // moves. It is timing-dependent, which is why it reproduced at 600 everywhere but at 414 only on
  // production · a flake in a probe would have been the easy conclusion and it would have been wrong.
  // Two defences, because they fix different halves:
  //   BLUR · a control that has just slid off screen should not hold focus. This is the correct
  //          behaviour on its own terms (a keyboard user was left on an invisible button) and it
  //          removes the cause.
  //   RESET · onScroll puts `main` back to 0. The cause is not the only thing that can scroll a
  //          container · anything calling focus() or scrollIntoView() inside the sheet does too ·
  //          so the container asserts its own invariant rather than trusting every future caller.
  const mainRef = useRef(null)
  useEffect(() => {
    if (sheetOpen) return
    const sheet = document.getElementById('game-sheet')
    const active = document.activeElement
    if (sheet && active && sheet.contains(active) && typeof active.blur === 'function') active.blur()
    if (mainRef.current) { mainRef.current.scrollTop = 0; mainRef.current.scrollLeft = 0 }
  }, [sheetOpen, uiPhase])

  const cancelRef = useRef(null)
  cancelRef.current = () => {
    // Escape closes a sheet the player opened by hand, even with nothing selected · otherwise the
    // only way back to a full board is a second tap on a control they may not be looking at.
    if (uiPhase === 'idle' && sheetOpen) { setSheetOpen(false); return true }
    if (uiPhase === 'idle' || uiPhase === 'scorePending') return false
    if (selectedFactory === null) return false
    handleFactoryClick(selectedFactory) // same id → reset()
    setAimedRegion(null)
    return true
  }
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (cancelRef.current?.()) e.preventDefault()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Pulse the factories to invite the first action · only on your turn, with actions left, before a pick.
  const factoriesPulse = isMyTurn && actionsLeft > 0 && selectedFactory === null

  // The header's own exit, which is the right home for it while there is a board to leave. Once the
  // game ends the FinalScore overlay owns the screen and carries the exit itself.
  const headerExit = practice && phase !== 'scoring'

  // THE ROUTE BACK INTO THE RULES (T1 S36 · gap 9 of docs/TUTORIAL_GAP_AUDIT.md). Until now
  // setShowTutorial had exactly ONE caller · the tutorial's own dismiss handler · so a player who hit
  // Skip, or who read it on turn 1 and needed it on turn 4, had no way back to the rules from
  // anywhere inside the game. Every other gap in that audit therefore had to land in one pass, on
  // turn 1, before the player had any context to hang it on.
  // Gated on the same phase as the Tutorial's own mount, so the button can never promise an overlay
  // that will not appear · and hidden while it IS open, because the tutorial is z-500 over the whole
  // viewport and a control painted underneath one of those is the bug this session is named after.
  const showRules = phase === 'playing' && !showTutorial

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
      // The sheet's state, as an attribute, because index.css drives the transform from it and a
      // gate needs to read it. It FLIPS · a permanently-mounted testid proves nothing (Rule 50).
      data-sheet={sheetOpen ? 'open' : 'closed'}
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
        {/* At 'scoring' the exit moves INTO the FinalScore overlay, which is fixed/inset-0/z-300 and
            paints over this header · leaving it here would keep a second `leave-practice` in the
            document that no player can click, which is worse than one that moved. One at a time.

            THE RULES BUTTON LIVES HERE, and the position was measured (T1 S36 · gap 9 of
            docs/TUTORIAL_GAP_AUDIT.md). The bottom ActionBar is the obvious home for it and it is
            the wrong one: at a 320px viewport that bar is already exactly 320 of 320 wide with no
            bonus tokens held, so a 44px control there pushed End Turn 17px off the right edge · a
            control present and unreachable, which is the defect this same session fixed in the
            practice exit. This column is `1fr` in a `1fr auto 1fr` grid and holds NOTHING in a real
            game, so the button is free here. Top-right is also where a person looks for help. */}
        <div
          aria-hidden={undefined}
          style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}
        >
          {/* MUTE · NOT in the ActionBar, and that is measured rather than stylistic: at 320 that bar
              has MINUS 6px of free space (T1 S54) and I have fixed its overflow three times. This
              column is `1fr` in a `1fr auto 1fr` grid and holds nothing in a real game, which is the
              same argument that put the rules button here in S36.
              It is always rendered · a mute control that appears only in practice would be missing
              from the mode with other people in it, which is where a player most needs it. */}
          <button
            data-testid="mute-toggle"
            onClick={() => { if (muted) playSound('ui-click'); setMuted(!muted) }}
            aria-label={muted ? 'Unmute game sounds' : 'Mute game sounds'}
            aria-pressed={muted}
            title={muted ? 'Sound off' : 'Sound on'}
            style={{
              width: 44, height: 44, minHeight: 44, flexShrink: 0, borderRadius: 8,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              border: '1px solid rgba(255,255,255,0.14)', background: 'transparent',
              color: muted ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)',
              fontSize: 15, lineHeight: 1, cursor: 'pointer',
              transition: 'color 0.2s, border-color 0.2s',
            }}
          >
            <span aria-hidden="true">{muted ? '🔇' : '🔊'}</span>
          </button>
          {showRules && (
            <button
              data-testid="open-rules"
              onClick={() => setShowTutorial(true)}
              aria-label="How to play · reopen the rules"
              title="How to play"
              style={{
                width: 44, height: 44, minHeight: 44, flexShrink: 0, borderRadius: 8,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid rgba(255,255,255,0.14)', background: 'transparent',
                color: 'rgba(255,255,255,0.5)', fontSize: 16, lineHeight: 1, cursor: 'pointer',
                transition: 'color 0.2s, border-color 0.2s',
              }}
            >
              ?
            </button>
          )}
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
      <div
        className="game-main"
        ref={mainRef}
        // ⚠ THE OVERFLOW MOVED TO index.css IN S51 AND MUST NOT COME BACK HERE. It is declared
        // twice there · `overflow: hidden; overflow: clip` · which a JS style object cannot express,
        // and that pair is the whole safety argument: `clip` makes the box non-scrollable by
        // construction (measured: Chromium 149 and WebKit 26.5 both refuse a scrollTop of 500),
        // while a Safari that does not know `clip` drops that declaration and keeps `hidden`.
        // Re-adding an inline `overflow` here would beat the stylesheet and silently restore the
        // scrollable box, which is the 372px defect S50 fixed.
        // The reset stays as the belt for a pre-16 Safari, where the rule degrades to `hidden`.
        onScroll={e => { e.currentTarget.scrollTop = 0; e.currentTarget.scrollLeft = 0 }}
        style={{ flex: 1, display: 'flex', minHeight: 0 }}
      >

        {/* BOARD */}
        {/* The board area needs a NAME so the phone layout can give it a share of the column ·
            it had none, so index.css could only ever address the sidebar (T1 S47). */}
        <div className="game-board-area" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, minHeight: 0, minWidth: 0, position: 'relative' }}>
          {/* MY SCORE, NOT THE CURRENT PLAYER'S (T1 S54).
              MEASURED first, because the brief and my own S53 recommendation both assumed the
              player could not read a score without scrolling, and that is false: all three region
              numbers are on screen at every phone width in idle · 12px at 320, 16 at 375, 18 at
              414 · and the focused region renders its own at 33-47px in regionSelected. The
              sheet's Score panel is a DUPLICATE of that, and in practice (no opponent) it is an
              exact one. So the score was never below the fold; only the COMPARISON was.
              What is actually wrong is whose number it is. `currentPlayer` is the player whose
              TURN it is, so in a real room this readout silently becomes the OPPONENT's for the
              whole of their turn, in the same position, in the same colour, with nothing saying
              so · a number that changes owner without announcing it is worse than one that is
              missing, because it is read and believed. `myPlayer` already falls back to
              currentPlayer (line 240), so solo and practice are byte-identical.
              ⚠ THE BLIND SPOT, NAMED BEFORE TRUSTING THE MEASUREMENT: practice is exactly the mode
              where this change is INVISIBLE · myPlayer IS currentPlayer with one seat, so every
              live probe I can run without minting identities shows no difference at all. A green
              browser run is not evidence here. The gate constructs the two-seat state directly.
          */}
          <GameBoard
            focusRegion={focusRegion}
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
            regionScores={myPlayer?.scores ?? []}
            refusedHex={refusedHex}
            onHexClick={(q, r, rid) => {
              // Before an element is chosen the board is a preview, not a placement surface. A click on
              // a previewed hex takes aim at its region · a click anywhere else is still inert, which is
              // honest, because those hexes are not drawn as reachable.
              if (isChoosing) {
                if (reachable.targets.some(t => t.q === q && t.r === r && t.regionId === rid)) setAimedRegion(rid)
                return
              }
              // Read the phase BEFORE the click · handleHexClick moves it, so asking afterwards
              // answers a question about the state the tap PRODUCED rather than the one it met.
              const attempted = uiPhase === 'regionSelected'
              const placed = handleHexClick(q, r, rid)
              if (placed) {
                playSound('hex-place')
                addLogEntry(`placed ${cap(placed.element)} in ${REGION_NAMES[placed.regionId]}`, ELEMENT_COLORS[placed.element])
              } else if (attempted) {
                // A refused tap gets its own voice AND its own picture. Silence on refusal is what
                // makes a player tap again harder; this product has spent three sessions on controls
                // that look active and do nothing.
                playSound('refused')
                refuseSeq.current += 1
                setRefusedHex({ q, r, regionId: rid, seq: refuseSeq.current })
              }
            }}
            onFactoryClick={(id) => { setAimedRegion(null); handleFactoryClick(id) }}
          />
          <ActionLog entries={actionLog} />
          {/* Sacred milestone celebration · covers the board for 2500ms when a total crosses 7/9/13/18/27/36 */}
          <MilestoneOverlay mySeat={mySeat} />
        </div>

        {/* SIDEBAR */}
        {/* THE SHEET HANDLE · phone only (index.css hides it from 601px up). 44px tall, and it is the
            player's manual way back to the panel when the flow has closed it · without it the sheet
            would be reachable only by starting a placement, which is the affordance-free version of
            the same bug this whole change is fixing. It sits INSIDE .game-main so the sheet and its
            handle share a stacking context with the board rather than floating over the whole app. */}
        <button
          className="game-sheet-handle"
          data-testid="sheet-handle"
          aria-expanded={sheetOpen}
          aria-controls="game-sheet"
          onClick={() => { playSound('sheet-toggle'); setSheetOpen(o => !o) }}
        >
          <span className="game-sheet-grip" aria-hidden="true" />
          <span className="game-sheet-handle-label">
            {sheetOpen ? 'Hide panel' : `Hand ${currentPlayer?.hand?.length ?? 0} · Offer ${theOffer.length}`}
          </span>
        </button>

        <aside id="game-sheet" className="game-sidebar" ref={sheetRef} onScroll={measureSheet} style={{
          width: 288, borderLeft: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', padding: 16, gap: 14, overflowY: 'auto', flexShrink: 0,
        }}>

          {/* STEP 2: element type buttons (factory selected) */}
          {uiPhase === 'factorySelected' && factory && (
            <div ref={stepPanelRef}>
              {/* Soul-metal lore reveals under each element on hover/focus (PLATO_BOOKS · Pillar 1) ·
                  grows within the flow so the sidebar's overflow never clips it (Rule 4: minHeight 44px).

                  ⚠ AND ON A PHONE IT REVEALED TO NOBODY (T1 S52). `:hover` does not exist on touch and
                  `:focus-visible` is deliberately withheld from a tap · browsers reserve it for
                  keyboard focus · so both triggers are unreachable on the device most players use.
                  The other channel, `title=`, is a hover tooltip too. MEASURED on a real touch
                  viewport before changing anything (Rule 116 · a source read cannot answer this, and
                  my own grep of index.css said the rule did not exist because it lives in this
                  <style> block):
                      tipOpacity "0" · tipFont "10px" · tipVisible FALSE · all four elements
                  So the game never told a phone player what Energy or Community are. The content was
                  written, shipped and completely unreachable · the same invisibility as card art at
                  0/56, in a costume where nothing is even missing.
                  `(hover: none)` is the precise question: it asks whether the PRIMARY input can
                  hover, not whether the screen is small, so a small laptop keeps the reveal and a
                  large tablet does not. Desktop behaviour is untouched.
                  The 10px also goes to 12px, which is the floor the UX scan set and which the rest of
                  this product already honours. */}
              <style>{`
                .neo-soul-tip { max-height: 0; opacity: 0; overflow: hidden; transition: max-height 0.2s ease, opacity 0.2s ease; }
                .neo-soul-btn:hover .neo-soul-tip, .neo-soul-btn:focus-visible .neo-soul-tip { max-height: 15px; opacity: 1; }
                @media (hover: none) { .neo-soul-tip { max-height: 15px; opacity: 1; } }
                @media (prefers-reduced-motion: reduce) { .neo-soul-tip { transition: none; } }
              `}</style>
              <div style={sectionLabel}>Select element</div>
              {/* AN EMPTY PANEL IS NOT AN ANSWER (T1 S44). Clicking a factory with zero tokens opened
                  this panel with 0 rows and 0 buttons while the header went on saying "Pick an
                  element", and the only way out was to click the same factory again · which nothing
                  tells the player. The panel now says what happened and offers the way back as a real
                  control rather than as folklore. */}
              {factory.elements.filter(el => el.count > 0).length === 0 && (
                <div data-testid="factory-empty" style={{
                  display: 'flex', flexDirection: 'column', gap: 8,
                  color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.5,
                }}>
                  <span>This factory is empty · it holds no elements to take.</span>
                  <button
                    data-testid="cancel-selection"
                    onClick={() => cancelRef.current?.()}
                    style={{
                      minHeight: 44, padding: '0 14px', borderRadius: 8, cursor: 'pointer',
                      border: '1px solid rgba(255,255,255,0.16)', background: 'transparent',
                      color: 'rgba(255,255,255,0.75)', fontSize: 13, letterSpacing: 0.3,
                    }}
                  >
                    Pick another factory
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {factory.elements.filter(el => el.count > 0).map(el => {
                  const soul = ELEMENT_SOUL_METAL[el.type]
                  return (
                  <button key={el.type}
                    className="neo-soul-btn"
                    data-testid="element-btn"
                    data-element={el.type}
                    title={elementSoulMetalLabel(el.type) ?? undefined}
                    onClick={() => { playSound('element-select'); handleElementSelect(el.type) }}
                    style={{
                      minHeight: 44, padding: '4px 14px', borderRadius: 8,
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
                          // 12px, not 10 · the floor the UX scan set. At 10px this line was both
                          // invisible AND under the minimum, so raising it only mattered once it
                          // could be seen at all.
                          fontSize: 12, lineHeight: '15px', color: 'rgba(200,148,64,0.85)', letterSpacing: 0.3, whiteSpace: 'nowrap',
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
                  // A REGION WITH NO LEGAL HEX IS NOT A CHOICE (T1 S44). These rendered as ordinary
                  // enabled buttons on a full region, so the player picked one, the board lit nothing,
                  // and the header told them to click a highlighted hex that did not exist. Counted
                  // from the same getValidPlacements the board itself draws from, so the button and
                  // the hexes can never disagree.
                  const free = legalPlacements.byRegion[rid] ?? 0
                  const dead = free === 0
                  return (
                    <button key={rid}
                      data-testid="region-btn"
                      data-region={rid}
                      data-free-hexes={free}
                      disabled={dead}
                      title={dead ? `${regionNames[rid]} is full · no legal hex from this factory` : undefined}
                      onClick={() => { if (!dead) handleRegionSelect(rid) }}
                      style={{
                        height: 44, padding: '0 14px', borderRadius: 8,
                        cursor: dead ? 'not-allowed' : 'pointer',
                        opacity: dead ? 0.45 : 1,
                        border: selectedRegion === rid
                          ? `1px solid ${regionColors[rid]}`
                          : '1px solid rgba(255,255,255,0.12)',
                        background: selectedRegion === rid ? `${regionColors[rid]}22` : 'transparent',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: regionColors[rid] }} />
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{regionNames[rid]}</span>
                      {dead && (
                        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.35)', fontSize: 11 }}>full</span>
                      )}
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

          {/* ── THE OFFER · COLLAPSED BY DEFAULT ON A PHONE (T1 S53) ─────────────────────────────
              MEASURED on production at 320x568 before this, and it is why the sheet's occlusion work
              was only half the job:
                  idle              931px of content in a 240px window · 691px hidden · 4 of 7 cards
                  factorySelected  1167px of content in a 240px window · 927px hidden · 0 of 7 cards
              In factorySelected the element buttons filled the entire visible window and NOT ONE card
              was on screen · not the Offer, not the Hand, not the Score · with no scroll affordance
              anywhere. S49's sheet solved OCCLUSION (the board is never covered when you must tap it)
              and I measured that property for a week without ever asking whether the panel itself was
              legible.
              Mahil's ruling on which of the three options: collapse the OFFER. It is the one panel a
              player consults occasionally rather than continuously · Hand and Score are needed every
              turn · and tabs would add a mode to a flow that took two sessions to make honest.
              Phone only. At 1280 the sidebar has room for all three and a toggle there would be a
              control that solves nothing.

              ⚠ THE FAILURES THIS MEASUREMENT CANNOT SEE, NAMED BEFORE TRUSTING IT. "Cards visible"
              improves fastest if the Offer simply stops working, so the number on its own is not
              evidence of anything:
                1 · A COLLAPSED OFFER THAT CANNOT BE OPENED. `0 of 7 visible` reads as success. The
                    toggle is a real 44px button and its reachability is hit-tested, not assumed.
                2 · DRAWING BECOMES IMPOSSIBLE. Drawing from the Offer is one of the two legal actions
                    in the game. Expanding must reveal cards that are actually drawable.
                3 · THE AFFORDANCE LIES. A "more below" hint that shows when nothing is below, or
                    hides when something is, is worse than none · it is a Rule 88c flake in the one
                    place the player is trying to orient. It is asserted in BOTH directions. */}
          <div>
            {/* RENDERED, NOT display:none'd, AND THAT IS THE POINT. A toggle that exists at 1280
                with `display: none` is a control whose reality depends on a media query · the exact
                composed answer Rule 116 is about, and my first draft of the gate duly asserted DOM
                presence and got the wrong answer in both directions. Conditional rendering makes
                "is it there" and "can the player use it" the same question. */}
            {isPhone ? (
              <button
                type="button"
                data-testid="offer-toggle"
                aria-expanded={offerExpanded}
                aria-controls="game-offer"
                onClick={() => { playSound('ui-click'); setOfferOpen(o => !o) }}
                style={{
                  ...sectionLabel, marginBottom: offerExpanded ? sectionLabel.marginBottom : 0,
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  minHeight: 44, padding: 0, border: 'none', background: 'transparent',
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <span aria-hidden="true" style={{
                  display: 'inline-block', transition: 'transform 0.18s ease', fontSize: 9,
                  transform: offerExpanded ? 'rotate(90deg)' : 'none',
                }}>▶</span>
                <span>The Offer · {theOffer.length}</span>
              </button>
            ) : (
              /* Desktop keeps the plain label · no control, because there is nothing to solve. */
              <div style={sectionLabel}>The Offer</div>
            )}
            <div id="game-offer" data-offer hidden={!offerExpanded}
                 style={{ display: offerExpanded ? 'flex' : 'none', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
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
                    // The FIRST scoreable card is the scroll target · DERIVED from the current hand
                    // and matches, never latched. A `!ref.current` test here would pin the ref to the
                    // first card it ever saw and quietly scroll to a stale one on the next pattern.
                    innerRef={card.id === firstScoreableId ? scoreCardRef : undefined}
                    card={{ ...card, element: cardPrimaryElement(card) }}
                    onClick={isScoreable ? () => {
                      const scored = handleCardScore(card.id)
                      if (scored?.card) {
                        // THE PAYOFF. A player who scores a district currently gets an 11px line in
                        // error red; this is meant to be the one sound they want to hear again.
                        playSound('district-score')
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

          {/* THE SCROLL AFFORDANCE · sticky to the sheet's floor, and only while there IS more.
              `pointerEvents: none` so it can never take a tap meant for a card · and it is 24px of
              gradient rather than a full-width bar precisely because Rule 87's action log taught this
              project that a see-through overlay is judged harmless right up until it is covering
              something. Its reachability cost is measured, not assumed.
              marginTop: -24 keeps it out of the flow, so showing it cannot itself create the overflow
              it is reporting · which would be a counter that manufactures its own subject. */}
          {sheetMore && (
            <div data-testid="sheet-more" aria-hidden="true" style={{
              position: 'sticky', bottom: -16, marginTop: -24, height: 24, flexShrink: 0,
              pointerEvents: 'none', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
              background: 'linear-gradient(to bottom, rgba(10,10,15,0), rgba(10,10,15,0.92))',
              color: 'rgba(255,255,255,0.45)', fontSize: 10, letterSpacing: 1,
            }}>
              ▾ more
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
        noLegalMove={noLegalMove}
        bonusTokens={currentPlayer?.bonusTokens ?? []}
        bonusUsedThisTurn={bonusUsedThisTurn}
        onUseBonus={(type) => {
          // THE ENGINE REJECTS IN SILENCE · wrong turn, second use in a turn, or a type it does not
          // implement all return with no error and no change. The button is already disabled for
          // every one of those, so this should never see a refusal · which is exactly why it checks.
          // Read the token count back out of the store and only claim what actually happened: a log
          // line for a bonus that was refused is the same lie the disabled state exists to avoid,
          // and a `used subsidy` entry with no cards drawn would be unfalsifiable from the screen.
          const seat = mySeat ?? useGameStore.getState().currentSeat
          const held = () => useGameStore.getState().players.find(p => p.seat === seat)?.bonusTokens?.length ?? 0
          const before = held()
          useGameStore.getState().useBonus(seat, type)
          if (held() < before) {
            addLogEntry(`used ${type}`, '#C89440')
            // Same wire every other action uses (useGameActions.persist is sync.pushState). A bonus
            // that only exists on one client is a divergence the next snapshot silently overwrites.
            transport?.pushState?.('use_bonus')
          }
        }}
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
