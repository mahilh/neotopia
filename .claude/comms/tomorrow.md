# NeoTopia Cross-Terminal Comms
# Updated automatically each session
# ALL terminals read this on boot

## HOW GIT PULL WORKS (permanent note)
Git is file-based. ~/NeoTopia/.git is SHARED between all terminals on disk.
One `git pull` in ANY terminal (Mac terminal, T1, T2, T3) updates the shared .git refs.
Every forge boot sequence now starts with `git pull --rebase` — you never need to pull manually.
If unsure: run `bash ~/NeoTopia/start.sh` from Mac terminal before opening Claude Code tabs.

## SESSION STATUS (S8 in progress)
Last committed HEAD: d968f0e · T2 S8 adds rooms_delete_host (migration 005) + game_end audit payload (gameEndEvent.js)
Live working tree also carries T1 S7 (Landing/FinalScore/App) + T3 S7 (resolveDbEventType + two-human E2E) WIP
Tests: 91 green (11 files · full working tree) · Build: clean · migrations 004 + 005 APPLIED LIVE + verified

## T2 S7 → ALL (Global NeoTopia Index · game_events 400 ROOT CAUSE · scoredCardIds note)

### 🔴 game_events 400 — ROOT CAUSE FOUND (T1's S5 flag · it's a T1-lane fix, one string each)
T1 S5 saw the audit insert 400 on event_type='place' and guessed "event_data shape". It is NOT that.
The live CHECK constraint game_events_event_type_check allows ONLY:
  draw_card · place_element · build_project · use_bonus · factory_refill · turn_end · game_end
src/hooks/useGameActions.js (T1 lane) passes NON-canonical strings, so EVERY audit insert 400s (not
just 'place' · all four) and the audit log is silently empty for ALL event types:
  line 125  persist('place')   → 'place_element'
  line 156  persist('draw')    → 'draw_card'
  line 175  persist('score')   → 'build_project'
  line 185  persist('endTurn') → 'turn_end'
FIX (T1): pass the canonical strings above. (T3 could instead normalize in useGameSync.pushState, but
the source strings live in useGameActions · fixing them there is correct.) seat_number is fine (0-3).
EVIDENCE: pg_constraint definition, read live from the DB this session.

### ✅ Global NeoTopia Index — REAL aggregation wired (your FinalScore "T2 wires real aggregation later")
Migration 004 applied live (scripts/migrations/004_global_neotopia_index.sql · SECURITY DEFINER, same
posture as mig 003). player_profiles RLS is own-row (profiles_own · user_id = auth.uid()), so a client
`select sum(neotopia_index)` returns ONLY the caller's own index · the migration adds an aggregate RPC
that returns the TRUE global with no per-row leak (verified live: brand-new anon sees global=N while its
own SELECT returns 0 rows). src/lib/supabase.js now exports:
  · GLOBAL_INDEX_BASE = 147823  (same seed you hardcoded · import it instead of redefining locally)
  · getGlobalIndex() → Promise<number> = base + SUM(all neotopia_index) · falls back to base on ANY error
  · recordCivilizationContribution(count) → Promise<{error}> · atomic · auth.uid()-scoped · capped [0,56]

T2 → T1 · FinalScore.jsx integration (replaces the local `const GLOBAL_INDEX_BASE = 147823`):
  import { GLOBAL_INDEX_BASE, getGlobalIndex, recordCivilizationContribution } from '../lib/supabase'
  const [globalIndex, setGlobalIndex] = useState(GLOBAL_INDEX_BASE + totalProjectsBuilt)
  useEffect(() => { getGlobalIndex().then(n => setGlobalIndex(n + totalProjectsBuilt)) }, [totalProjectsBuilt])
  // then render {globalIndex.toLocaleString()} in place of (GLOBAL_INDEX_BASE + totalProjectsBuilt)
  // To make the counter GROW over time, fire ONE contribution per game in the reveal effect, LOCAL
  // player only, guarded so a reload during 'scoring' cannot double-count (pass roomId + myUserId in):
  useEffect(() => {
    const key = `neotopia_recorded_${roomId}`
    if (localStorage.getItem(key)) return
    const me = players.find(p => p.userId === myUserId)
    const n = me?.scoredCardIds?.length ?? 0
    if (n > 0) { recordCivilizationContribution(n); localStorage.setItem(key, '1') }
  }, [])
  NOTE: best-effort flavor counter (client-fired · server-side game-end detection is out of scope). The
  DB caps each contribution at 56 so it can't be grossly inflated. The live global was reset to 0 this
  session (all prior nonzero values were T2 test writes · no real game has recorded a contribution yet).

### scoredCardIds — already done by T1 in the working tree · NOT duplicated (rule 27)
T1 S6 added scoredCardIds to gameStore.js (initGame + tryScoreCard, with the defensive guard) plus a
test. That is T2-lane code · it is correct, I verified it (74 green) and did NOT re-implement it. My
first edit attempt failed with "file modified since read" — that was the collision signal. Going
forward T2 owns src/store · ping T2 for a new store field rather than editing gameStore.js directly.

### Task C (bonus earn DATA) — STILL PENDING from Mahil (re-stated · see T2 → MAHIL below)
Mechanism shipped + tested T2 S5 (cover-hex + 7/13/18 pile). Zero code change until positions/piles land.

### T2 S7 EVOLUTION LESSON (extends rule 28)
In a LIVE multi-terminal repo, a boot-time premise check has a shelf life of minutes. At boot the tree
was clean, FinalScore did not exist, and scoredCardIds was absent — all TRUE then, all STALE 20 min
later once T1's concurrent forge landed both. Re-run `git status` right before EACH edit, not just at
boot · and treat an Edit "file modified since read" error as a COLLISION SIGNAL (stop + diff the lane),
not a mechanical re-read-and-retry. That one failed edit is what stopped me duplicating T1's scoredCardIds.

## T1 → T2 (from S3)
tryScoreCard(seat, cardId, regionId, lastPlacedKey) → boolean · shipped · scoreCard delegates to it
Replace handleCardScore before/after comparison with:
  const scored = store.tryScoreCard(currentSeat, cardId, selectedRegion, lastPlacedKey)
  if (scored) { triggerScoreFlash(cardId); reset() }

## T1 → T3 (from S3)
App.jsx routing: /lobby → Lobby · /game → GameRoom · wiring pending T1 S4
GameRoom needs: if (phase !== 'playing') navigate('/lobby')

## T2 → T1 (from S5)
useBonus('subsidy') — draw 2 cards, Offer-first · no bonusData needed
useBonus('initiative', {elementType, toQ, toR, regionId}) — place from reserve
1-BONUS-PER-TURN now ENFORCED: store has bonusUsedThisTurn (resets each endTurn). useBonus
  rejects silently once a bonus is used. In the bonus UI, disable all bonus buttons when
  useGameStore(s => s.bonusUsedThisTurn) is true.
BONUS EARN paths are wired (deterministic, no RNG) but DATA-PENDING (no-op until rulebook data):
  · cover a hex carrying hex.bonusType (set in initGame) → placer gains that token
  · score crosses 7/13/18 → gains top of region.bonusPile
  Until Mahil supplies positions/piles, no token is auto-earned · the mechanism is tested + ready.

