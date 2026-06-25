# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: Syed Mahil Hussain | Started: June 25 2026

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq · URL: https://wynccumuisjxbptjlfwq.supabase.co
GitHub: mahilh/neotopia (public) · Domain: neotopia.io · Vercel: auto-deploy from main

STATUS (as of S3-S4):
  ✅ ANON AUTH ENABLED (June 25 2026)
  ✅ TWO-CLIENT E2E VERIFIED LIVE (commit 7802096 · T3 S3)
  ✅ NEAR-MISS ENGINE LIVE (usePatternHighlight · T2 S3)
  ✅ SCORECARDFLASH LIVE (ScoreFlash civilization moment · T1 S3)
  ✅ BONUS TOKENS: automatization + subsidy + initiative (T2 S4)
  ⏳ PENDING: /lobby route (T1 S4) · permits (T2 S5) · browser UI E2E (T3 S4)

TERMINAL LANES:
  T1: src/components/ · src/pages/ · src/App.jsx · src/utils/ · src/hooks/useGameActions.js
  T2: src/lib/ · src/store/ · src/hooks/ · api/ · scripts/
      NOT: useGameActions.js(T1) · useGameRoom.js · useGameSync.js · usePresence.js (T3)
  T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · src/pages/Lobby.jsx
  COLLISION: git status --short [lane] before every edit. M from other terminal = STOP.
  AMBIGUITY: src/hooks/ → T2 broadly. Named T1/T3 files above override.

RULES — ABSOLUTE:
  NO em dashes · use · (middle dot)
  NO window.confirm() · hold-to-confirm (1000ms)
  44px touch targets everywhere
  tabular-nums on all game numbers
  npm run build before commit
  NEVER git add -A · pathspec from git status at commit time
  Read comms/tomorrow.md on boot · write at session end
  End with bash .claude/relay.sh

SELF-RATING: Forge /100 before tasks (<85=rewrite) · Task /50 after (<35=redo) · Session /300

GIT PULL — FULLY AUTOMATED:
  BOOT SEQUENCE now starts with git pull --rebase (line 1 below).
  start.sh handles Mac terminal pull: bash ~/NeoTopia/start.sh (run ONCE before opening tabs).
  Terminals handle mid-session sync via git pull --rebase --autostash before every push.
  You never need to manually git pull. Everything is automated.

BOOT SEQUENCE (run at start of every session — first line is git pull):
  git pull --rebase                              ← FIRST — syncs from main before anything
  cat .claude/CLAUDE.md | head -80
  cat .claude/comms/tomorrow.md 2>/dev/null
  git log --oneline -8 && git status --short
  npm run build 2>&1 | tail -3

COMMS: .claude/comms/tomorrow.md · T[N] LESSON: · T[N]→T[M]: · T[N] S[N+1] FIRST:

