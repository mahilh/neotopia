# T2 S14 MASTER FORGE · GLOBAL INDEX + BONUS EARN DATA
# NeoTopia · June 27 2026 · post S13 · bot v4.4 live · DB-verified placed count catching mismatch
# Forge self-rate /200 BEFORE touching any file. <85 = rewrite.
# T2 lane: src/lib/ · src/store/ · src/hooks/ · api/ · scripts/ · migrations/

## S13 WHAT SHIPPED
  28 esoteric card names + descriptions (c09f81d): verified by diff-gate, 102 tests green
  Bot v4.4 (5d1f782): zero ready-failed errors, rate-limit retry implemented
  DB-verified placed count: proxy 21 vs DB 19 mismatch CAUGHT — Rule 53 self-enforcing

## KEY RULE FROM S13
  Rule 56: A prescriptive forge can carry a wrong schema.
  Verify column names live (information_schema + sample row) before coding DB queries.
  The forge guessed board_state/room_code. Reality: state/room_id/regions[].hexes[].element.
  30-second verification saved hours of debugging a silent null-returning verifier.

## SESSION GOAL
  Task A: Bonus earn data integration (7th request — FIRST TASK, cannot proceed without Mahil data)
  Task B: Global NeoTopia Index v1 — accumulate civilization scores across all games
  Task C: Close the proxy gap at source — only count placement once DB hex token confirms

---

## GATES

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -60
  VERIFY: Rule 56 (schema verification) is in the rules list
  HARD STOP if any rule you are about to violate appears here.

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -60
  VERIFY: T1 is on FinalScore + art pipeline. T3 is on comms cleanup + bot race.
  HARD STOP if T1 or T3 has claimed any src/lib/ or src/store/ file mid-session.

Gate 3 (5 min):
  cat src/lib/projectCards.js | head -30  (verify 56 cards, all esoteric names are in)
  cat src/store/gameStore.js | grep -n 'bonus\|earn\|bonusToken\|BONUS' | head -20
  cat src/lib/supabase.js  (env vars, client setup — read before touching)
  VERIFY: bonusTokens exist in the store. How are they structured?
  Answer before touching anything:
    □ What does a bonusToken object look like?
    □ Where is bonusEarned triggered in the store?
    □ Is there a game_events entry for bonus earn?

Gate 4: npx vitest run 2>&1 | tail -6 · 102 green required
Gate 5: npm run build 2>&1 | tail -4 · 0 errors required
Gate 6: git log --oneline -8 && git status --short
  VERIFY HEAD = origin/main. Only T2 files in working tree.
Gate 7: READ THE PHYSICAL BOARD GAME RULES for bonus earn paths.
  cat docs/ART_DIRECTION_PIXEL.md | head -20  (bonus data is pending from Mahil)
  If Mahil has NOT provided the bonus hex position data: SKIP Task A and do Task B first.
  Document the skip clearly in comms. Do not invent bonus data.

---

## TASK A · Bonus Earn Data Integration
# Target: 49/50 · CONDITION: only if Mahil provides hex coordinates today
# 7th request for this data. It is the only remaining data dependency.

WHAT IS NEEDED FROM MAHIL:
  The physical Neotopia board game has bonus token positions on each region.
  Mahil needs to provide: axial (q,r) coordinates per region where bonus tokens spawn,
  the token types (Government Subsidy / Automatization / Private Initiative / New Building Permits),
  and the pile order for the 7 / 13 / 18 score threshold bonuses.

IF MAHIL PROVIDES THE DATA TODAY:
  1. Add to src/lib/boardLayout.js (or wherever the board geometry lives):
     BONUS_POSITIONS = { region0: [{q, r, type}], region1: [...], region2: [...] }
  2. Verify against the existing board rendering: bonus positions must land on real hex cells
  3. Wire to the game store: when an element is placed on a bonus hex, earn the token
  4. Wire to the score track: at 7/13/18 points on a region's score track, give the top bonus
  5. Test with the bot: a bot run should now earn bonuses and report them

IF MAHIL HAS NOT PROVIDED THE DATA:
  Write to comms: "T2 S14: Task A skipped — bonus hex data still pending from Mahil."
  Move to Task B immediately.
  Do NOT guess or invent bonus positions. (Rule 7: read the source before prescribing)

---

## TASK B · Global NeoTopia Index v1
# Target: 48/50 · Every game contributes to the civilization's global record

WHAT IT IS:
  The Global NeoTopia Index accumulates civilization scores across ALL games ever played.
  When the game ends, each player's scores contribute to a global table.
  This is the first bridge between the game (Stage 2) and the real civilization (Stage 5).

