# T3 S13 MASTER FORGE
# Target: 200/200 · Tasks A/B/C rated /50 · Forge self-rated /200 before execution
# NeoTopia T3 · Realtime/E2E · tests/e2e/ · src/hooks/useGameRoom.js · useGameSync.js
# Date: June 27 2026 (post S12 · 36 placed confirmed · placement-commit guard shipped)

## MISSION

T3 S12 shipped the placement-commit guard (193fa08). Now make it permanent:
T3 S13 wraps the placement guard in GitHub Actions CI so every push is protected.
Also: verify the 36-placed bot run against the DB (not the proxy). And confirm full E2E suite.

Task A: GitHub Actions workflow for placement-commit guard (permanent CI)
Task B: DB verification of bot v4.3 run (read room HF9QYE from Supabase)
Task C: Full E2E suite audit + confirmation all 6 files pass

FORGE SELF-RATING BEFORE EXECUTION: If any gate below 85/100 · REWRITE.

---

## GATES

Gate 1: `cat .claude/CLAUDE.md | head -60`
  Verify: force:true LOAD-BEARING, placement-commit guard is 193fa08, 102 tests green
  Verify: COMMS are filesystem local, NEVER commit .claude/comms/

Gate 2: `cat .claude/comms/tomorrow.md 2>/dev/null | tail -60`
  Verify: T1 and T2 have no pending tasks in tests/e2e/ or .github/
  HARD STOP if: another lane is touching E2E infrastructure

Gate 3: Read tests/e2e/game-ux.e2e.js FULLY.
  Verify: the placement-commit guard section uses force-click + data-valid + hex-element-in token count
  Verify: the touch-target gate (HARD · 0 violations) is still passing
  List EVERY test in game-ux.e2e.js by name.

Gate 4: Check if .github/workflows/ exists.
  `ls .github/workflows/ 2>/dev/null || echo "NO CI YET"`
  If no CI: Task A is creating it from scratch.
  If CI exists: Task A is extending it with the E2E job.

Gate 5: `npx vitest run 2>&1 | tail -6` · 102 green required
Gate 6: `npm run build 2>&1 | tail -4` · 0 errors required
Gate 7: `git log --oneline -8`
  Verify: 193fa08 (placement guard), 193fa08 is in the log.
  Verify: Your HEAD is origin/main after git pull.
  HARD STOP if: T2 bot changes are in your working tree (different lane).

---

## TASK A · GitHub Actions CI Workflow (target: 50/50)

CREATE: .github/workflows/e2e.yml

This workflow runs the placement-commit guard on every push to main and every PR.
DO NOT run the full E2E suite in CI (it requires live Supabase + rate-limit-sensitive).
RUN ONLY: game-ux.e2e.js (the placement guard + touch-target gate) · 8s local, isolated.

  name: E2E Placement Guard
  on:
    push:
      branches: [main]
    pull_request:
      branches: [main]
  jobs:
    placement-guard:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: 'npm'
        - run: npm ci
        - run: npx playwright install --with-deps chromium
        - run: npx playwright test tests/e2e/game-ux.e2e.js
          env:
            VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
            VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
            BASE_URL: http://localhost:5173
        - uses: actions/upload-artifact@v4
          if: failure()
          with:
            name: playwright-report
            path: playwright-report/
            retention-days: 7

PREMISE CHECK:
  Before writing the yml: read playwright.config.js (or playwright.config.ts) for the
  correct config format (testMatch, webServer, baseURL).
  If there's a webServer config that starts the dev server · include it in the yml.
  If the game-ux test uses a live Supabase · note that in the yml with a comment.

Secrets needed (add to GitHub repo Settings · Secrets and variables):
  VITE_SUPABASE_URL
  VITE_SUPABASE_ANON_KEY

COMMIT:
  git add .github/workflows/e2e.yml
  git commit -m 'ci: placement-commit guard in GitHub Actions · game-ux.e2e on push + PR · NeoTopia T3 S13'

