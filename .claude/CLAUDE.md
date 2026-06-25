# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# Domain: neotopia.io | GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Started: June 25 2026 | Founder: Syed Mahil Hussain | Born: Oct 9 2003 | Houston TX

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq (ap-south-1 Mumbai) | URL: https://wynccumuisjxbptjlfwq.supabase.co
GitHub: mahilh/neotopia (public) | Domain target: neotopia.io
Vercel: auto-deploy from main branch

SUPABASE AUTH STATUS: ✅ ANON SIGN-IN ENABLED (toggled June 25 2026 · session 3)
  Full E2E multiplayer flow is NOW unblocked. Create/Join/Start/Move all work.

TERMINAL LANES (strict — check before every edit):
  T1: src/components/ src/pages/ src/App.jsx src/utils/ src/hooks/useGameActions.js
  T2: src/lib/ src/store/ src/hooks/ api/ scripts/
       NOT owned: useGameActions.js(T1) · useGameRoom.js(T3) · useGameSync.js(T3) · usePresence.js(T3)
  T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · src/pages/Lobby.jsx
  COLLISION RULE: git status --short [your lane] before every edit. M from other terminal = STOP.
  LANE AMBIGUITY: src/hooks/ → T2 broadly. Specific files above owned by T1/T3.

RULES — ABSOLUTE:
  NO em dashes (—) · use · instead always
  NO window.confirm() · hold-to-confirm (1000ms)
  44px minimum touch targets everywhere
  tabular-nums on ALL game numbers
  npm run build MUST pass before commit
  NEVER git add -A · pathspec re-derived from git status at commit time
  ALWAYS read comms/tomorrow.md on boot · write to it at session end
  ALWAYS end with bash .claude/relay.sh

SELF-RATING (mandatory):
  FORGE self-rate /100 BEFORE any task · <85 = stop and rewrite (not just surface)
  TASK rate /50 after each task · <35 = redo
  SESSION /300 (Prompt/100 + Code/200) · ONE evolution lesson per session

BOOT SEQUENCE:
  cat .claude/CLAUDE.md | head -80
  cat .claude/comms/tomorrow.md 2>/dev/null
  git log --oneline -8 && git status --short
  npm run build 2>&1 | tail -3

COMMS: .claude/comms/tomorrow.md · T[N] LESSON: · T[N] → T[M]: · T[N] S4 FIRST TASK:

