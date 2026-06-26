# NeoTopia.io — Google Drive Master Context UPDATE
# Date: June 25 2026 (end of first full build session)
# This file summarizes all progress for manual update to the Google Drive master doc
# Google Drive doc: https://docs.google.com/document/d/1gs4EgKyG0oFZKE5X0nsc3OFzUVDajPN5lBMchNCP7_I

---

## WHAT HAS CHANGED SINCE THE GOOGLE DRIVE DOC WAS WRITTEN

The Google Drive doc was written at the start of June 25 2026. Everything below happened after.

### STATUS UPDATE

**Stage 2 is not just planned. It is substantially built.**

From the Google Drive doc: "Stage 2: Website + Digital (neotopia.io · the game) ← building now"

Updated status:
✔ Game board renders with 3 regions + 3 factories + elements
✔ Pattern matching engine (6-rotation, cluster BFS, final scoring)
✔ 56 project cards with civilization names
✔ 4-step placement flow (factory → element → region → hex)
✔ ScoreCard trigger + ScoreFlash civilization moment
✔ Near-miss engine (amber glow when 1 hex away from scoring)
✔ Lobby: create room / join room / presence roster / ready / start
✔ Two-client E2E VERIFIED LIVE (commit 7802096)
✔ Auth persistence fixed (INITIAL_SESSION pattern)
✔ Route-param routing /game/:roomId (rejoin after refresh works)
✔ Reconnect hardening (window.online + visibilitychange)
✔ ActionBar: turn status · action dots · bonus tokens
✔ RegionLabel: region name + score on board
✔ Bonus tokens: automatization + subsidy + initiative implemented
✔ 1-bonus-per-turn enforced
✔ Deterministic earn paths (pending rulebook hex position data)

**IN PROGRESS (S6-S7):**
⏳ FinalScore screen (civilization record + worstxd73 visual)
⏳ Global NeoTopia Index live counter
⏳ game_events 400 fix
⏳ Two-human browser E2E (T1 S6)
⏳ CDP offline reconnect Playwright test (T3 S6)

### TECHNICAL STACK CORRECTION

Google Drive doc says: React 18
Actual: React 19 + Vite 8

Google Drive doc says: Framer Motion for animations
Actual: CSS keyframes only (hexPulse, hexDrop, hexScoreFlash in index.css)

Google Drive doc says: pgvector enabled
Actual: Standard Supabase PostgreSQL (no vector embedding yet)

### NEW SYSTEMS CREATED

- **Moltbook**: neotopian agent claimed · /m/neotopia submolt live · GitHub Actions heartbeat every 4h
- **8 Claude skills** created and committed to .claude/skills/
- **36 anti-regress rules** accumulated across all sessions
- **SKILLUPGRADE! / SCANSKILLS! / REFORGE! / OVERDRIVE! v2.0** all permanent codewords
- **start.sh** one-command session startup script
- **relay.sh** automated session relay with T[N] AUTODRIVE! format

### VERCEL DEPLOYMENT

Status: LIVE at neotopia.vercel.app
Auto-deploy: every git push to main branch
Environment variables: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
SPA rewrite: vercel.json serves index.html for all routes (React Router works)

### 3-TERMINAL WORKFLOW UPDATE

Google Drive doc's terminal lanes have been updated:
- T1 now owns src/hooks/useGameActions.js explicitly
- T3 owns specific hooks: useGameRoom.js · useGameSync.js · usePresence.js
- All commits use explicit pathspec (never git add -A)
- All sessions end with: bash .claude/relay.sh → paste with T[N] AUTODRIVE!

### SUPABASE SCHEMA UPDATE

All 5 tables active with RLS:
- Migration 001: GRANT permissions
- Migration 002: INSERT/UPDATE RLS policies (membership-scoped)
- Migration 003: player_count trigger (SECURITY DEFINER + SET search_path='')

Key constraints discovered (not in original doc):
- room_code: char(6) CHECK(length=6)
- status CHECK IN ('waiting','playing','finished')
- game_events.sequence_num: GENERATED ALWAYS AS IDENTITY
- game_events.session_id: FK to game_sessions.id (uuid, not room_id)

### CODEWORD UPDATE

The Google Drive doc's codeword list is outdated. Current permanent codewords:
- T[N] AUTODRIVE! → verify + XRAY!/200 + next forge (no session # needed)
- FORGE! T[N] → write next forge
- XRAY! → audit /200
- REFORGE! → 7-phase prompt transcendence
- OVERDRIVE! → 7-agent council (ALL with evidence mandates)
- SKILLUPGRADE! → destroy weakest skills + rebuild + push
- SCANSKILLS! → background skill inspector
- NIGHTSAVE! → Google Drive update
- Rate it → /300 session rating

### GLOBAL NEOTOPIA INDEX

Base seed: 147,823
Real aggregation: pending T2 S7 implementation
Display: on FinalScore screen + neotopia.io landing page

---

## RECOMMENDED GOOGLE DRIVE DOC UPDATES

1. Update STATUS section to reflect what's built vs what's planned
2. Correct React version to React 19
3. Add Moltbook to active systems
4. Add vercel.app URL
5. Update codeword list
6. Add the 9-District / 56-card table if not present
7. Add 3-terminal workflow update
8. Add Supabase schema constraints discovered
9. Add Global NeoTopia Index section
10. Add Session Log reference (docs/SESSION_LOG.md in GitHub)
