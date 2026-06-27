# T3 S14 MASTER FORGE · INFRASTRUCTURE CLEANUP + BOT RACE
# NeoTopia · June 27 2026 · post S13 · CI live · 7/7 E2E green · rejoin proven
# Forge self-rate /200 BEFORE touching any file. <85 = rewrite.
# T3 lane: src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/

## S13 WHAT SHIPPED
  CI workflow (6df6e32): e2e-placement-guard.yml green in 49s · e2e.yml scoped to reconnect
  Rejoin proof (df6df83): free-rejoin proven with persistence witness · new reconnect test green
  E2E audit: 7/7 PASS · game-ux(1) + two-human(2) + reconnect(3) + phase-over-wire(1)

## KEY RULE FROM S13
  Rule 57: Distinguish a product bug from a harness race before patching the product.
  A persistence witness (a second client receiving via postgres_changes) converts
  'product or test?' into a deterministic gate. Prove before patching. (T3 S13)

## HONEST FLAGS RAISED IN S13 (fix these today)
  1. Comms tracked-but-gitignored: git check-ignore shows no rule — file is still tracked.
     The 'M' state is the consequence. The fix (git rm --cached + .gitignore) was deferred
     to a quiescent team moment. That moment is NOW (S14 start, all terminals clean).
  2. Bot room lifecycle race: bot rooms are transient. dbPlacedCount reads the wrong room
     because the room is deleted before the query runs. T2's dbVerified was unreliable.
  3. Close-during-persist edge: closing mid-persist loses the move (narrow, logged, not patched).

