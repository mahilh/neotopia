# NIGHTSAVE SKILL v2.0 · Rating: 178/200 · Trigger: NIGHTSAVE!
# Session close ritual · Drive sync · evolution lesson · relay gate

## PURPOSE
Closes any NeoTopia session safely. Ensures nothing is lost.
Updates Drive with all improvements. Writes evolution lesson.
Runs relay as completion certificate. Syncs skills to Drive.

## MANDATORY SEQUENCE (exact order · no skipping)
1. Run: npx vitest run 2>&1 | tail -8
   Gate: green count must equal or exceed session start count
2. Run: npm run build 2>&1 | tail -3
   Gate: 0 errors required
3. Run: git log --oneline -6
   Verify: all session commits on origin (not just local)
4. Run: git status --short
   Verify: working tree clean · no uncommitted files
5. Write evolution lesson to .claude/comms/tomorrow.md:
   Rule [N] candidate: [one sentence principle]
   Sharpens Rules [X/Y/Z]
   Born from: [specific evidence this session]
   Failure it prevents: [concrete scenario]
6. Self-rate the session:
   Forge: [N]/200 · Tasks: [A]/50 [B]/50 [C]/50 [D]/50
   Session total: Prompt[N]/100 + Code[N]/200 = [N]/300
   Honest gaps: [anything not shipped + reason]
7. Run: bash .claude/relay.sh 2>&1 | tail -30
   If relay shows FAIL or CRIT: fix before marking complete
8. Run: node scripts/sync-drive-skills.cjs --all
   This syncs all improved skill files to Google Drive automatically
   Verify output shows all files synced

## WHAT GETS SAVED
Git commits: on GitHub forever
Comms: .claude/comms/tomorrow.md (gitignored · disk only)
Skills: synced to Google Drive via service account
Relay: terminal output shows final state

## SELF-IMPROVEMENT LOG
v1.0: basic close sequence
v2.0: Drive sync added as final mandatory step