EVIDENCE GATE:
  Push to main. Go to github.com/mahilh/neotopia/actions.
  Verify: the 'E2E Placement Guard' workflow appears and passes.
  If it fails · check the artifact report · fix before claiming done.

---

## TASK B · DB Verification of Bot Run (target: 50/50)

The bot v4.3 run on June 27 2026 placed 36 elements in room HF9QYE.
Proxy says 36. Verify the DB also says 36.

CREATE: scripts/verify-bot-run.js

  #!/usr/bin/env node
  // scripts/verify-bot-run.js
  // Reads the last bot report and verifies the placed count against Supabase
  // Usage: node scripts/verify-bot-run.js [roomCode]
  //   roomCode: optional · defaults to reading from latest .bot-reports/*.json

  import { createClient } from '@supabase/supabase-js'
  import { readFileSync, readdirSync } from 'fs'
  import 'dotenv/config'  // loads .env.local if present

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL
  const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

  // [read report, sign in, query game_sessions, count hexes, compare]

PREMISE CHECK FIRST:
  Read src/lib/supabase.js AND src/store/gameStore.js to find:
  - The exact table and column that stores placed elements per room
  - How board_state is structured (what JSON shape)
  NEVER guess. The column might be different from what T2 assumes.
  If you find the board_state structure in the store · document it in the script comments.

EVIDENCE GATE:
  node scripts/verify-bot-run.js HF9QYE
  Output should show:
    Room: HF9QYE
    Proxy placed: 36
    DB-verified placed: [N]
    Match: [YES/NO]
  If YES · log 'MILESTONE CONFIRMED: 36 elements DB-proven in room HF9QYE'
  If NO · log the discrepancy and investigate before committing

COMMIT:
  git add scripts/verify-bot-run.js
  git commit -m 'feat(scripts): verify-bot-run · DB-proven placed count vs proxy · NeoTopia T3 S13'

---

## TASK C · Full E2E Suite Audit (target: 50/50)

Run ALL 5 E2E test files and confirm all pass. Document the run.

FILES TO RUN:
  tests/e2e/game-ux.e2e.js
  tests/e2e/two-human.e2e.js
  tests/e2e/reconnect.e2e.js
  tests/e2e/phase-over-wire.e2e.js
  (skip global-teardown.js and seedHelpers.js · helpers not test files)

RUN:
  npx playwright test tests/e2e/game-ux.e2e.js tests/e2e/two-human.e2e.js 2>&1 | tail -20
  (run sequentially, NOT in parallel · Rule 33: live E2E never concurrent)

AUDIT EACH FILE:
  For each file, record:
  - Number of tests
  - Pass / fail / skip
  - If fail: root cause (rate limit? DB? code?)
  - If rate limit: mark as 'expected environmental' and do NOT count as a code regression

WRITE TO COMMS:
  Record the audit result in .claude/comms/tomorrow.md · FILESYSTEM ONLY:
  T3 S13 E2E AUDIT:
    game-ux.e2e.js: [N tests] · [PASS/FAIL] · 8.1s
    two-human.e2e.js: [N tests] · [PASS/FAIL] · [time]
    reconnect.e2e.js: ...
    phase-over-wire.e2e.js: ...

IF ANY TEST IS RED (not rate-limit):
  Root-cause before committing anything.
  Convert to a deterministic test if possible (Rule 31).
  DO NOT claim 'full suite green' if any test is red from a code regression.

COMMIT (only if you made code changes to fix failures):
  git add tests/e2e/[file you fixed]
  git commit -m 'test(e2e): [description of fix] · NeoTopia T3 S13'

---

## EVOLUTION LESSON
  Write ONE lesson to .claude/comms/tomorrow.md · FILESYSTEM ONLY
  Focus on what CI adds that local runs cannot: permanent, automatic, triggered by every push.
  A CI-protected test is worth 10 manual verifications.

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 · Session /300 · Forge /200 retroactive.