## SESSION GOAL
  Task A: Fix comms tracked-but-gitignored (the infrastructure issue that causes M state)
  Task B: Fix bot room race (coordinate with T2 — this is a shared infra issue)
  Task C: Bot health CI assertion (use T2's summary.dbVerified in a GitHub Actions check)

---

## GATES

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -60
  VERIFY: Rules 55/56/57 are in the list
  VERIFY: COMMS policy says filesystem-local, NEVER commit
  HARD STOP if any rule you are about to violate appears here.

Gate 2 (3 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -60
  VERIFY: T1 is on FinalScore/art pipeline/landing. T2 is on Global Index + bonus data.
  HARD STOP if another terminal has claimed .github/workflows/ or tests/e2e/ mid-session.

Gate 3 (5 min):
  git ls-files .claude/comms/  (verify current tracking state)
  git check-ignore -v .claude/comms/tomorrow.md  (understand why it's tracked vs gitignored)
  cat .gitignore | grep comms  (find the rule)
  ls .github/workflows/  (what CI workflows exist)
  cat .github/workflows/e2e-placement-guard.yml | head -20  (confirm S13's workflow is correct)
  Answer before coding:
    □ Is .claude/comms tracked or untracked in git ls-files?
    □ What does git check-ignore say about it?
    □ What .gitignore entry covers it (or doesn't)?

Gate 4: npx vitest run 2>&1 | tail -6 · 102 green required
Gate 5: npm run build 2>&1 | tail -4 · 0 errors required
Gate 6: git log --oneline -8 && git status --short
  VERIFY HEAD = origin/main. No T1/T2 files in working tree.
Gate 7: Review T2's bot report structure:
  cat scripts/bot-simulate.js | grep -n 'dbVerified\|totalPlacedDB\|summary\.' | head -20
  Understand the exact field names before writing a CI assertion.

---

## TASK A · Fix Comms Tracked-But-Gitignored
# Target: 48/50 · Clean up the M state permanently

ROOT CAUSE (from T3 S13 honest flag):
  .claude/comms/tomorrow.md was committed in sessions S9-S11 (git add -f).
  The .gitignore rule was added AFTER it was tracked.
  Git ignores only UNTRACKED files. Already-tracked files remain tracked.
  So the file shows as M (modified) every session even though it's gitignored.
  The fix: untrack the file without deleting it.

FIX STEPS:
  1. Verify the problem:
     git ls-files .claude/comms/tomorrow.md
     (should show the file is tracked)

  2. Untrack without deleting:
     git rm --cached .claude/comms/tomorrow.md
     (removes from git index, keeps on disk)

  3. Verify the .gitignore rule covers it:
     cat .gitignore | grep comms
     If no rule exists: add '.claude/comms/' to .gitignore

  4. Verify the fix:
     git status --short
     (the M on .claude/comms/tomorrow.md should be GONE)
     git ls-files .claude/comms/tomorrow.md
     (should return nothing — file is untracked)
     cat .claude/comms/tomorrow.md | wc -l
     (the file content is still on disk — verify)

  5. Commit:
     git add .gitignore  (if you added a new rule)
     git commit --allow-empty -m 'chore(infra): untrack comms from git index · filesystem-local per policy · NeoTopia T3 S14'

WARNING: If T2 or T1 have already committed comms this session, their commit will still have the
corrupted content. This fix only prevents FUTURE tracking. Document clearly in comms.

EVIDENCE GATE:
  git status --short (no M on .claude/comms/)
  cat .claude/comms/tomorrow.md | head -5 (still on disk)
  git push

---

## TASK B · Fix Bot Room Lifecycle Race
# Target: 47/50 · dbPlacedCount must read the right room reliably

ROOT CAUSE:
  T2's bot runs on production. After a bot game ends, the purge_e2e_test_data() migration
  may sweep the room before dbPlacedCount can query it. Result: the DB query finds no row.
  This is a race condition, not a bot logic error.

FIX APPROACH:
  The bot should capture the game_sessions.id DURING the game (when it's definitely alive),
  not AFTER the game ends. Then dbPlacedCount queries by session ID, not room_code.

COORDINATE WITH T2:
  Check .claude/comms/tomorrow.md — has T2 flagged this? If yes, fix it in T2's file.
  If T2 has NOT flagged it in scripts/bot-simulate.js: the fix is a cross-lane task.
  Approach: add a helper in T2's bot that captures session ID during the game:

  In playGame(), after 'Both on game board' confirmation:
    // Capture the session ID while the room is alive
    const sessionId = await getActiveSessionId(p1, roomCode)
    // Use sessionId (not roomCode) for all DB queries after game end

  Write a getActiveSessionId helper that queries:
    SELECT id FROM game_sessions WHERE room_id = (SELECT id FROM game_rooms WHERE code = $roomCode) LIMIT 1
  OR reads it from the DOM if T2 exposed it as data-session-id on the game board.

IF THE FIX IS IN T2's LANE:
  Document the fix in comms and tell T2 to implement it in T2 S14.
  Do NOT write to scripts/bot-simulate.js yourself (that is T2's file).
  Instead: write a helper in tests/e2e/seedHelpers.js that T2 can call.

EVIDENCE GATE:
  After fix: run the bot twice. Both runs should show dbVerified: true in the report.
  The mismatch (proxy 21 vs DB 19 from S13) should be resolved OR explained.

COMMIT:
  git add tests/e2e/seedHelpers.js (if you added the helper here)
  git commit -m 'fix(e2e): session ID capture helper for reliable DB verification · NeoTopia T3 S14'

---

## TASK C · Bot Health CI Assertion
# Target: 47/50 · Make the civilization health check automatic

WHAT TO BUILD:
  A GitHub Actions workflow that runs the bot and asserts dbVerified === true.
  This makes bot health part of CI — any regression in placement is caught automatically.

CREATE: .github/workflows/bot-health.yml

  name: Bot Health Check
  on:
    schedule:
      - cron: '0 6 * * *'  # 6am UTC daily
    workflow_dispatch:  # also allow manual trigger
  jobs:
    bot-health:
      runs-on: ubuntu-latest
      timeout-minutes: 15
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: 'npm'
        - run: npm ci
        - run: npx playwright install --with-deps chromium
        - name: Run bot simulation
          run: BOT_GAMES=1 BOT_TURNS=20 BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js
          env:
            VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
            VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        - name: Assert DB-verified placement
          run: |
            REPORT=$(ls -t .bot-reports/report-*.json | head -1)
            DB_VERIFIED=$(node -e "const r=JSON.parse(require('fs').readFileSync('$REPORT'));console.log(r.summary.dbVerified)")
            if [ "$DB_VERIFIED" != "true" ]; then
              echo "Bot health check FAILED: dbVerified=$DB_VERIFIED"
              node -e "const r=JSON.parse(require('fs').readFileSync('$REPORT'));console.log(JSON.stringify(r.summary,null,2))"
              exit 1
            fi
            echo "Bot health check PASSED: dbVerified=true"
        - uses: actions/upload-artifact@v4
          if: always()
          with:
            name: bot-report-${{ github.run_id }}
            path: .bot-reports/
            retention-days: 14

PREMISE CHECK:
  Read scripts/bot-simulate.js to confirm:
  - summary.dbVerified field exists (T2 S13 added it)
  - The report file path format (.bot-reports/report-*.json) is correct
  - BOT_GAMES / BOT_TURNS env var format is correct

EVIDENCE GATE:
  Push the workflow. Trigger manually via GitHub Actions UI.
  Verify: the job passes (dbVerified=true)
  If it fails: investigate the root cause from the artifact report before claiming done.

COMMIT:
  git add .github/workflows/bot-health.yml
  git commit -m 'ci: daily bot health check · dbVerified assertion · NeoTopia T3 S14'

---

## COMMIT RULES
  NEVER git add -A · pathspec only
  NEVER touch: src/components/ · src/pages/ · src/lib/ · src/store/ · scripts/bot-simulate.js
  NEVER commit .claude/comms/
  Rule 57: prove before patching · persistence witness before claiming a fix

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 · Session /300 · Forge /200 retroactive
  Evolution lesson → .claude/comms/tomorrow.md · FILESYSTEM ONLY
