# NeoTopia Cross-Terminal Comms
# Updated automatically each session
# ALL terminals read this on boot

## HOW GIT PULL WORKS (permanent note)
Git is file-based. ~/NeoTopia/.git is SHARED between all terminals on disk.
One `git pull` in ANY terminal (Mac terminal, T1, T2, T3) updates the shared .git refs.
Every forge boot sequence now starts with `git pull --rebase` — you never need to pull manually.
If unsure: run `bash ~/NeoTopia/start.sh` from Mac terminal before opening Claude Code tabs.

## SESSION STATUS (S6 in progress)
Last verified HEAD: T2 S6 (anon-auth persistence FIX) / e76c017 (T1 S4) / 4a1f1d8 (T3 S4)
Tests: 73 green · Build: clean · E2E: ✅ data-layer live · two-tab move-sync now UNBLOCKED (auth fixed)

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
