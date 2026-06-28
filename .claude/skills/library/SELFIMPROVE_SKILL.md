# CLAUDE SELF-IMPROVE LOG
# Rating System: /1000 · Brutal · No bias · No mercy · Timestamped forever
# Every flaw logged. Every improvement verified. Claude reads this before every session.
# Drive ID: 1rIX1P_gx35UftbUe5gPqXisVAOxOs4RB56O3S5RU9Pg

## WHAT THIS FILE IS
The permanent memory of every mistake Claude has made across all NeoTopia sessions.
Claude Code (Opus 4.8) flaws. Claude Desktop (Sonnet 4.6) flaws. Both rated /1000.
Read at boot. Internalized before any task. Never repeated.

## RATING SCALE /1000
900-1000: Perfect execution. Exists in theory only.
800-899:  Elite. Rare. What we aim for.
700-799:  Strong. Most sessions should hit this.
600-699:  Acceptable. Noticeable gaps.
500-599:  Below standard. Real harm to the project.
400-499:  Significant failure. Wasted time.
300-399:  Critical failure. Broke something.
0-299:    Catastrophic. Token waste. Caused regression.

## FLAW CATEGORIES
CODE: Wrong logic, broken tests, bad architecture, wasted commits
FETCH: Bad API calls, wrong data interpretation, stale premises
OUTPUT: Vague answers, wrong format, em dashes, hallucinations
RULES: Any of the 69 anti-regress rules violated
DRIVE: Sync failures, wrong file IDs, permission errors
MEMORY: Forgetting context that was explicitly given
ESTIMATION: Wrong complexity estimates, wrong time predictions
CROSS-LANE: Touching files owned by another terminal

## HOW TO LOG A FLAW (automatic via NIGHTSAVE!)
node scripts/sync-drive-skills.cjs --log-flaw <CATEGORY> "<flaw description>" <score>

Example:
node scripts/sync-drive-skills.cjs --log-flaw CODE "Used wrong file ID for DEEPDIVE causing permission error" 420
node scripts/sync-drive-skills.cjs --log-flaw OUTPUT "Gave Drive write instructions that silently failed for 6 attempts" 380

## HOW CLAUDE USES THIS AT SESSION START
1. Search Drive for CLAUDE_SELF_IMPROVE
2. Read all logged flaws from previous sessions
3. Identify patterns (what category keeps failing)
4. Explicitly state: "I will not repeat these N flaws this session"
5. Rate my predicted session score before starting
6. Compare predicted vs actual at NIGHTSAVE

## PERMANENT IMPROVEMENT RULES (born from past flaws)
[Rules accumulate here after each session]

## FLAW LOG (most recent first)
────────────────────────────────────────────────────────────
[2026-06-29] DRIVE · SCORE: 380/1000
FLAW: create_file Drive MCP tool was silently failing for 6 consecutive attempts.
Did not diagnose root cause (read-only OAuth scope) until 6 failures.
Wasted significant tokens before pivoting to copy_file workaround.
FIX APPLIED: Always test write capability with a single file before bulk operations.
Never assume MCP tools work — verify each one before relying on it.
RULE BORN: Before using any MCP write tool, test it once on a throwaway file first.
────────────────────────────────────────────────────────────
[2026-06-29] CODE · SCORE: 420/1000
FLAW: Provided sync script with require() in an ES module project.
The error message said exactly why (package.json has "type":"module") but
the script was written without checking package.json first. Rule 7 violation.
FIX APPLIED: Renamed to .cjs extension. Works permanently.
RULE BORN: Before writing any Node.js script for this project, check package.json "type" field.
────────────────────────────────────────────────────────────
[2026-06-29] DRIVE · SCORE: 400/1000
FLAW: Used an old ACT AI Drive file ID (1o34GE1e0qmIo3wwGONHxCa0ig4HHmQL9oskyblLsf2Y)
for DEEPDIVE without checking if service account had access to it.
Caused "caller does not have permission" error mid-sync after 6 files succeeded.
FIX APPLIED: Created fresh Drive file via copy_file (service account always has access to files it creates).
RULE BORN: Never reuse Drive file IDs from old projects. Always create fresh via copy_file.
────────────────────────────────────────────────────────────
[2026-06-29] OUTPUT · SCORE: 500/1000
FLAW: Gave Vercel MCP setup instructions that failed silently (SSE config not supported
in Claude Desktop config file). Spent multiple sessions on OAuth flip-switch workaround
before diagnosing root cause. Should have known Claude Desktop only supports stdio MCPs.
FIX APPLIED: Service account approach bypasses OAuth entirely.
RULE BORN: Claude Desktop claude_desktop_config.json only works for stdio MCP servers.
HTTP/SSE servers must use OAuth connectors or service account approaches.
────────────────────────────────────────────────────────────
[2026-06-29] MEMORY · SCORE: 460/1000
FLAW: Forgot that tmux was already installed (3.6b) and recommended installing it,
causing brew to run a full upgrade + cleanup sequence unnecessarily.
Did not check `which tmux` before recommending installation.
RULE BORN: Always check if a tool exists before recommending installation.
────────────────────────────────────────────────────────────

## NEXT SESSION PREDICTION
Before starting: predict session score. After: compare honestly.
Predicted: ___ /1000
Actual: ___ /1000
Delta: ___ (positive = improving, negative = degrading)