CODEWORDS:
  T[N] AUTODRIVE! → paste output · I: GitHub verify + XRAY!/200 + next forge (no session # needed)
  FORGE! T[N] → just write forge · XRAY! [thing] → just audit
  REFORGE! → 7-phase transcendence · .claude/skills/reforge/SKILL.md
  DEEPDIVE! → 10-step analysis · OVERDRIVE! → 6-agent LLM Council · NIGHTSAVE! → Google Drive
  Rate it → /300 session rating

ENGINE ARCHITECTURE:
  Pattern matching: patternMatcher.findBuildableCards (never reimplement)
  Near-miss: usePatternHighlight(regionId) → {completeKeys, partialKeys, completionCandidates[{cardId,missingKey,requiredType,filledKeys}]}
  Scoring owner: tryScoreCard(seat,cardId,regionId,lastPlacedKey)→boolean · scoreCard delegates
  Optimistic move: useGameSync.sendMove(mutate,eventType,eventData)→boolean (T3)
  Serialization: serializableState()=JSON.parse(JSON.stringify(store)) · NOT structuredClone
  Bonus: automatization · subsidy(draw 2 Offer-first) · initiative(place from reserve) · permits(TODO)
  1-bonus-per-turn: NOT YET BUILT (T2 S5) · Bonus earn paths: NOT YET BUILT (T2 S5)

DB CONTRACT GATE (rule 26 — before ANY Supabase code):
  Column types · FK targets · CHECK/UNIQUE · RLS per-command · auth config · is_identity (rule 30)
  Dashboard: https://supabase.com/dashboard/project/wynccumuisjxbptjlfwq
  node --input-type=module <<'EOF'
  import { createClient } from '@supabase/supabase-js'
  import { readFileSync } from 'fs'
  const env = Object.fromEntries(readFileSync('.env.local','utf8').trim().split('\n')
    .filter(l=>l&&!l.startsWith('#')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
  const s = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
  const {data:u,error:ae} = await s.auth.signInAnonymously()
  console.log('anon auth:', ae?'❌ '+ae.message:'✅ '+u.user.id.slice(0,8))
  for (const t of ['player_profiles','game_rooms','game_sessions','room_players','game_events']) {
    const {error} = await s.from(t).select('count').limit(1).single()
    console.log(t+':', !error?'✅':error.message.includes('does not exist')?'❌ MISSING':'⚠️ '+error.message.slice(0,50))
  }
  EOF

SUPABASE SCHEMA (verified T3 S2-S3):
  room_code: char(6) CHECK(length=6) · status CHECK IN ('waiting','playing','finished')
  game_events.session_id → FK game_sessions.id (uuid · NOT room_id)
  game_events.sequence_num: GENERATED ALWAYS AS IDENTITY · DO NOT set explicitly (rule 30)
  RLS: migration 001(GRANT) · 002(INSERT/UPDATE policies) · 003(player_count trigger)
  migration 003: SECURITY DEFINER + SET search_path='' + schema-qualified

RED ERROR PREVENTION:
  RE-1: No @ in bash globs → node -e · RE-2: "permission denied" ≠ "does not exist"
  RE-3: Raw SQL needs GRANT · RE-4: Known-cause gate + independent tasks = parallel

GAME MECHANICS:
  BOARD: Region 0 Sacred City(#7F77DD)cq=0cr=0 · Region 1 Living Earth(#1D9E75)cq=8cr=-4 · Region 2 Free Energy(#E24B4A)cq=4cr=5
  Factories: F0(4,-2) bet 0+1 · F1(6,1) bet 1+2 · F2(2,3) bet 0+2
  4 ELEMENTS: energy(red #E24B4A ⚡) · biofarming(green #1D9E75 ◈) · technology(purple #7F77DD ◉) · community(blue #378ADD ✦)
  TURN=3 ACTIONS: draw card OR move element factory→adjacent region
  PLACEMENT: empty · first→center · else→adjacent · key 'q,r'
  SCORING: 6 rotations · completing-element · Diverse City (no same illustration consecutive)
  FACTORY SEEDING: 1-of-each at start · tiles=REFILLS ONLY
  FINAL SCORE: best+second+(worst×3)+(unused×3)+cluster
  56 CARDS: 12×2pt 18×3pt 18×4pt 8×5pt · district field is NUMBER not string
  BONUS TOKENS: earn by covering bonus hex OR crossing score track 7/13/18
  REALTIME: DB changes=authoritative · Broadcast=ephemeral<32KB · Presence=lobby

ELEMENT → CIVILIZATION: energy→Energy/Invention · biofarming→Food/Regeneration · technology→Tech/AI · community→Source/Culture
NEOTOPIA: Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055

PERMANENT ANTI-REGRESS RULES (30):
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
  13. Rate forge /100 before · <85=rewrite (hard stop)
  14. Rate task /50 after · <35=redo
  15. ONE evolution lesson per session
  16. Server is source of truth for scoring
  17. No @ in bash globs · node -e (S1)
  18. "permission denied" ≠ "does not exist" (S1)
  19. Raw SQL needs GRANT (S1)
  20. Known-cause gate + independent tasks = parallel (S1)
  21. Broadcast max 32KB · signal only (REFORGE!)
  22. Zustand→Supabase must be JSON-serializable (REFORGE!)
  23. useCallback deps never include store reference (T2 S1)
  24. Channel MUST be removed before new one (REFORGE!)
  25. Re-read other lane's module right before integration (T1 S2)
  26. Premise-check DB contract: types · FKs · CHECKs · RLS per-command · auth config (T3 S2)
  27. Run code against tests before trusting either · grep consumers first (T2 S3)
  28. Premise check is stale the moment you move on · re-run right before acting (T1 S3)
  29. For any "spend X to do Y" action, validate Y fully BEFORE debiting X (T2 S4)
  30. information_schema ≠ full DB contract · GENERATED ALWAYS AS IDENTITY rejects explicit inserts (T3 S3)

HEX MATH: redblobgames.com/grids/hexagons · flat-top · axial (q,r)
COLONIST.IO: 15M+ games · 65% mobile · our edge: pure strategy + consciousness theme
