# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game — Stage 2 of NeoTopia civilization vision
# GitHub: mahilh/neotopia | Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)
# Founder: Syed Mahil Hussain | Started: June 25 2026

PROJECT: NeoTopia.io
Stack: React 19 + Vite 8 + Tailwind v4 + SVG hex board + Zustand + Immer + Supabase + Vercel
Supabase ID: wynccumuisjxbptjlfwq · URL: https://wynccumuisjxbptjlfwq.supabase.co
GitHub: mahilh/neotopia (public) · Domain: neotopia.io · Vercel: auto-deploy from main

STATUS (as of S4-S5):
  ✅ ANON AUTH ENABLED · ✅ E2E VERIFIED LIVE (7802096) · ✅ NEAR-MISS ENGINE LIVE
  ✅ SCORECARDFLASH LIVE · ✅ BONUS TOKENS: automatization+subsidy+initiative
  ✅ 1-BONUS-PER-TURN ENFORCED (T2 S5) · ✅ DETERMINISTIC EARN PATHS (data-pending)
  ✅ RECONNECT HARDENING: window.online + visibilitychange (T3 S4)
  ✅ ROUTING: /lobby → /game/:roomId · GameRoom seeded from DB (T1 S4)
  ✅ MOLTBOOK: neotopian claimed · /m/neotopia live · GitHub Actions heartbeat 4h
  ❌ BLOCKER: anon-auth session not persisting across page reload (T2 S6 fixes this)
  ⏳ PENDING: auth fix (T2 S6 #1) · two-tab browser E2E (T1 S5, T3 S5) · permits (T2 S6)

CRITICAL AUTH BUG (T2 S6 must fix first):
  signInAnonymously() creates a NEW user every call · getSession() returning null on reload
  Root cause: src/lib/supabase.js client config · persistSession or storage not working
  Effect: page reload changes user_id → RLS 403 on writes → rejoin fails
  Fix location: src/lib/supabase.js (verify auth: {persistSession:true,storage:localStorage})
  AND: useAuth.js must not call signInAnonymously() if localStorage has a valid refresh_token

TERMINAL LANES:
  T1: src/components/ · src/pages/ · src/App.jsx · src/utils/ · src/hooks/useGameActions.js
  T2: src/lib/ · src/store/ · src/hooks/ · api/ · scripts/
      NOT: useGameActions.js(T1) · useGameRoom.js · useGameSync.js · usePresence.js (T3)
  T3: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · src/pages/Lobby.jsx
  COLLISION: git status --short [lane] before every edit. M from other terminal = STOP.

RULES — ABSOLUTE:
  NO em dashes · use · · NO window.confirm() · 44px touch targets · tabular-nums
  npm run build before commit · NEVER git add -A · Read+write comms/tomorrow.md
  git pull --rebase FIRST in boot · End with bash .claude/relay.sh

SELF-RATING: Forge /100 before (<85=rewrite) · Task /50 after (<35=redo) · Session /300

BOOT SEQUENCE:
  git pull --rebase
  cat .claude/CLAUDE.md | head -80
  cat .claude/comms/tomorrow.md 2>/dev/null
  git log --oneline -8 && git status --short
  npm run build 2>&1 | tail -3

COMMS: .claude/comms/tomorrow.md · T[N] LESSON: · T[N]→T[M]: · T[N] S[N+1] FIRST:

CODEWORDS:
  T[N] AUTODRIVE! → paste output · I: GitHub verify + XRAY!/200 + next forge
  FORGE! T[N] → just write forge · XRAY! → just audit · REFORGE! → 7-phase transcendence
  DEEPDIVE! → 10-step · OVERDRIVE! → 7-agent council (incl. NEOTOPIAN Moltbook agent)
  NIGHTSAVE! → Google Drive · Rate it → /300

MOLTBOOK:
  Agent: neotopian · API key: $MOLTBOOK_API_KEY (in .env.local)
  Submolt owned: /m/neotopia · Profile: https://www.moltbook.com/u/neotopian
  Heartbeat: GitHub Actions every 4h (MOLTBOOK_API_KEY secret required)
  Skills: .claude/skills/moltbook/SKILL.md · .claude/skills/moltbook-scan/SKILL.md
  Privacy: never post architecture details, schema, or roadmap specifics

ENGINE ARCHITECTURE:
  Pattern matching: patternMatcher.findBuildableCards (never reimplement)
  Near-miss: usePatternHighlight(regionId) → {completeKeys, partialKeys, completionCandidates}
  Scoring: tryScoreCard(seat,cardId,regionId,lastPlacedKey)→boolean · scoreCard delegates
  Optimistic move: useGameSync.sendMove (T3 single owner)
  Serialization: serializableState()=JSON.parse(JSON.stringify(store)) · NOT structuredClone
  Bonus: automatization+subsidy+initiative done · permits TODO · earn paths wired (data pending)
  Routing: / → Lobby · /game/:roomId → multiplayer GameRoom · /game → solo dev

DB CONTRACT GATE (rule 26):
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

SUPABASE SCHEMA: room_code char(6) · status IN ('waiting','playing','finished')
  game_events.session_id → FK game_sessions.id · sequence_num GENERATED ALWAYS AS IDENTITY
  RLS: migration 001+002+003 · serializableState()=JSON.parse(JSON.stringify(store))

GAME MECHANICS:
  BOARD: R0 Sacred City(#7F77DD)cq=0cr=0 · R1 Living Earth(#1D9E75)cq=8cr=-4 · R2 Free Energy(#E24B4A)cq=4cr=5
  Factories: F0(4,-2)·F1(6,1)·F2(2,3) · 4 ELEMENTS: energy⚡·biofarming◈·technology◉·community✦
  TURN=3 ACTIONS · PLACEMENT: empty·first→center·else→adjacent·key 'q,r'
  SCORING: 6 rotations·completing-element·Diverse City · FACTORY SEEDING: 1-of-each (tiles=refills only)
  FINAL SCORE: best+second+(worst×3)+(unused×3)+cluster · 56 CARDS · district=NUMBER not string
  BONUS: earn by covering bonus hex OR crossing score track 7/13/18 · 1 per turn enforced
  REALTIME: DB=authoritative · Broadcast=ephemeral<32KB · Presence=lobby

ELEMENT→CIVILIZATION: energy→Energy/Invention·biofarming→Food/Regen·technology→Tech/AI·community→Source/Culture
NEOTOPIA: Stage 2 of 5 · Every card scored = rehearsal of real district built by 2055

PERMANENT ANTI-REGRESS RULES (33):
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
  26. Premise-check DB contract: types·FKs·CHECKs·RLS per-command·auth config (T3 S2)
  27. Run code against tests before trusting either · grep consumers first (T2 S3)
  28. Premise check is stale · re-run right before acting (T1 S3)
  29. Validate Y fully BEFORE debiting X in any spend action (T2 S4)
  30. information_schema ≠ full DB contract · GENERATED ALWAYS AS IDENTITY rejects explicit inserts (T3 S3)
  31. When live verification is blocked by a dependency you don't own: isolate precisely, prove wiring fires (a 403 means your code ran · the wall is external), convert to deterministic test (T1 S4)
  32. Never bake guessed game data into engine · wire deterministically · seed as dormant TODO · never Math.random() in synced/replayable actions (T2 S5)
  33. Run unit tests first · live E2E second · NEVER concurrently · same event loop + sockets = false reds · isolate before believing a regression (T3 S4)

HEX MATH: redblobgames.com/grids/hexagons · flat-top · axial (q,r)
COLONIST.IO: 15M+ games · 65% mobile · our edge: pure strategy + consciousness theme