## T2 → ALL (from S6 · ✅ AUTH BLOCKER RESOLVED — T1's reload-churn bug)
ROOT CAUSE: useAuth raced supabase.auth.getSession() against localStorage hydration. On reload
  getSession() resolved null BEFORE the persisted session hydrated → code fell through to
  signInAnonymously() → minted a NEW anon user and OVERWROTE the stored token → user_id changed
  every reload (T1's 4-distinct-ids symptom · RLS 403 + lost seat).
FIX (2 files, T2 lane):
  · src/lib/supabase.js — explicit auth storage: storage=window.localStorage (SSR-guarded),
    storageKey='neotopia-auth', detectSessionInUrl:false (anon-only app · no URL fragment to
    parse · removes an async step that raced hydration).
  · src/hooks/useAuth.js — REWROTE init to drive auth ENTIRELY off onAuthStateChange. The
    INITIAL_SESSION event fires once AFTER hydration · if it carries a session we adopt that
    user (NO getSession race) · only mint an anon user when INITIAL_SESSION confirms none, once.
EVIDENCE: (1) unit test — a persisted session is adopted WITHOUT calling signInAnonymously (the
  exact churn guard) · 73 green. (2) Node two-client E2E vs LIVE Supabase — load#2 (a fresh
  client = a reload) restored the SAME user_id instead of minting a new one. Live two-tab BROWSER
  proof is T1 S5's first task (the shared Playwright browser was held by another terminal during
  my session · the fix is in · please run the 10-check two-tab E2E now).
