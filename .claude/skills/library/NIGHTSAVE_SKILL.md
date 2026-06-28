# NIGHTSAVE SKILL v3.0 · Rating: 182/200 · Trigger: NIGHTSAVE!
# Session close ritual · Terminal reviews · Drive sync · Evolution lesson

## RATING DEDUCTIONS
-10: Terminal review format brand new (untested across sessions)
-8: No automated MANIFEST state update from live git/vitest at close

## THE MANDATORY SEQUENCE (exact order · no skipping · no exceptions)

STEP 1 — TEST GATE
npx vitest run 2>&1 | tail -8
Gate: count must hold or increase from session start. If it drops: STOP AND FIX.

STEP 2 — BUILD GATE
npm run build 2>&1 | tail -3
Gate: 0 errors. Any error: STOP AND FIX.

STEP 3 — ORIGIN SYNC VERIFY
git log --oneline -6 && git status --short
Gate: all session commits on origin. git status clean.

STEP 4 — EVOLUTION LESSON (gitignored · local disk only)
cat >> .claude/comms/tomorrow.md << LESSON
Rule [N] candidate: [one sentence principle]
Sharpens Rules [X/Y/Z]
Born from: [specific evidence this session with commit SHA]
Failure it prevents: [concrete regression scenario]
Session score: Forge [N]/200 · Tasks [N]/50 · Session [N]/300
Honest gaps: [anything not shipped + specific reason]
LESSON

STEP 5 — RELAY GATE
bash .claude/relay.sh 2>&1 | tail -20
If relay shows FAIL or CRIT: fix before proceeding.

STEP 6 — DRIVE SYNC (all 11 skill files)
node scripts/sync-drive-skills.cjs --all
Verify output: 11 synced · 0 skipped

STEP 7 — SESSION LOG
node scripts/sync-drive-skills.cjs --log-session "T[N] S[N]" "[what shipped]" "[N]/300"

STEP 8 — TERMINAL REVIEW /1000 (World's harshest critic · no mercy)
node scripts/sync-drive-skills.cjs --log-terminal-review \
  T[N] "S[N]" \
  [forge/200] \
  [tasks/150] [codeQ/150] [ruleQ/150] [laneQ/100] [outQ/100] [effQ/100] [gitQ/100] \
  "[3 specific failures with evidence]" \
  "[exactly what changes next session to improve score]"

STEP 9 — PUSH
git push origin main
Verify: 0 0 (ahead behind)

## WHAT THE TERMINAL REVIEW CAPTURES
Every session, the world's harshest critic rates /1000:
Code Quality (150): Was the code correct, tested, architecturally sound?
Task Completion (150): Did you ship what was promised with evidence?
Rule Compliance (150): Zero violations of the 69 rules = 150. Each violation costs 10+.
Lane Discipline (100): Zero cross-lane file touches = 100. Each touch costs 25.
Output Quality (100): Commit messages, handoff clarity, comms written?
Session Efficiency (100): Tokens/time vs value delivered. Stale tasks cost 20 each.
Forge Alignment (100): Did execution match forge rating? Overclaiming costs 30.
Drive/Git Hygiene (100): Sync ran, no secrets committed, no stray files?

Honest scoring only. A 700 is strong. An 800 is elite. 900+ is theoretical.
Reading past reviews at boot: which category keeps failing?

## WHAT GETS PRESERVED WHERE
Git commits: GitHub forever · survives everything
comms/tomorrow.md: local disk only · gitignored · read next session boot
Skill files: Drive auto-synced · 11 files · service account writes · never expires
Terminal reviews: Drive T[N]_REVIEWS docs · appended per session · permanent record
Relay: terminal output · shows final health state

## SELF-IMPROVEMENT LOG
v1.0: basic close sequence
v2.0: Drive sync added as mandatory step
v3.0: terminal review /1000 system added · evolution lesson format standardized
