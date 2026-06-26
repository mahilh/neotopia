# NEOTOPIA SESSION LOG
# Complete record of every session · all three terminals · June 25-26 2026
# Auto-maintained by AUTODRIVE! · updated each session

## PROJECT VITALS

Started: June 25 2026
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Live URL: neotopia.vercel.app
GitHub: mahilh/neotopia
Tests at last commit: 73 green
Build status: clean

---

## SESSION RATINGS HISTORY

| Terminal | Session | Rating | Commit | Key Milestone |
|----------|---------|--------|--------|---------------|
| T1 | S1 | 168/200 | — | Board renders · 13 tests |
| T2 | S1 | 186/200 | — | 40 tests · engine complete |
| T2 | S2 | 163/200 | — | Rotation fixed · getValidPlacements · useAuth |
| T1 | S2 | 155/200 | — | 4-step placement flow · browser verified |
| T3 | S2 | 180/200 | — | 6 DB blockers found+fixed · RLS policies |
| T2 | S3 | 190/200 | — | usePatternHighlight near-miss engine |
| T3 | S3 | 178/200 | 7802096 | TWO-CLIENT E2E VERIFIED LIVE |
| T1 | S3 | 167/200 | — | Near-miss UI · ScoreFlash civilization moment |
| T2 | S4 | 188/200 | de6db8d | tryScoreCard boolean · subsidy+initiative bonus |
| T3 | S4 | 178/200 | 4a1f1d8 | visibilitychange reconnect · reconnect hardening |
| T1 | S4 | 163/200 | e76c017 | Route-param routing · GameRoom seeded from DB |
| T2 | S5 | 188/200 | e0d1194 | 1-bonus-per-turn · deterministic earn paths |
| T3 | S5 | 175/200 | 661f78b | Architecture doc 214 lines · presence seats verified |
| T1 | S5 | 168/200 | f4cf5b3 | ActionBar · RegionLabel · multiplayer loop VERIFIED |
| T2 | S6 | 190/200 | d420342 | AUTH FIXED · INITIAL_SESSION · highest-rated session |

---

## MAJOR MILESTONES (chronological)

### Milestone 1 · Board Renders (T1+T2 S1)
Date: June 25 2026 · Sessions: T1 S1 + T2 S1
The SVG hex board renders. 3 regions visible. Element tokens place correctly.
13 tests passing. The foundation exists.

### Milestone 2 · Two-Client E2E Verified Live (T3 S3)
Date: June 25 2026 · Commit: 7802096
Two anonymous clients connected to the same Supabase room.
Move by Client A → Client B board updates in real time.
This proved the entire multiplayer architecture works.

### Milestone 3 · Near-Miss Engine Live (T2 S3)
Date: June 25 2026 · Commit: ~T2 S3
usePatternHighlight finds buildable cards in any rotation.
Partial pattern highlighting shows players how close they are.
This is the psychological hook that makes the game compelling.

### Milestone 4 · Vercel Deployment (between S4-S5)
Date: June 25 2026 · URL: neotopia.vercel.app
The game is publicly accessible. The civilization is online.
Auto-deploys on every push to main.
SPA rewrites via vercel.json — all routes serve index.html.

### Milestone 5 · Auth Fixed — INITIAL_SESSION Pattern (T2 S6)
Date: June 25 2026 · Commit: d420342
The critical blocker that was preventing rejoin and two-tab E2E.
Root cause: getSession() raced against localStorage hydration.
Fix: drive auth entirely off onAuthStateChange INITIAL_SESSION event.
signingIn flag prevents StrictMode double-mount double-mint.
Same user_id confirmed across page reloads via Node two-client test.

### Milestone 6 · Multiplayer Loop Verified (T1 S5)
Date: June 25 2026 · Commit: f4cf5b3
Full multiplayer loop verified live through real UI:
  ✅ Member move persists to DB
  ✅ Remote move syncs to local board via postgres_changes
  ✅ Rejoin-after-refresh restores user + board
  ✅ mySeat / 'Your turn' derives correctly

### Milestone 7 · Moltbook Agent Live (June 25 2026)
Agent: neotopian · Claimed by Mahil via @knowbrandd
Submolt: /m/neotopia · First post published and verified
GitHub Actions heartbeat: every 4 hours
Top target: consciousness-chain (365 karma)

---

## EVOLUTION LESSONS (one per session · permanent)

### From T1 sessions:
S2: Read the other lane's module right before integration — memory of its API is always stale
S3: Premise check is stale the moment you move on — re-run right before acting
S4: 403 = wiring fired · the wall is external · isolate, prove, convert to deterministic test
S5: Gate-skip is a pause, not an abort — re-check the gate when the tree moves

### From T2 sessions:
S1: useCallback deps must never include the store object reference
S2: Rotation must be applied before scoring — never trust pattern orientation from memory
S3: Run code against tests before trusting either — grep consumers first
S4: Validate Y fully before debiting X in any spend action
S5: Never bake guessed game data into the engine — never Math.random() in synced actions
S6: Prove the data layer half when browser is unavailable — pin the browser half to its owner

