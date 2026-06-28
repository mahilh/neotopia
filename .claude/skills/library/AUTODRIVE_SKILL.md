# AUTODRIVE SKILL v3.0 · Rating: 195/200 · Trigger: AUTODRIVE!
# Self-improving · Updated automatically after every session

## PURPOSE
Launches full AUTODRIVE! session for T1/T2/T3. Hard-stops if forge rates below 85.
Requires specific evidence for every task. 5-lens adversarial review before every commit.
Relay is mandatory. Drive sync runs at session close.

## THE COMMAND (paste into terminal)
[T_] S[N] AUTODRIVE! · ultracode · Opus 4.8 · max context

MANDATORY PRE-SESSION FORGE RATING
Rate this forge /200 before touching any file.
If below 85: STOP · write FORGE RATED [N]/200 BELOW THRESHOLD and do nothing else.
State rating + 2 weakest premises before proceeding.

CIVILIZATION CONTEXT
NeoTopia.io · Stage 2 of 5 · GitHub: mahilh/neotopia · Vercel: neotopia.vercel.app
Stack: React 19 + Vite 8 + Tailwind v4 + Zustand + Immer + Supabase (wynccumuisjxbptjlfwq)
Final score: best+second+(worst×3)+(unused×3)+clusterBonus
Flow: 15s/9tiles · soft-lock FIXED d7365bd · 155 tests · 69 rules · HEAD: 51eec1c
4 elements: Energy(red) · BioFarming(green) · Technology(purple) · Community(blue)
56 esoteric consciousness cards · 3 regions · 3 factories · pure strategy (no luck)

TERMINAL LANES
T1: src/components/ · src/pages/ · src/index.css
T2: src/lib/ · src/store/ · scripts/ · migrations/
T3: src/hooks/ · tests/e2e/

BOOT SEQUENCE (exact order · no skipping)
git pull --rebase
cat .claude/CLAUDE.md | head -100
cat .claude/comms/tomorrow.md 2>/dev/null | tail -80
git log --oneline -10 && git status --short
npx vitest run 2>&1 | tail -8 && npm run build 2>&1 | tail -3

ANSWER BEFORE TOUCHING ANY FILE
A. What is HEAD and what does it do?
B. What does CLAUDE.md say is pending for my terminal?
C. What did cross-terminal comms hand off?
D. Are any forge premises contradicted by HEAD? (Rule 62/69)

EVIDENCE STANDARDS (every task · non-negotiable)
Visual: screenshot + DOM measurement (selector + px value)
Logic: vitest test asserting exact behavior (not just passes)
DB: node -e query confirming row/function on live Supabase
Cross-lane: verify composed value end-to-end (Rule 40/65)
Reconciliation: quote specific line of existing code that makes task redundant

PRE-COMMIT RITUAL (before every single commit)
echo "=== Rule 1 ===" && git diff --cached --name-only
grep -P "[\x{2014}\x{2013}]" $(git diff --cached --name-only) 2>/dev/null | head -5
npm run build 2>&1 | tail -3

5-LENS ADVERSARIAL REVIEW (before every commit)
Lens 1 · Security: auth bypass? unauthenticated write?
Lens 2 · Correctness: breaks any passing test?
Lens 3 · Cross-lane: touches files owned by other terminal?
Lens 4 · Rules: which of 69 rules is most at risk? Is it honored?
Lens 5 · Commit message: accurate? no embellishment? no lies?

[TASKS HERE · each: PREMISE CHECK + WHAT TO BUILD + EVIDENCE GATE + COMMIT + HANDOFF]

MANDATORY SESSION CLOSE (exact order)
1. npx vitest run 2>&1 | tail -8 · green count must hold or increase
2. npm run build 2>&1 | tail -3 · 0 errors
3. git log --oneline -6 · all commits on origin
4. git status --short · working tree clean
5. Evolution lesson → .claude/comms/tomorrow.md (GITIGNORED · NEVER commit)
   Format: Rule [N] candidate: [principle]. Sharpens [X/Y/Z]. Born from [evidence]. Failure prevented: [scenario].
6. Session rating: Forge [N]/200 · Tasks [N]/50 · Session [N]/300
7. bash .claude/relay.sh 2>&1 | tail -30 · if FAIL: fix before marking complete
8. node scripts/sync-drive-skills.cjs --all · syncs all improvements to Drive

## SELF-IMPROVEMENT LOG
v1.0: basic structure
v2.0: forge rating gate + evidence standards
v3.0: 5-lens adversarial review + pre-commit ritual + evolution lesson format + relay gate + Drive sync
PENDING v3.1: add cross-lane seam verification step between tasks
