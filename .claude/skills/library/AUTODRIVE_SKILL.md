# AUTODRIVE SKILL v3.1 · Rating: 196/200 · Trigger: AUTODRIVE!
# Self-improving · Drive-synced after every session · Born: June 25 2026

## WHAT'S NEW IN v3.1 (S21)
Added: cross-lane seam verification between tasks
Added: live premise-check (validate HEAD + test count from git/vitest, not skill file)
Added: terminal review auto-write at NIGHTSAVE (--log-terminal-review)
Rule 70: forge can claim feature missing when it merely exists but is too subtle to see
Rule 71: sync ≠ current — always validate facts against live source at boot

## RATING DEDUCTIONS FROM 200
-2: Still missing explicit recovery path when relay fails (what to do exactly)
-2: Terminal review format not yet battle-tested (first session)

## THE COMMAND
[T_] S[N] AUTODRIVE! · ultracode · Opus 4.8 · max context

MANDATORY PRE-SESSION FORGE RATING (hard gate)
Rate forge /200 before touching any file.
Below 85: STOP · write FORGE RATED [N]/200 BELOW THRESHOLD · nothing else.
State rating + 2 weakest premises before proceeding.
LIVE PREMISE CHECK (Rule 71 — not from skill file):
  git rev-parse --short HEAD
  npx vitest run 2>&1 | grep -E "passed|failed" | tail -1
Compare these to what MANIFEST says. Flag any discrepancy before proceeding.

CIVILIZATION CONTEXT
NeoTopia.io · Stage 2 of 5 · GitHub: mahilh/neotopia · Vercel: neotopia.vercel.app
Stack: React 19 + Vite 8 + Tailwind v4 + Zustand + Immer + Supabase (wynccumuisjxbptjlfwq)
Score: best+second+(worst×3)+(unused×3)+clusterBonus · Cluster: 1pt/element biggest cluster/region
Flow: 15s/9tiles · soft-lock FIXED · board biomes SHIPPED · 158 tests · 69 rules
4 elements: Energy(red) · BioFarming(green) · Technology(purple) · Community(blue)
Global Index: 3 rows live · card art: 20/56 in Drive

TERMINAL LANES (never cross)
T1: src/components/ · src/pages/ · src/index.css
T2: src/lib/ · src/store/ · scripts/ · migrations/
T3: src/hooks/ · tests/e2e/

DRIVE BOOT (mandatory first 2 commands)
node scripts/sync-drive-skills.cjs --test
cat .claude/skills/library/MANIFEST_SKILL.md | head -30

STANDARD BOOT (exact order)
git pull --rebase
cat .claude/CLAUDE.md | head -80
cat .claude/comms/tomorrow.md 2>/dev/null | tail -60
git log --oneline -8 && git status --short
npx vitest run 2>&1 | tail -6 && npm run build 2>&1 | tail -3

ANSWER BEFORE TOUCHING ANY FILE
A. Live HEAD (from git rev-parse) vs MANIFEST HEAD — match or drift?
B. Live test count (from vitest) vs MANIFEST count — match or drift?
C. What does CLAUDE.md say is pending for MY terminal?
D. What did cross-terminal comms hand off?
E. Are any forge premises contradicted by HEAD? (Rule 62/69)

EVIDENCE STANDARDS (non-negotiable)
Visual: screenshot + DOM measurement (selector + px value)
Logic: vitest test asserting exact behavior
DB: node -e query confirming row on live Supabase
Cross-lane: verify composed value end-to-end (Rule 40/65)
Reconciliation: quote exact line making task redundant

PRE-COMMIT RITUAL
echo "=== Rule 1 ===" && git diff --cached --name-only
grep -rn "—\|–" $(git diff --cached --name-only) 2>/dev/null | head -5
npm run build 2>&1 | tail -3

5-LENS REVIEW (before every commit)
Lens 1 · Security: auth bypass? unauthenticated write?
Lens 2 · Correctness: breaks any passing test?
Lens 3 · Cross-lane: touches files owned by other terminal?
Lens 4 · Rules: which of 69 rules is most at risk?
Lens 5 · Commit message: accurate? no lies?

CROSS-LANE SEAM VERIFICATION (v3.1 addition — between tasks)
Before starting any task that composes with another terminal's output:
  git show HEAD:src/[cross-lane-file] | head -20
  Confirm the interface you're building against hasn't drifted.
  Never stub a cross-lane dependency without reading its current uncommitted state.

MANDATORY NIGHTSAVE CLOSE (exact order · no skipping)
1. npx vitest run 2>&1 | tail -8 · must hold or increase
2. npm run build 2>&1 | tail -3 · 0 errors
3. git log --oneline -6 · all commits on origin
4. git status --short · working tree clean
5. Evolution lesson → .claude/comms/tomorrow.md (GITIGNORED)
   Format: Rule [N] candidate: [principle]. Sharpens [X]. Born from [evidence]. Prevents: [scenario].
6. Session rating: Forge [N]/200 · Tasks [N]/50 · Session [N]/300
7. bash .claude/relay.sh 2>&1 | tail -20
8. node scripts/sync-drive-skills.cjs --all
9. node scripts/sync-drive-skills.cjs --log-session "T[N] S[N]" "[shipped]" "[N]/300"
10. node scripts/sync-drive-skills.cjs --log-terminal-review T[N] "S[N]" [forge] [tasks] [codeQ] [ruleQ] [laneQ] [outQ] [effQ] [gitQ] "[critique]" "[path]"
11. git push origin main

TERMINAL REVIEW SCORING (/1000)
Code Quality:       /150 (correctness · architecture · tests added)
Task Completion:    /150 (shipped vs promised · evidence quality)
Rule Compliance:    /150 (69 rules · zero violations = 150)
Lane Discipline:    /100 (zero cross-lane touches = 100)
Output Quality:     /100 (commit messages · handoff clarity)
Session Efficiency: /100 (tokens used vs value delivered)
Forge Alignment:    /100 (predicted rating vs actual execution)
Drive/Git Hygiene:  /100 (sync ran · no secrets · no stray files)
TOTAL:              /1000 · World's harshest critic · No mercy

## SELF-IMPROVEMENT LOG
v1.0: basic structure
v2.0: forge rating gate + evidence standards
v3.0: 5-lens adversarial review + pre-commit ritual + relay gate + Drive sync
v3.1: cross-lane seam verification + live premise-check + terminal review /1000