### From T3 sessions:
S2: Premise-check DB contract: types, FKs, CHECKs, RLS per-command, auth config, is_identity
S3: information_schema != full contract — GENERATED ALWAYS AS IDENTITY rejects explicit inserts
S4: Run unit tests first, live E2E second — never concurrently — interleaving = false reds
S5: Test harness must mirror real code setup path exactly — skipping a step = false failure

---

## ANTI-REGRESS RULES (all 36 · cumulative)

1.  NEVER git add -A · pathspec from git status
2.  NO em dashes · use ·
3.  NO window.confirm() · hold-to-confirm
4.  44px touch targets
5.  tabular-nums on game numbers
6.  npm run build before commit
7.  PREMISE CHECK — read files before prescribing
8.  pixelToHex paired with hexToPixel
9.  Pattern rotation before scoring
10. Cluster BFS before final scoring
11. Production tile structure before factory logic
12. Diverse City needs region.lastBuiltIllustration
13. Rate forge /100 before · <85=rewrite
14. Rate task /50 after · <35=redo
15. ONE evolution lesson per session
16. Server is source of truth for scoring
17. No @ in bash globs · node -e
18. 'permission denied' != 'does not exist'
19. Raw SQL needs GRANT
20. Known-cause gate + independent tasks = parallel
21. Broadcast max 32KB · signal only
22. Zustand → Supabase must be JSON-serializable
23. useCallback deps never include store reference
24. Channel MUST be removed before new one
25. Re-read other lane's module right before integration
26. Premise-check DB contract: types·FKs·CHECKs·RLS per-command·auth config
27. Run code against tests before trusting either · grep consumers first
28. Premise check is stale · re-run right before acting
29. Validate Y fully BEFORE debiting X in any spend action
30. information_schema != full DB contract · GENERATED ALWAYS AS IDENTITY rejects explicit inserts
31. When live verification blocked by external dependency: isolate precisely, prove wiring fires (403 = code ran), convert to deterministic test
32. Never bake guessed game data into engine · wire deterministically · seed as dormant TODO · never Math.random() in synced/replayable actions
33. Run unit tests first · live E2E second · NEVER concurrently · same event loop = false reds
34. Gate-skip is a pause not an abort · re-check gate when tree moves
35. Prove data layer when browser unavailable · never claim 'fixed live' when only 'data-proven'
36. Test harness must mirror real code setup path exactly · skipping any step = false failure

---

## SKILLS CREATED (this project)

| Skill | Version | Rating | Purpose |
|-------|---------|--------|----------|
| reforge | v1.0 | 167/200 | 7-phase prompt transcendence |
| overdrive | v2.0 | 182/200 | 7-agent LLM Council · all evidence-mandated |
| skillupgrade | v1.0 | new | 6-phase skill improvement protocol |
| scanskills | v1.0 | new | Background skill inspector · runs in AUTODRIVE! |
| supabase-patterns | v1.1 | new | 13 bugs documented + prevented |
| neotopia-forge-patterns | v1.0 | new | 10 forge quality patterns |
| moltbook | v1.12 | 153/200 | API integration + security |
| moltbook-scan | v1.0 | 116/200 | Daily heartbeat scan |
| _registry/INDEX.md | v1.1 | — | Master skill index with ratings |

---

## WHAT'S PENDING

### T1 S6 (forge written · ready to paste):
- Full two-human browser E2E (12-check sequence)
- FinalScore.jsx — civilization record screen with Global NeoTopia Index
- game_events 400 diagnosis → comms for T2/T3

### T2 S7 (forge written · ready to paste):
- game_events 400 fix (sessionId null at first pushState)
- scoredCardIds + end-game phase transition (phase='ended')
- Global NeoTopia Index counter (getGlobalIndex() in supabase.js)
- Bonus activation when Mahil provides rulebook bonus hex positions + pile data

### T3 S6 (forge written · ready to paste):
- Playwright CDP offline/online reconnect test (real test file)
- GitHub Actions E2E pipeline (.github/workflows/e2e.yml)
- Two GitHub secrets needed: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY

### MAHIL MUST PROVIDE (blocking bonus activation):
- Bonus hex positions per region (axial q,r coordinates from physical board)
- Which token type per bonus spot (subsidy/automatization/initiative/permits)
- Score track pile order for 7/13/18 thresholds per region

---

## GOOGLE DRIVE STATUS

Master Context doc ID: 1gs4EgKyG0oFZKE5X0nsc3OFzUVDajPN5lBMchNCP7_I
Last synced: June 25 2026 (session start state)
Needs update: React 19 (not 18) · 36 rules · all sessions · Moltbook · Vercel · auth fix
Update method: manual copy from GOOGLE_DRIVE_UPDATE_SUMMARY.md in this repo