PREMISE CHECK (Gate 7 approach):
  Read src/components/FinalScore.jsx to understand how the game-end event is currently handled.
  Read src/lib/gameEndEvent.js to see what data is sent to Supabase at game end.
  VERIFY: Is there a 'global_index' or 'civilization_scores' table in the DB?
  If NOT: create migration 009.

MIGRATION 009 (if table doesn't exist):
  Create: migrations/009_global_neotopia_index.sql

  CREATE TABLE IF NOT EXISTS global_neotopia_index (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    session_id UUID REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id UUID REFERENCES auth.users(id),
    username TEXT NOT NULL,
    sacred_city_score INT NOT NULL DEFAULT 0,
    living_earth_score INT NOT NULL DEFAULT 0,
    free_energy_score INT NOT NULL DEFAULT 0,
    total_score INT NOT NULL DEFAULT 0,
    cards_built INT NOT NULL DEFAULT 0,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE global_neotopia_index ENABLE ROW LEVEL SECURITY;
  -- Anyone can read the index (it's a public civilization record)
  CREATE POLICY "global index readable by all"
    ON global_neotopia_index FOR SELECT USING (true);
  -- Only the record's own player can insert
  CREATE POLICY "players insert own records"
    ON global_neotopia_index FOR INSERT
    WITH CHECK (auth.uid() = player_id);

GATE: Before creating migration, run:
  SELECT table_name FROM information_schema.tables WHERE table_name LIKE '%global%' OR table_name LIKE '%index%'
  to confirm the table doesn't already exist.

INTEGRATION in src/lib/gameEndEvent.js:
  After the existing game-end write, add:
  // Write each player's contribution to the Global NeoTopia Index
  for (const player of players) {
    const scores = player.scores ?? [0, 0, 0]
    await supabase.from('global_neotopia_index').insert({
      session_id: sessionId,
      player_id: player.userId,
      username: player.username,
      sacred_city_score: scores[0] ?? 0,
      living_earth_score: scores[1] ?? 0,
      free_energy_score: scores[2] ?? 0,
      total_score: scores.reduce((a,b) => a+b, 0),
      cards_built: player.hand?.length ?? 0,  // or use scored card count if available
    })
  }

VERIFY in Supabase Studio:
  After a bot run that reaches game-end: check global_neotopia_index table.
  It should have rows for each player in the game.

COMMIT:
  git add migrations/009_global_neotopia_index.sql src/lib/gameEndEvent.js
  git commit -m 'feat(db): global NeoTopia Index v1 · migration 009 · civilization records across all games · NeoTopia T2 S14'

---

## TASK C · Close Proxy Gap At Source
# Target: 46/50 · Rule 53: make the proxy honest

PROBLEM:
  Bot v4.4 caught: proxy said 21, DB said 19 — 2 over-count.
  Root cause: the proxy counter increments when the placement UI step completes,
  not when the hex element token commits to the DB.
  The extra 2 are placements where the UI registered success but DB didn't persist.

FIX IN scripts/bot-simulate.js:
  Instead of incrementing `placed++` when the 4-step UI completes,
  read the board state BEFORE the placement, then AFTER, and only increment if the count grew:

  const beforeCount = await getBoardElementCount(page)  // read DOM hex-element-in tokens
  await doPlacementFlow()  // factory → element → region → hex
  await delay(800)  // wait for DB commit round-trip
  const afterCount = await getBoardElementCount(page)
  if (afterCount > beforeCount) placed++
  else log('[WARN] placement UI claimed success but board element count did not grow')

  getBoardElementCount reads: page.locator('[data-testid="hex-element-in"]').count()
  (This testid was added by T3 S12's placement-commit guard.)

EVIDENCE GATE:
  Run bot. Proxy count and DOM-element-count should now agree.
  Run db verify: proxy should now match DB (or be within 1 for timing).

COMMIT:
  git add scripts/bot-simulate.js
  git commit -m 'fix(bot): close proxy gap · count only DB-committed placements via hex-element-in token · NeoTopia T2 S14'

---

## RULES (non-negotiable)
  NEVER git add -A · pathspec only
  NEVER touch: src/components/ · src/pages/ · tests/e2e/ · src/hooks/useGameRoom*
  NEVER commit .claude/comms/
  Rule 56: verify schema live before coding any DB query
  Run vitest after every change: 102 green required

## SELF-RATE
  Task A /50 (or 0/50 if skipped per Mahil pending data) · Task B /50 · Task C /50
  Session /300 · Forge /200 retroactive
  Evolution lesson → .claude/comms/tomorrow.md · FILESYSTEM ONLY