CAVEAT for T1/T3: storageKey changed default→'neotopia-auth'. Any anon session under the OLD key
  (sb-<ref>-auth-token) is abandoned → every existing tester re-auths ONCE (harmless · sessions
  weren't persisting before anyway). Clear localStorage once if you see a stale old-key token.

## T2 → T3 (from S4)
Task C (sessionId in store) was NOT built — T3's sessionIdRef is the single owner. Stay as-is.
Read full comms before committing to any T3 task that overlaps T2.

## T3 → T1 (from S3)
roomId navigation hazard: useGameRoom unmounts on /lobby→/game navigation.
Recommended fix: no-navigation container pattern (conditional render, not route change)
OR: route param /game/:roomId + useParams()
Exact code for GameRoom loading gate:
  const phase = useGameStore(s => s.phase)
  useEffect(() => { if (phase !== 'playing') navigate('/lobby') }, [phase, navigate])
  if (phase !== 'playing') return <div>Connecting…</div>

## T3 → T1 (from S4)
Rejoin-after-refresh is FREE with route-param /game/:roomId: the URL survives a refresh → GameRoom
reads roomId from useParams → useGameSync(roomId) subscribes + fetchAndSeed restores the board.
useAuth restores the SAME anon user (room_players row + seat preserved). NO new T3 code needed.
DEV-INIT GUARD (correction): gate GameRoom auto-init on the ROUTE roomId you pass to useGameSync
(`if (!roomId) <auto-init solo dev>`), NOT on useGameStore.getState().roomId — T3 does NOT populate
store.roomId (serializableState serializes the WHOLE store; a store field would round-trip into
game_sessions.state to every client and sit dead-null). The route roomId is the clean signal.

## T3 → T2 (from S3)
player_count trigger: migration 003 SHIPPED (T3 S3 · SECURITY DEFINER · search_path='')
game_events.sequence_num: GENERATED ALWAYS AS IDENTITY · DO NOT SET EXPLICITLY (rule 30)
sequence_num fix: use DB-assigned values only, omit from INSERT payload

## T3 LESSON (S3)
E2E fully verified live (7802096). sequence_num was GENERATED ALWAYS AS IDENTITY —
information_schema showed NOT NULL no-default but didn't show IDENTITY. Fixed.

## T3 LESSON (S4)
Reconnect hardening shipped (useGameSync): window 'online' → full reconnect · visibilitychange→visible
→ fetchAndSeed reseed (mobile tab-suspend kills the WS silently). Proven live: a move missed while the
channel was dropped is recovered by fetchAndSeed on reconnect, then live updates resume.
ALSO: never run vitest in parallel with a live realtime E2E — event-loop/socket contention flaked 2
timing-sensitive tests that were 67/67 GREEN run alone. Re-run isolated before believing a regression.

## T2 → MAHIL (from S5 · ACTION: rulebook data needed to ACTIVATE bonus earn)
The earn MECHANISM is shipped + tested but DORMANT until you supply the board data (no
rulebook PDF is in the repo · I would not guess it). Provide, per region (SC / LE / FE):
  1. Bonus-hex positions + which token each grants → e.g. SC: (1,0)=subsidy, (-1,0)=initiative …
     (I'll seed hex.bonusType in initGame · covering that hex auto-awards the token.)
  2. Each region's bonus PILE for the 7/13/18 score-track marks → e.g. SC bonusPile:
     [token@7, token@13, token@18] (top-of-pile awarded on crossing · deterministic).
Once provided, activation is a ~10-line initGame seed + 3 data tests · no logic change.

## OPEN DECISIONS
- /lobby routing: T1 S4 wires it · T3 browser E2E waits on this (data layer already proven S3 + S4)
- roomId nav hazard: T3 RECOMMENDS route-param /game/:roomId (rejoin comes free) · T1 chooses · T3 adopts
- reconnect under genuine browser offline (Playwright CDP setOffline): T3 S5 (after /lobby wired)
- anon-auth persistence: ✅ FIXED T2 S6 (storageKey + INITIAL_SESSION) · live two-tab proof = T1 S5
- bonus earn paths (hex cover + score track): ✅ MECHANISM DONE T2 S5 · DATA STILL PENDING from Mahil
    (S6 Task B was a no-op · the T2→MAHIL request above is unanswered · activation is ~10 lines once data lands)
- 1-bonus-per-turn enforcement: ✅ DONE T2 S5
- permits bonus token: DEFERRED (needs outer-semicircle space model + positions · same missing data)
- Vercel deployment: confirm auto-deploy is live on main branch

═══════════════════════════════════════════════════════════
T1 S4 · VISUAL LAYER · 2026-06-25 (route-param multiplayer wiring)
═══════════════════════════════════════════════════════════

T1 S4 CHOSE route-param /game/:roomId (T3's recommendation · rejoin comes free). SHIPPED:
  · App.jsx — / → Lobby (onGameStart(roomId) → navigate(`/game/${roomId}`)) · /game/:roomId → GameRoom
    (multiplayer) · /game → GameRoom (solo dev, no realtime).
  · GameRoom.jsx — useParams roomId · useGameSync(roomId, user.id) seeds+persists · DEV solo-init now
    gated on `!roomId` (route param, NOT store.roomId · per T3) · multiplayer loading gate
    (roomId && phase!=='playing' → "Connecting…") placed AFTER all hooks (Rules of Hooks) ·
    mySeat derived from synced players via user.id · "Your turn / X's turn" header badge.
  · useGameActions.js — now useGameActions({ sync, mySeat }) · turn-gate isMyTurn (mySeat==null = solo,
    always your turn) · moves persist via sync.pushState after each committed mutation
    (place/draw/score/endTurn) · handleCardScore now uses tryScoreCard (boolean) · NEW handleDrawCard.
    All multiplayer params are OPTIONAL → solo path + the 5 unit tests unchanged (72 green).

T1 → T3 (the seam · please ACK):
  · I made a 2-LINE change to YOUR Lobby.jsx: destructure `roomId` + `onGameStart?.(roomId)` (was `()`).
    Backward-compatible (old callers ignore the arg). roomId MUST cross the boundary outside synced
    state (your words) · this is the minimal way. Move it into your lane if you prefer · the contract
    is just: Lobby fires onGameStart(roomId) when roomPhase==='playing'.
  · VERIFIED LIVE (0 console errors on fresh load): / lobby renders → claim → Create Room → code +
    roster · GameRoom seeds board+hand from game_sessions by roomId · /game solo regression intact ·
    client-side nav (pushState) mounts GameRoom without reload.
  · move-sync code path is EXERCISED: placement fires sync.pushState (proven — it attempted the
    game_sessions UPDATE + game_events INSERT). Combined with your verified member-RLS data E2E,
    real-member moves persist + stream. Turn-gating proven by 2 new deterministic unit tests.

T1 → T2 (⚠ AUTH BLOCKER · ✅ RESOLVED in T2 S6 · see "T2 → ALL (from S6)" above for the fix):
  · Supabase ANON sessions are NOT restored on full page reload · useAuth.getSession() returns a NEW
    anon user every reload (observed 4 distinct user_ids across 4 reloads), despite persistSession:true
    + autoRefreshToken:true in lib/supabase.js and the token sitting in localStorage
    (sb-…-auth-token). Net effect: a refresh of /game/:roomId mints a new user → not a room member →
    RLS 403 on game_events / 0-row game_sessions UPDATE → orphaned from their seat. This DEFEATS the
    route-param rejoin benefit AND blocked my live two-tab move-sync E2E (test user kept changing).
    Likely a getSession-vs-signInAnonymously race or anon-token refresh failing. Please investigate
    (custom storage? awaiting getSession before any signInAnonymously? anon token TTL?). Repro: load /,
    note user.id, hard-reload, note it changed.

T1 S4 STATUS: build clean · 72/72 tests green (added 2 turn-gate tests) · NO em dashes.
  VERIFIED LIVE: routing · lobby UI · GameRoom seeding · solo regression · loading gate · client-side nav.
  NOT fully E2E'd LIVE: two-tab move propagation — blocked by the anon-auth instability above (external
  to my code · code path proven to fire pushState · data layer proven by T3). HONEST: the "door" works;
  live cross-tab sync verification is gated on the T2 auth fix.

T1 SELF-RATING: forge 78/100 (literal Task A navigation = T3's lost-roomId hazard · corrected to
  route-param per T3's updated rec). Task A 47/50 · Task B 46/50 · Task C 40/50 (foundations live-verified
  · move-sync blocked by external auth bug, not my code). Session est. 255/300 (Prompt 86 + Code 169).

T1 S4 EVOLUTION LESSON: in a realtime app, "verify live" can be BLOCKED by a dependency you don't own —
  when it is, isolate the blocker precisely (here: a 403 on game_events + a changing user_id proved the
  pushState path FIRES and the wall is anon-auth, not my wiring), pin the un-greened claim to that exact
  external cause, and convert what you CAN'T exercise live into a deterministic unit test (turn-gating).
  Also: full page reload ≠ the app's client-side navigate · test the path the app actually takes.

T1 S5 FIRST TASK: once T2 fixes anon-session persistence → full two-tab browser E2E with T3 (10 checks) ·
  then ActionBar (hold-to-confirm 1000ms) + RegionLabel extraction (carried from S3).

═══════════════════════════════════════════════════════════
T1 S5 · VISUAL LAYER · 2026-06-26
═══════════════════════════════════════════════════════════

T1 S5 GATE RESULT: Task A (two-tab E2E) GATE-SKIPPED per rule 28 · the auth fix has NOT landed.
  Re-verified LIVE in-browser: load / → user 7e57cf05 · hard reload → user 0762aec5 (CHANGED, token
  was still valid ~58min). useAuth.js unchanged since commit 2429336 (T2 S2) · no auth-fix commit exists.

T1 → T2 (⚠⚠ AUTH ROOT CAUSE FOUND · exact fix · your lane · src/hooks/useAuth.js):
  I isolated it precisely (3 browser experiments):
  1. ✅ Supabase PERSISTENCE WORKS · a fresh isolated createClient() on the SAME localStorage key reads
     the stored session correctly (right user, token valid, no error). So persistSession/storage is FINE.
  2. ❌ signInAnonymously() is NOT idempotent · the code comment "returns existing anon user on
     subsequent calls" is FALSE. Proven: 3 sequential calls → 3 DISTINCT user_ids
     (0762aec5 → 6c5c75c5 → 46724d69). EVERY call mints a brand-new anon user.
  3. ROOT CAUSE = useAuth + React StrictMode (main.jsx wraps <App/> in <StrictMode>, which double-invokes
     effects in dev). useAuth's effect calls init(); the `mounted` flag guards setState but NOT the
     signInAnonymously() NETWORK call. The double-mount (and/or any load where getSession resolves before
     storage is ready) fires signInAnonymously(), which OVERWRITES the good persisted session with a
     fresh user → on reload the user is a non-member → RLS 403 → orphaned from their seat.
  THE FIX (module-level singleton so all mounts share ONE auth resolution · StrictMode-safe):
     // module scope (outside the hook):
     let authPromise = null
     function ensureAnonSession() {
       if (authPromise) return authPromise
       authPromise = (async () => {
         const { data: { session } } = await supabase.auth.getSession()
         if (session?.user) return session.user
         const { data, error } = await supabase.auth.signInAnonymously()
         if (error) throw error
         return data.user
       })()
       return authPromise
     }
     // in useAuth effect: ensureAnonSession().then(u => { if (mounted) { setUser(u); setIsLoading(false) } })
  This guarantees signInAnonymously fires AT MOST ONCE per page-load regardless of StrictMode/concurrent
  mounts, and NEVER when a session already exists. Also fix the false comment. ~10 lines · unblocks the
  whole rejoin-after-refresh + two-tab story. I did NOT touch useAuth.js (your lane) · ready for you.

T1 S5 SHIPPED (Tasks B + C · my lane · build clean · 73/73 tests · 0 console errors · live-verified):
  · src/components/ActionBar.jsx (NEW) — fixed bottom bar · LEFT turn status (solo: player name · MP:
    "Your turn"/"Waiting for X" + live dot) · CENTER 3 action dots (filled=used, tabular-nums count) ·
    RIGHT bonus-token pills (type→label+effect hint, BONUS_META for automatization/subsidy/initiative/
    permits) + End Turn (44px, enabled only at 0 actions & your turn). Replaces the header's End Turn.
  · GameRoom.jsx — slimmed header to NEOTOPIA + Turn N + scorePending banner · ActionBar mounted as the
    bottom flex child · passes currentPlayer bonusTokens + regionScores.
  · GameBoard.jsx — RegionLabel: each region label now renders NAME + the current player's SCORE beneath
    it (white, 18px, tabular-nums) · sits above the region, never over hexes. (GameBoard already owned the
    name labels · I added score, no duplicate component needed · sidebar Score list kept as the detailed
    roster view.)
  · LIVE PROOF (solo /game · 0 errors): footer "Builder · Actions · 2 · End Turn[disabled]" · place 1
    element → 1/3 action dots fill, counter 3→2 · board shows "Sacred City 0 / Living Earth 0 / Free
    Energy 0" · End Turn gone from header. (Pixel screenshot timed out under the pulsing animations · the
    accessibility-tree snapshot is the structural proof · DOM functional checks all pass.)

T1 SELF-RATING: forge 86/100 (premise "Auth fixed" false · the forge's own gate makes it self-correcting).
  Task A 45/50 (gate-skipped correctly + delivered an exact root-cause fix instead of just "still broken")
  · Task B 47/50 · Task C 45/50. Session est. 262/300 (Prompt 88 + Code 174).

T1 S5 EVOLUTION LESSON: when a forge's headline premise is FALSE ("Auth fixed"), the disciplined move is
  not to skip and shrug · it is to re-run the gate (rule 28), then spend the freed time turning the
  blocker into a PRECISE, fixable hand-off. Three cheap browser experiments converted "auth is broken"
  into "signInAnonymously isn't idempotent + StrictMode double-fires it · here's the 10-line singleton
  fix" · a diagnosis the owning lane can apply in minutes beats a vague flag every time.

T1 S6 FIRST TASK: the moment T2's useAuth singleton lands → re-run the boot auth gate · if user_id is
  stable across reload, do the full two-tab browser E2E (12 checks) with T3 · then RegionLabel polish +
  ActionBar hold-to-confirm if desired.

═══════════════════════════════════════════════════════════
T3 S5 · AUTH DIAGNOSIS + PRESENCE SEATS + ARCH DOC · 2026-06-26
═══════════════════════════════════════════════════════════

T3 S5 STATUS: docs/MULTIPLAYER_ARCHITECTURE.md shipped · 73 vitest green · build green · NO src change
  (Task A gate-skipped · Task B verification-only · Task C is the doc). DB cleaned to 0 rows.

T3 S5 TASK A · browser E2E GATE-SKIPPED (not shrugged): (1) Playwright browser HELD by T1 (running its
  own two-tab E2E). (2) auth blocker. Instead I INDEPENDENTLY root-caused the auth churn in Node:
  useAuth.init() called getSession()→signInAnonymously() with NO concurrency guard · under React
  StrictMode (main.jsx) the effect double-invokes, both see getSession()=null, 2 DISTINCT anon users
  minted in one mount (REPRODUCED: b33f17be + fe61b2f8). Verified a singleton guard dedupes to one.
  → CONVERGENCE: T1, T2, T3 all independently fingered the same cause. T2 shipped the fix (d420342 ·
    INITIAL_SESSION pattern · no getSession at all). I reviewed T2's useAuth: it RESOLVES the StrictMode
    race (cleanup unsubscribes the 1st listener before the async INITIAL_SESSION fires → only the
    survivor mints, once). ACK ✅.
  RECONNECT (Task A checks 5-6) already PROVEN at data layer in S4 · browser-offline (CDP) proof → S6.

T3 S5 TASK B · presence seat accuracy · VERIFIED LIVE (real usePresence channel path):
  room_players.seat_number === Presence seat for EVERY player (0↔0, 1↔1) · Presence carries userId +
  numeric seat · contiguous lobby→game game-seat === room_players.seat_number (by userId). ✅
  HARNESS LESSON: a harness that subscribes WITHOUT the .on('presence',{event:'sync'}) handler the real
  hook registers → presenceState() empty → false "mismatch". Mirror the real subscribe path exactly.

T3 → T2 (seat-gap edge case · your lane · cosmetic · NOT urgent): startGame passes roster to initGame,
  which assigns game seat by ARRAY INDEX. If a player leaves mid-lobby (seats [0,2]), initGame re-seats
  to [0,1] → in-game seat number + player_color differ from the lobby. Game stays consistent (identity =
  userId). To carry lobby color into the game, have initGame honor an explicit seat field. I did NOT
  make a speculative cross-lane change.

T3 → T1 (ACK seam): your 2-line Lobby.jsx change is correct — onGameStart?.(roomId) from a useEffect
  gated on (roomPhase==='playing' && roomId). Contract verified · Lobby.jsx stays T3 lane · edit is good.

T3 → ALL: docs/MULTIPLAYER_ARCHITECTURE.md is the onboarding spec (auth · room lifecycle · 3 realtime
  channels · move flow · reconnect/rejoin · RLS 001/002/003 · file map · verification status). Keep it
  current when a contract changes.

T3 S5 EVOLUTION LESSON: a test harness must subscribe/mutate the SAME way the real code does · skipping
  a step the real hook performs (here: the presence 'sync' handler before subscribe) yields FALSE
  failures that masquerade as product bugs. Prove the harness mirrors the real path before trusting red.

T3 S6 FIRST TASK: once Playwright is free + T2 auth browser-confirmed → two-tab browser reconnect E2E
  (CDP setOffline: Tab B offline · Tab A moves · Tab B online → fetchAndSeed recovers) · the definitive
  browser proof of S4's reconnect hardening.

═══════════════════════════════════════════════════════════
T1 S5 · UPDATE (auth fix landed MID-SESSION · multiplayer loop VERIFIED LIVE) · 2026-06-26
═══════════════════════════════════════════════════════════

⭐ T2's d420342 (auth: INITIAL_SESSION pattern · explicit storageKey · T2 S6) LANDED DURING my session
  and FIXES the anon-session bug I root-caused. My Task-A gate-skip was correct at gate-time (useAuth was
  unchanged then) · the premise flipped while I built B+C. After it rebased into my tree I re-ran the gate
  and PROCEEDED · the whole point of S5 is now done.

T1 → T2: ✅ AUTH FIX CONFIRMED LIVE (browser). Clean repro: clear storage → load / → user f2621443 →
  HARD RELOAD → SAME user f2621443 (was a NEW id every reload before). Your INITIAL_SESSION approach beat
  the getSession race. Thank you · this unblocked everything below.

T1 → T3: MULTIPLAYER MOVE LOOP VERIFIED LIVE through the real UI (single Playwright context · one real
  member + a simulated 2nd player via direct game_sessions writes):
  1. ✅ Host create-room → bootstrap session → client-side nav to /game/:roomId · user STAYS STABLE ·
     board seeds · mySeat derives → "Your turn" badge (NEVER worked in S4 due to the auth churn).
  2. ✅ MEMBER MOVE PERSISTS: placed energy via UI → game_sessions.state in DB has hex 0,0=energy,
     actions_remaining 3→2. This is the exact write that RLS-403'd in S4 · now a stable member, it lands.
  3. ✅ REMOTE → LOCAL SYNC: wrote a 2nd energy to game_sessions (simulated other player) → Tab A board
     rendered it via postgres_changes (3→4 tokens) within ~1.5s.
  4. ✅ REJOIN-AFTER-REFRESH: hard reload /game/:roomId → SAME user f2621443 + full board state restored
     from DB (fetchAndSeed) + "Your turn" · not stuck on the Connecting gate.
  ⚠ MINOR (your lane · useGameSync game_events): the best-effort audit insert returns HTTP 400 (not 403 ·
     so NOT permission · likely an event schema/CHECK mismatch on event_type='place' or event_data shape).
     It does NOT block sync (pushState ignores it by design · the state UPDATE succeeded) · but the audit
     log is silently empty. Worth a look when you're in useGameSync next.
  NOT verifiable with ONE Playwright context: two SIMULTANEOUS incognito humans (roster visual + both tabs
  live at once). Covered by your verified two-client data E2E (7802096) · the UI-render half is now proven
  by the above. A genuine two-context browser run is T1+T3 S6 if we want the last 10%.

T1 S5 REVISED RATING: Task A 47/50 (substantially verified live once the fix landed · only the 2-human-
  simultaneous visual deferred). Session est. 272/300 (Prompt 88 + Code 184). Shipped B+C committed at
  f4cf5b3; Task A verification is post-commit (verification, no code change).

T1 S5 EVOLUTION LESSON (revised): a false forge premise ("Auth fixed") is not a dead end · re-run the gate
  (rule 28), and if still blocked, convert the blocker into a precise hand-off (the signInAnonymously +
  StrictMode root cause) · THEN keep watching, because in this repo the blocker can be fixed by another
  lane mid-session. I rebased, saw d420342, re-ran the gate, and finished the actual goal. Gate-skip is a
  PAUSE, not an abort · re-check the gate every time the tree moves.

═══════════════════════════════════════════════════════════
T1 S6 · FINALSCORE civilization record SHIPPED · game_events 400 ROOT-CAUSED + FIXED · 2026-06-26
commit 95ce5b7 (FinalScore.jsx · GameRoom.jsx · gameStore.js · gameStore.test.js · useGameActions.js)
═══════════════════════════════════════════════════════════

FORGE SELF-RATE: 79/100 → REWRITE TRIGGERED (rule 13). The forge's provided FinalScore.jsx had THREE
  false premises (all caught by its own premise-check gates · the gates earned their keep):
  1. calculateFinalScore(regions,[player],bonusTokens)→{regionBreakdown,total} · FALSE.
     REAL: calculateFinalScore(regionalScores:number[], unusedBonusCount)→NUMBER. I derive the breakdown
     from player.scores myself and call the engine fn only for the total (single source of truth).
  2. trigger on phase==='ended' · FALSE. REAL terminal phase is 'scoring' (gameStore.endTurn). Wired to
     'scoring' · also loosened GameRoom's loading gate so 'scoring' renders the overlay not "Connecting".
  3. CTA navigate('/lobby') · FALSE. The lobby lives at '/' (App.jsx). Wired to '/'.
  Plus: forge formula showed unused x1 (REAL is unused x3) · cluster sub-line had no store data (dropped ·
  rule 32, never fabricate). Rewrote all data plumbing; kept the (strong) visual design.

TASK A (two-human E2E) · auth gate GREEN in tree (grep=5). FinalScore verified live via the app's REAL
  store instance (had to import the HMR-versioned /src/store/gameStore.js?t=... URL · a plain import() gives
  a SECOND instance the React tree doesn't subscribe to · noted for anyone scripting Playwright here). The
  genuine two-SIMULTANEOUS-incognito-humans run is still the only piece one Playwright context can't do ·
  covered by T3's two-client data E2E (7802096) + S5's live UI half. T3 S6 reconnect E2E is the place to
  add the visual two-context pass.

TASK B (FinalScore) · SHIPPED + 8/8 browser checks green (verified by extracting rendered DOM text, not a
  screenshot · screenshots time out on the 0.8s reveal transition, same as S5):
  · two player cards, sorted, FOUNDER badge · totals 44 / 34 exact · worst region amber "x 3" (Mahil Free
    Energy 4→12 · Builder Living Earth 6→18) · formula "18 + 11 + (4 x 3) + (1 x 3) = 44" exact · Districts
    Built shows card names (Solar Garden, AetherFlux Node, ...) · Global Index 147,829 (=147,823+6) ·
    CTA → '/' (confirmed pathname) · tabular-nums on totals · 0 console errors.
  · CAUGHT + FIXED a real bug live: the overlay is a column flex with overflowY:auto, so children got
    flex-shrink:1 and the 56px CTA collapsed to 20px (broke the 44px rule). Pinned flexShrink:0 on the 4
    direct children → CTA holds 56px. (Lesson candidate below.)
  · scoredCardIds: added to player state in gameStore.js (init + tryScoreCard push, guarded for older
    setState fixtures) + 1 test. THIS IS T2's LANE (src/store/) · forge-authorized one-liner · additive ·
    serializes fine for multiplayer. T2 FYI: it's there and tested · relocate/keep as you like.

TASK C (game_events 400) · ROOT-CAUSED EXACTLY + FIXED IN-LANE. CORRECTION to my S5 note: this was NOT a
  useGameSync/T3 problem and NOT an event_data shape issue · sorry for the mis-aim.
  EXACT CAUSE: CHECK constraint game_events_event_type_check allows only
    {draw_card, place_element, build_project, use_bonus, factory_refill, turn_end, game_end}.
  The emitter (useGameActions.persist · T1's OWN lane) sent {place, draw, score, endTurn} · NONE pass the
  check → Postgres 23514 → PostgREST HTTP 400 on every audit insert (exactly the "400 not 403" from S5).
  PROVEN against the live constraint (non-mutating): old names passes_check=false, new names=true.
  FIX (in useGameActions.js · my lane): place→place_element · draw→draw_card · score→build_project ·
  endTurn→turn_end. Zero consumers read the old strings (replay not built · eventType is pure pass-through),
  so safe. The audit log (game_events) will now populate → replay (psychology Priority 3) is unblocked.
  ⚠ CLAUDE.md gap: the SUPABASE SCHEMA section documents the FK + IDENTITY but NOT the event_type
  vocabulary · recommend adding the allowed set there so no one re-drifts. seat_number CHECK is 0..3 too.

T1 → T2: your S7 getGlobalIndex()/recordCivilizationContribution (f0c3737, mig 004) landed · my FinalScore
  still shows the STATIC GLOBAL_INDEX_BASE=147823. T1 S7 can wire FinalScore to call getGlobalIndex() for
  the REAL number + recordCivilizationContribution(totalProjectsBuilt) on game end. Left static this session
  to keep the commit self-contained; the swap is a clean follow-up.

T1 S6 EVOLUTION LESSON: a fixed CSS height is a REQUEST, not a guarantee · inside a flex container with
  overflow, children flex-shrink past it (my 56px CTA rendered 20px · broke the 44px rule). Always pin
  flexShrink:0 on fixed-size flex children, and VERIFY computed height in-browser, never trust the inline
  style. (Corollary held again: a precise premise-check gate turns a wrong forge into a correct ship · all
  3 false premises were caught before a single broken line ran.)

T1 S7 FIRST TASK: wire FinalScore → T2's getGlobalIndex() (real index) + recordCivilizationContribution on
  game end · then the genuine two-context visual E2E with T3 (last 10%) · then end-game polish (reveal
  stagger per player card, reduced-motion guard on the 0.8s fade).

═══════════════════════════════════════════════════════════
T3 S6 · RECONNECT E2E (CDP) + game_events 400 FIX + CI PIPELINE · 2026-06-26
═══════════════════════════════════════════════════════════

T3 S6 STATUS: 82 vitest green · build clean · TWO Playwright reconnect E2E PASS live (2x · stable, non-flaky)
  · game_events 400 ROOT-CAUSED + FIXED + unit-guarded · GitHub Actions E2E pipeline added · DB purged to 0 test rows.

T3 S6 TASK B (game_events 400 · T1 S5 handed it to me) · ROOT CAUSE FOUND + FIXED — and it was NOT the
  forge's guess. The forge prescribed "sessionIdRef is null". DISPROVEN by the evidence: a 400 means the
  row REACHED the DB (a null ref would skip the insert · no HTTP call · no 400). I premise-checked the live
  contract (pg_constraint, NOT information_schema): game_events has a CHECK
    event_type IN ('draw_card','place_element','build_project','use_bonus','factory_refill','turn_end','game_end').
  The app emits 'place'/'draw'/'score'/'endTurn' (useGameActions.persist) · NONE are in the set → 23514 → 400
  on EVERY move (exactly your S5 finding). Verified TRUE/FALSE against the live CHECK predicate for all 8
  values before writing the fix.
  FIX (my lane · src/hooks/useGameSync.js): EVENT_TYPE_DB map translates app→DB vocabulary at the
  persistence boundary (place→place_element · draw→draw_card · score→build_project · endTurn→turn_end ·
  +use_bonus/factory_refill/game_end). Unmapped types skip + dev-warn (never send a CHECK-invalid value).
  GUARD: src/hooks/useGameSync.eventmap.test.js — every emitted event maps · all values CHECK-allowed · raw
  app names are NOT themselves valid (proves we translate). No future move type can silently 400 again.
  → T1: your S5 game_events 400 flag is RESOLVED · the audit log now writes. NO change needed in
    useGameActions — your event names stay 'place'/'draw'/'score'/'endTurn'; I translate inside useGameSync.

T3 S6 TASK A (reconnect E2E) · 2 PASSING Playwright tests · the definitive BROWSER proof of S4's hardening:
  · tests/e2e/reconnect.e2e.js · playwright.config.js (testMatch '*.e2e.js' → invisible to vitest's
    *.test/*.spec include · the two runners never fight · no vite.config.js change needed).
  · Test 1 (window.online): CDP Network.emulateNetworkConditions offline → admin bumps turnNumber in the DB
    → page STILL shows the old turn (proves it's offline, not live-synced) → online → useGameSync's onOnline
    → connect()/fetchAndSeed recovers the missed turn. ✓
  · Test 2 (visibilitychange): block ONLY the realtime WS (route '**/realtime/**' abort · REST + auth stay
    reachable) → channel never SUBSCRIBES → no subscribe-time seed (Connecting gate) → dispatch
    visibilitychange→visible → onVisible's DIRECT fetchAndSeed seeds the board. Isolates the visibilitychange
    path EXACTLY (only it could have delivered). ✓
  · DESIGN: single browser context + admin-seeded REAL engine state (tests/e2e/fixtures/seededState.json,
    produced by initGame · rule 32 · not hand-fabricated) · NOT two presence-converged contexts (that flakes
    in CI). The reconnect path is read-only · a DB write is an identical stand-in for "the other player moved".
    sessions_read/rooms_read_all are public → a non-member context seeds fine · mySeat null = harmless.
    Guarded by tests/seededState.guard.test.js (fixture shape == fresh initGame · stale = fast unit fail).

T3 S6 TASK C (CI) · .github/workflows/e2e.yml · runs `npx playwright test` on push/PR to main with the
  VITE_SUPABASE_* secrets · uploads the report on failure · node 22 (matches canary.yml).
  ACTION (Mahil · one-time): add VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY as GitHub Actions secrets at
  https://github.com/mahilh/neotopia/settings/secrets/actions (they're in .env.local · the anon key is
  public-by-design · safe as a CI secret). canary.yml already references the same two secrets · until they
  exist, the E2E job will fail at the Supabase calls (not a code bug).

T3 → ALL (E2E cleanup limitation · a cross-lane RLS decision · NOT taken unilaterally this session):
  RLS has NO DELETE policy on game_rooms/game_sessions (a host can only soft-close to 'finished'). So the
  E2E afterEach soft-cleans (mark 'finished' + delete own room_players) · it CANNOT hard-delete. In CI this
  leaves inert 'finished' test rooms (tagged username 'E2E_BOT' · indistinguishable from real finished games ·
  harmless). I hard-purged THIS session's rows via service role (signature: all-zero player UUIDs). OPTION
  for a future session: add a host-scoped `rooms_delete_host` DELETE policy (USING host_id = auth.uid()) →
  cascade cleans session+events+players · enables full CI cleanup. Safe + minimal · flagged, not assumed.

T3 S6 EVOLUTION LESSON: a forge's prescribed FIX can be wrong even when its INTENT is right · the evidence
  disambiguates. An HTTP status is a witness — 400 (not 403, not "no request fired") PROVES the insert
  reached the DB, so the cause is the payload (a CHECK), never a missing FK that would have skipped the call.
  Read the status, then premise-check the LIVE constraint (pg_constraint · information_schema hides CHECKs),
  and verify the fix against the actual predicate BEFORE writing a line. Diagnosis from evidence beats
  diagnosis from a plausible guess every time (rule 30/31 in action).

T3 S7 FIRST TASK: if Mahil wants the last 10% · the genuine TWO-context (two simultaneous humans) browser
  E2E of the full lobby→ready→start→move→sync loop with T1 · and/or ship the `rooms_delete_host` policy for
  clean CI cleanup.

═══════════════════════════════════════════════════════════
T2 S8 · rooms_delete_host (migration 005) + game_end audit payload · 2026-06-26
═══════════════════════════════════════════════════════════

T2 S8 STATUS: migration 005 APPLIED LIVE + verified against the real anon role · gameEndEvent.js (game_end
  audit payload builder) + 6 tests · 91 green (11 files, full working tree) · build clean. Forge self-rated
  80/100 → rewrote (Task A apply method, Task C lane + payload). DB cleaned to 0 test rows (self-cleaning verify).

### ✅ Task A · rooms_delete_host · CLAIMED + DONE (T3: I took this · you took the two-human E2E · no dupe)
  scripts/migrations/005_rooms_delete_host.sql · applied via Supabase MCP (same path as 001-004 · NOT the
  dashboard · the forge's node "_sql" apply snippet is inert · ignore it). The policy:
    create policy rooms_delete_host on public.game_rooms for delete
      using (host_id = auth.uid() and status = 'finished');
  · No TO clause · matches the sibling rooms_update_host exactly (the local idiom · DELETE grant to
    anon+authenticated already exists from migration 001). Scope ⊂ rooms_update_host · adds NO new exposure
    (get_advisors before/after: identical lint set · rooms_delete_host just joins game_rooms' existing
    auth_allow_anonymous_sign_ins note · no new SECURITY DEFINER warning).
  · CASCADE verified live (pg_constraint.confdeltype='c'): room_players + game_sessions → game_rooms, and
    game_events → game_sessions. So ONE host delete of a finished room removes its players + session +
    events. FK cascades run as table owner + BYPASS child-table RLS → this ONE policy is sufficient · no
    child DELETE policies needed.
  · LIVE PROOF (real anon JWT · two anon clients · self-cleaned to 0 rows): cross-user delete=0 (host
    scoping holds) · waiting-status delete=0 (finished-only holds) · host+finished delete=1 (works).
  → T3: your E2E afterEach can now HARD-clean: mark the room status='finished' (rooms_update_host) then
    delete it (rooms_delete_host) · the whole game tree cascades away. No more inert 'finished' CI rooms.
    (My verifier did exactly this · update→finished then delete → cascade · landed at 0 rows.)

### ✅ game_events double-fix regression · I FOUND IT INDEPENDENTLY AT BOOT · you are ALREADY fixing it (convergence)
  At boot (stale read) I traced: useGameActions emitted DB-valid names (place_element…) while EVENT_TYPE_DB
  keyed on shorthand (place…) → EVENT_TYPE_DB['place_element']=undefined → every audit insert SKIPPED → log
  silently empty (no 400, nothing written). Before flagging it I re-read your CURRENT files (rule 38) and
  found T1 S7 + T3 S7 are CLOSING it right now · so this is a 3rd-lane CONFIRMATION, not a new flag:
    · T3 S7 added resolveDbEventType() (passes already-valid DB names through · still translates legacy
      shorthand · new DB_ALLOWED export · regression-guard test). ✅ correct · this fully resolves it.
    · T1 S7 reverted useGameActions.persist back to shorthand (place/draw/score/endTurn). ✅ also fine under
      the new resolver (either convention now yields a CHECK-valid row).
  NOTHING further needed from you · just confirming the fix matches what I independently root-caused. The
  one thing to KEEP: resolveDbEventType's pass-through branch (DB_ALLOWED_SET.has) is what saves it · don't
  revert to a translate-only map.

### ✅ Task C · game_end audit payload · src/lib/gameEndEvent.js (T2 lane · pure · collision-free)
  The capstone of "every move is recorded": when phase→'scoring', ONE client should append a game_end row to
  game_events (final score per player + districts built · the permanent civilization record for replay).
  I built the PURE payload (no network write · rule 32 · I do NOT fire it · the consumer does):
    import { buildGameEndEvent } from '../lib/gameEndEvent'   // src/components → '../lib/gameEndEvent'
    const { eventType, eventData } = buildGameEndEvent(useGameStore.getState())
    sync.pushState(eventType, eventData)   // eventType='gameEnd' → resolveDbEventType → 'game_end' ✓ (CHECK-valid)
  · final total per player via calculateFinalScore (the SAME engine fn getFinalScore/FinalScore use · single
    source of truth · the forge's payload referenced a non-existent player.total · there is no such field).
  · payload: { version, final_scores:[{seat,user_id,username,scores,unused_bonus,districts,total}] ranked
    desc, districts_built (=global-index contribution), winner_seat }. No client timestamp · game_events
    .created_at defaults now() server-side (verified live).
  · SEAM GUARD test asserts EVENT_TYPE_DB['gameEnd']==='game_end' AND it's in the CHECK set · the exact
    assertion class that would have caught the S6 double-fix (an emitted key not in the map → silent skip).
  → T1: natural home is FinalScore's reveal effect · fire it in the SAME localStorage-guarded one-shot you
    use for recordCivilizationContribution(totalProjectsBuilt), LOCAL player only, so a reload during
    'scoring' can't double-write. (You own the consumer · I own the payload · same split as the Global Index.)
  → T3 (alt): if you'd rather fire it from useGameSync on the phase→scoring transition, the builder is yours
    to call too · whoever wires it, pass eventType='gameEnd' (NOT 'game_end' raw · let the resolver map it).

### ⏳ Task B · bonus earn DATA · STILL UNANSWERED from Mahil (3rd session pending · see T2→MAHIL above L155)
  No new data in comms · no code change (correct · rule 32 · never guess board data). Mechanism shipped+tested
  T2 S5 (hex.bonusType cover-award in placeElement · region.bonusPile top-award in tryScoreCard · both seeded
  empty · no-op until data). Activation stays ~10 lines once Mahil supplies hex positions + 7/13/18 piles.

### ⚠ CLAUDE.md DOC-DRIFT (someone with the CLAUDE.md lane please fix · I did not touch it this session)
  ENGINE ARCHITECTURE + DB CONTRACT name the migration-004 functions `neotopia_global_index_aggregate` /
  `neotopia_increment_index`. The LIVE + committed names are `get_global_neotopia_index` /
  `increment_neotopia_index` (verified live · both exist · global index = 0). The S8 forge's premise-check #1
  inherited the wrong name and would have falsely reported MISSING. Fix the doc so no one re-drifts.

### T2 S8 EVOLUTION LESSON (extends rule 38)
  Before writing a cross-lane BUG FLAG in comms, re-read the target lane's CURRENT files · in a live repo the
  bug you found at boot may already be fixed by its owner THIS session. At boot I had an airtight root-cause of
  the game_events regression and was about to flag it 🔴. Rule 38's re-read showed T1+T3 were mid-fix · so the
  right artifact was a CONVERGENCE confirmation ("you've got it · keep the pass-through branch"), not a flag
  that sends the owner to re-investigate a closed issue. A stale flag is worse than no flag · verify a bug
  still exists against HEAD-of-tree, not boot-of-session, and prefer confirming a fix over re-raising it.

═══════════════════════════════════════════════════════════
T3 S7 · TWO-HUMAN FULL-LOOP E2E · game_events SILENT-EMPTY FIX · LAUNCH-READINESS · 2026-06-26
commit 44c449b (useGameSync.js · useGameSync.eventmap.test.js · tests/e2e/two-human.e2e.js · docs/T3_LAUNCH_READINESS.md)
═══════════════════════════════════════════════════════════

T3 S7 STATUS: 91 vitest green (11 files · whole tree incl. in-flight lanes) · build clean · two-human
  E2E (2 tests · all 8 checks) STABLE 2x live · game_events audit regression FIXED + guarded · migration
  005 wired into E2E cleanup. Forge self-rate 86/100 (sound gates; Task A code had 5 premise errors I
  corrected against real DOM · the forge licenses exactly that).

T3 S7 PRIORITY FIX (found during gates · NOT in the forge) · game_events audit log was SILENTLY EMPTY.
  Convergence with T2 S8's note (✓ you confirmed the pass-through branch — thank you, that's exactly it):
  T1 S6 renamed useGameActions to emit DB-valid names (place_element/…) while T3 S6 added a translate-ONLY
  map keyed on the OLD shorthand (place/…). Run together every insert MISSED the map → skipped → ZERO rows
  written (no 400 · the dev-warn branch · invisible). FIX (my lane · useGameSync.js): resolveDbEventType()
  passes an already-valid DB name straight through AND still translates legacy shorthand · output verified
  vs the LIVE CHECK · locked by useGameSync.eventmap.test.js (6 cases incl. the exact passthrough guard).
  → game_events writes again · REPLAY is unblocked (the audit log finally has data).

T3 S7 TASK A · tests/e2e/two-human.e2e.js · the genuine two-human proof (last 10%) · STABLE 2x:
  · Two SEPARATE browser contexts run the real lobby loop through the UI: host create → joiner join-by-code
    → joiner ready → host start → BOTH land on the live board. That IS real realtime (presence convergence
    + game_start broadcast · the path S6 avoided as flaky · made reliable here). Both reveal the civilization
    record (2055 / Global NeoTopia Index / CTA) from the shared synced state.
  · Rejoin test: a hard reload keeps the SAME anon user_id (auth persistence · Bug 13) AND restores the
    board (reconnect seed) · proven together in-browser (stronger than the forge asked).
  · 5 FORGE PREMISE ERRORS corrected vs real DOM (rule 36 · the forge's code was a sketch): Cmd+F → real
    Cmd+Shift+E · host has NO ready button (only the joiner readies) · solo Start is DISABLED (<2 players)
    · window.__neotopiaDiagnostics doesn't exist (read localStorage 'neotopia-auth') · [text=…] is invalid
    Playwright + the dev key sets phase LOCALLY (per-tab · NOT propagated · honest scope noted).
  · LESSON baked in: player_profiles.username is UNIQUE · a fixed E2E name passes run 1 and CRASHES run 2
    (claim rejected → lobby never advances → unbounded click ate the full 60s). Unique per-run names fixed
    it · this is what looked like "presence flakiness" but was a deterministic cross-run collision.

T3 S7 TASK B · migration 005 rooms_delete_host (T2 · verified LIVE: host_id=auth.uid() AND status='finished')
  wired into E2E cleanup(): admin-owned test rooms mark finished → delete → FK cascade clears
  room_players+game_sessions+game_events in one statement. Best-effort (no-op if 005 absent). Test 1's
  BROWSER-owned rooms + player_profiles rows are still unreachable from the Node client (RLS) · tagged
  'E2E…' for a service-role purge · documented in docs/T3_LAUNCH_READINESS.md (not silently dropped).

T3 S7 TASK C · docs/T3_LAUNCH_READINESS.md · T3 evidence-based launch view (what T3 can PROVE vs what other
  lanes own vs what remains: terminal-phase-over-the-wire, cross-machine smoke, CI secrets, domain).

T3 → T1 (entry flow · FYI, no action): your in-flight Landing ('/' → Landing · '/lobby' → Lobby) + FinalScore
  getGlobalIndex wiring were UNCOMMITTED while I wrote the E2E. two-human.e2e.js is RESILIENT to both the
  committed '/'→Lobby contract and your new flow (gotoLobby uses the real "Enter the Civilization" CTA when
  present). When you commit, CI exercises the same path I validated live. Gate 3 (getGlobalIndex in
  FinalScore) — you're already on it, so no note needed beyond this.

T3 → Mahil (still the only blocker for CI green): add GitHub Actions secrets VITE_SUPABASE_URL +
  VITE_SUPABASE_ANON_KEY · the two-human + reconnect E2E jobs fail at the Supabase calls until then (not a
  code bug). Anon key is public-by-design · safe as a CI secret.

T3 S7 EVOLUTION LESSON (extends rule 38/25): "two lanes both fixed it" can ADD a bug the combination owns.
  T1 and T3 each correctly fixed the S5 game_events 400 · independently · and the union (rename + translate-
  only map) produced a NEW silent-skip regression neither fix had alone. When you discover another lane
  touched the same surface, don't just re-read for collisions — TRACE the composed behaviour end to end
  (what does the value actually equal after BOTH edits?). And: a flaky-looking E2E failure deserves the
  root-cause before the timeout bump · mine was a deterministic UNIQUE-constraint collision wearing a
  presence-flakiness costume · the snapshot (not a retry) told the truth in one read.

T3 S8 FIRST TASK: terminal-phase-over-the-wire E2E (drive game_sessions.phase='scoring' from a MEMBER client
  → assert BOTH contexts render FinalScore via postgres_changes · the one piece two-human.e2e leaves to a
  local per-tab trigger) · and/or a service-role test-data purge job so E2E rooms/profiles stop accruing.

═══════════════════════════════════════════════════════════
T1 S7 · REAL GLOBAL INDEX + LANDING FRONT DOOR + COLLISION RESOLVED · 2026-06-26
═══════════════════════════════════════════════════════════

T1 S7 STATUS: commit fbfb87c (5 files) · build clean · 91 vitest green (with all WIP) · live-verified
  in browser (Landing + routing + FinalScore real-index fetch 200 + 0 console errors). Ran a 20-agent
  adversarial review of my own diff before commit · fixed every real finding (a11y, StrictMode, reduced-motion).

T1 S7 TASK A (real Global NeoTopia Index): FinalScore.jsx now reads getGlobalIndex() (real aggregate ·
  POST /rpc/get_global_neotopia_index → 200 verified live) instead of the static 147823 seed · displays
  (liveIndex ?? seed) + this game's totalProjectsBuilt. RECORD path wired too: each client records ONLY
  its OWN seat's districts (recordCivilizationContribution(myDistricts)) exactly once · so the global sum
  is exact across players · NEVER N× over-counted (the trap T2's own comment warned about · rule 32).
  Verified both RPCs live: get_global_neotopia_index() + increment_neotopia_index(amount int) · SECURITY
  DEFINER · EXECUTE granted anon+authenticated. Solo (mySeat null) skips the record (no increment POST ·
  confirmed in the network log) so dev games never pollute the real index. GameRoom passes mySeat.

T1 S7 TASK B (Landing front door): NEW src/pages/Landing.jsx at '/' with the canonical copy from
  docs/NEOTOPIA_LANDING_PAGE.md (hero · The Game 3 cards · Diverse City · The Purpose · live Global Index ·
  final CTA · footer). ROUTING RESTRUCTURE (App.jsx): '/' → Landing · Lobby relocated to '/lobby' ·
  added catch-all '*' → Landing (no blank SPA screen). FinalScore + Landing CTAs route to '/lobby'.
  Voice honored: 0 exclamation marks · '·' not em dashes. SPA fallback already covers '/lobby' (vercel.json).

T1 → T3 (event_type · the S6 double-fix collision · RESOLVED · your resolveDbEventType is the authority):
  Confirmed your diagnosis exactly · we BOTH found the silent-skip (long names + translate-only map = zero
  rows). I reverted useGameActions.persist() back to SHORT names (place/draw/score/endTurn) · they flow
  through your EVENT_TYPE_DB (committed) AND your in-flight resolveDbEventType (legacy path). I chose SHORT
  over keeping my S6 long names because SHORT is robust across EVERY commit ordering: it writes a CHECK-valid
  row against the CURRENTLY-COMMITTED translate-only useGameSync too · long names only work once your
  resolveDbEventType lands. Heads-up: your eventmap.test EMITTED_NOW=['place_element',...] comment ("what
  useGameActions emits TODAY") is now stale · the loop emits your LEGACY set again. Test stays GREEN either
  way (both groups guarded) · just relabel EMITTED_NOW↔LEGACY when convenient. No code change needed from you.

T1 → T2 (gameEndEvent.* is yours · untouched): FinalScore now consumes your getGlobalIndex /
  recordCivilizationContribution (f0c3737) · per-seat record, read-before-record sequencing intent kept.
  If gameEndEvent emits a 'game_end' game_events row on phase→scoring, that's complementary · the FinalScore
  record is a profile-index side effect, not a game_events row · no overlap.

T1 S7 EVOLUTION LESSON (extends rule 38): a boot collision check is not just "did a file change" · when two
  lanes touched the SAME seam, TRACE THE COMPOSED BEHAVIOUR (what does the value equal after BOTH edits?) ·
  T3 and I independently reached this. And when picking between two valid fixes at a shared seam, choose the
  one robust across COMMIT ORDERINGS (works against the other lane's CURRENTLY-COMMITTED state, not only its
  in-flight state) · that's what made SHORT names correct even if T3's commit is delayed. Second: a green
  test suite can be FALSE confidence when a guard pins a stale constant (EMITTED_NOW / APP_EVENTS_EMITTED) ·
  the test mirrors intent, not the live emit path (rule 36) · verify the real wiring in-browser, not just the unit.

T1 S8 FIRST TASK: end-game polish · per-player FinalScore card reveal stagger (reduced-motion-guarded ·
  helper already in FinalScore) · and the genuine TWO-context visual E2E with T3 (drive phase→scoring from a
  MEMBER client · assert BOTH browsers render FinalScore + BOTH record their own seat → index moves by the
  full game). Optional: lift the FinalScore overlay's low-opacity decorative borders to WCAG 1.4.11 (3:1).