CODEWORDS (permanent):
  T[N] AUTODRIVE! → paste output · I: GitHub verify + XRAY! /200 + next forge (no session # needed)
  FORGE! T[N]     → just write next forge · XRAY! [thing] → just audit
  REFORGE!        → 7-phase prompt transcendence · .claude/skills/reforge/SKILL.md
  DEEPDIVE!       → 10-step enforced analysis
  OVERDRIVE!      → 6-agent LLM Council (BRUTUS/SOPHIA/MARCUS/ISABELLA/KARPATHY/CAESAR)
  NIGHTSAVE!      → save to Google Drive · Rate it → /300 session rating

DB CONTRACT GATE (rule 26 — run BEFORE any Supabase code):
  Column types · FK targets · CHECK/UNIQUE constraints
  RLS per-command (not just GRANTs) · auth-provider config
  Supabase: https://supabase.com/dashboard/project/wynccumuisjxbptjlfwq

SUPABASE SCHEMA (verified T3 S2):
  room_code: char(6) CHECK(length=6) · NOT 4-char
  status CHECK IN ('waiting','playing','finished') · NOT 'lobby'/'closed'
  game_events.session_id → FK game_sessions.id (uuid) · NOT room_id
  RLS INSERT/UPDATE game_sessions + game_events: migration 002 (membership-scoped)
  serializableState(): JSON.parse(JSON.stringify(store)) · NOT structuredClone (throws on functions)
  sessionId cached in useGameSync.sessionIdRef · fetched via fetchAndSeed on subscribe

ENGINE ARCHITECTURE (T2 S2-S3):
  Single pattern-matching owner: patternMatcher.findBuildableCards (never reimplement)
  Near-miss engine: usePatternHighlight (hypothetical placement via findBuildableCards)
    completeKeys: Set · partialKeys: Set · completionCandidates: [{cardId,missingKey,requiredType,filledKeys}]
  Optimistic move owner: useGameSync.sendMove (T3 · snapshot→mutate→persist→rollback)
  scoreCard: returns void · tryScoreCard (T2 S4): returns boolean success signal

═══════════════════════════════════════════════════════
RED ERROR PREVENTION — 4 PERMANENT RULES
═══════════════════════════════════════════════════════
RE-1: NEVER @ in bash globs → node -e
RE-2: "permission denied" ≠ "does not exist" · diagnose first
RE-3: Raw SQL needs explicit GRANT · migration 001
RE-4: Known-cause gate + independent tasks = proceed in parallel

SUPABASE GATE DIAGNOSIS:
  node --input-type=module <<'EOF'
  import { createClient } from '@supabase/supabase-js'
  import { readFileSync } from 'fs'
  const env = Object.fromEntries(readFileSync('.env.local','utf8').trim().split('\n')
    .filter(l=>l&&!l.startsWith('#'))
    .map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
  const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  const {data:u,error:ae} = await s.auth.signInAnonymously()
  console.log('anon auth:', ae?'❌ '+ae.message:'✅ '+u.user.id.slice(0,8))
  for (const t of ['player_profiles','game_rooms','game_sessions','room_players','game_events']) {
    const {error} = await s.from(t).select('count').limit(1).single()
    console.log(t+':', !error?'✅':error.message.includes('does not exist')?'❌ MISSING':'⚠️ '+error.message.slice(0,50))
  }
  EOF

═══════════════════════════════════════════════════════
GAME MECHANICS
═══════════════════════════════════════════════════════
  BOARD: Region 0 Sacred City(#7F77DD)cq=0cr=0 · Region 1 Living Earth(#1D9E75)cq=8cr=-4 · Region 2 Free Energy(#E24B4A)cq=4cr=5
  Factories: F0(4,-2) between 0+1 · F1(6,1) between 1+2 · F2(2,3) between 0+2
  4 ELEMENTS: energy(red #E24B4A ⚡) · biofarming(green #1D9E75 ◈) · technology(purple #7F77DD ◉) · community(blue #378ADD ✦)
  TURN = EXACTLY 3 ACTIONS: draw card (Offer/deck) OR move element factory→adjacent region
  PLACEMENT: empty hex · first→center · else→adjacent to existing · key 'q,r'
  SCORING: 6 rotations · completing-element rule · Diverse City (no same illustration consecutive per region)
  FACTORY SEEDING: 1-of-each at start · production tiles = REFILLS ONLY
  FINAL SCORE: best + second + (worst×3) + (unusedBonus×3) + cluster bonus
  56 PROJECT CARDS: 12×2pt 18×3pt 18×4pt 8×5pt · src/lib/projectCards.js
  REALTIME: DB changes=authoritative · Broadcast=ephemeral <32KB · Presence=lobby

ELEMENT → CIVILIZATION:
  energy→Energy/Invention · biofarming→Food/Regeneration · technology→Tech/AI · community→Source/Culture

NEOTOPIA: Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055
Global NeoTopia Index: individual games → civilization metrics

PERMANENT ANTI-REGRESS RULES (27):
  1.  NEVER git add -A · pathspec from git status
  2.  NO em dashes · use ·
  3.  NO window.confirm() · hold-to-confirm
  4.  44px touch targets
  5.  tabular-nums on game numbers
  6.  npm run build before commit
  7.  PREMISE CHECK — read files before prescribing
  8.  pixelToHex ALWAYS paired with hexToPixel
  9.  Pattern rotation must exist before scoring
  10. Cluster BFS must exist before final scoring
  11. Production tile structure before factory logic
  12. Diverse City needs region.lastBuiltIllustration
  13. Rate forge /100 before executing · <85 = rewrite (hard stop, not just surface)
  14. Rate task /50 after · <35 = redo
  15. ONE evolution lesson per session → comms
  16. Server is source of truth for scoring
  17. NEVER @ in bash globs · node -e (S1)
  18. "permission denied" ≠ "does not exist" (S1)
  19. Raw SQL needs GRANT (S1)
  20. Known-cause gate + independent tasks = parallel (S1)
  21. Broadcast max 32KB · signal only (REFORGE! T3)
  22. Zustand → Supabase must be JSON-serializable (REFORGE! T3)
  23. useCallback deps never include store reference (T2 S1)
  24. Channel MUST be removed before creating new one (REFORGE! T3)
  25. Re-read other lane's module RIGHT BEFORE integration (T1 S2)
  26. Premise-check DB contract before any Supabase code: types · FKs · CHECKs · RLS per-command · auth config (T3 S2)
  27. When a forge ships code + tests, run the code against the tests before trusting either.
      Grep consumers — parallel terminal may have already built the same thing differently. (T2 S3)

HEX MATH: redblobgames.com/grids/hexagons · flat-top · axial (q,r)
  Neighbors (flat-top): (1,0)(1,-1)(0,-1)(-1,0)(-1,1)(0,1)

COLONIST.IO BENCHMARK: 15M+ games · 65% mobile · our edge: pure strategy + consciousness theme
