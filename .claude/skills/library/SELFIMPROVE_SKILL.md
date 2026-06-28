# CLAUDE SELF-IMPROVE LOG · /1000 · Brutal · No bias · Timestamped forever
# Drive ID: 1rIX1P_gx35UftbUe5gPqXisVAOxOs4RB56O3S5RU9Pg
# Read FIRST at every session. Internalize before any task. Never repeat.

## RATING SCALE /1000
900-1000: Perfect. Theoretical ceiling only.
800-899:  Elite. Rare. Target level.
700-799:  Strong. Solid sessions hit this.
600-699:  Acceptable. Noticeable gaps present.
500-599:  Below standard. Real harm to project.
400-499:  Significant failure. Wasted time.
300-399:  Critical failure. Broke something real.
0-299:    Catastrophic. Regression caused. Token waste.

## CATEGORIES
CODE: Wrong logic · broken tests · bad architecture · wasted commits
FETCH: Bad API calls · wrong data interpretation · stale premises used as truth
OUTPUT: Vague answers · wrong format · em dashes · hallucinations · overclaiming
RULES: Any of the 69 anti-regress rules violated
DRIVE: Sync failures · wrong file IDs · permission errors · storage errors
MEMORY: Forgetting explicit context · repeating resolved questions
ESTIMATION: Wrong complexity or time estimates
CROSS-LANE: Touching files owned by another terminal

## HOW CLAUDE USES THIS FILE
1. Search Drive for CLAUDE_SELF_IMPROVE at session start
2. Read all past flaws — which category repeats?
3. State explicitly: "I will not repeat flaws [N], [N], [N] this session"
4. Predict session score /1000 before starting
5. At NIGHTSAVE: compare predicted vs actual
6. Log any new flaws discovered

## RULES BORN FROM FLAWS (permanent)
DRIVE-1: Before using any MCP write tool, test it once on a throwaway file first.
DRIVE-2: Never reuse Drive file IDs from old projects. Always create fresh via copy_file.
DRIVE-3: Service accounts have no Drive storage quota. Files must live in human's Drive.
CODE-1: Before writing any Node.js script, check package.json "type" field.
OUTPUT-1: Claude Desktop claude_desktop_config.json only works for stdio MCP servers.
MEMORY-1: Always check if a tool exists (which X) before recommending installation.
FETCH-1: Validate HEAD and test count from live source at boot — not from skill file.

## FLAW LOG (newest first)
────────────────────────────────────────────────────────────
[2026-06-29 T3 S21] FETCH · SCORE: 600/1000
FLAW: Self-improving skill docs carry stale facts at S21 boot.
MANIFEST claimed HEAD 45114fe / 155 tests. Reality: 641f7be / 158.
AUTODRIVE_SKILL claimed HEAD 51eec1c / 69 rules — even more stale.
The --all sync mirrors files to Drive but never updates the facts inside them.
Caused forge to re-issue an already-completed task (board biomes) twice.
FIX: Boot premise-checks must validate HEAD (git rev-parse) and test count
(vitest) at the moment of use — not from the skill file's last-written content.
RULE BORN (Rule 71): A self-improving system that syncs files but never refreshes
facts inside them faithfully mirrors rot. Sync ≠ current.
────────────────────────────────────────────────────────────
[2026-06-29 DRIVE] DRIVE · SCORE: 350/1000
FLAW: Attempted to create files in service account Drive storage.
Service accounts have no Drive storage quota. Always fails.
Wasted 3 attempts before diagnosing root cause.
FIX: Files must live in Mahil's Drive. Service account gets Editor access via sharing.
RULE BORN (DRIVE-3): Service accounts have no Drive storage. Files live in human's Drive.
────────────────────────────────────────────────────────────
[2026-06-29 DRIVE] DRIVE · SCORE: 380/1000
FLAW: create_file Drive MCP silently failing 6 consecutive attempts.
Did not diagnose root cause (read-only OAuth) until 6 failures.
FIX: Test write capability with one file before bulk operations.
RULE BORN (DRIVE-1): Test MCP write tools before relying on them.
────────────────────────────────────────────────────────────
[2026-06-29 CODE] CODE · SCORE: 420/1000
FLAW: require() in ES module project. package.json has "type":"module".
Did not check package.json before writing script.
FIX: .cjs extension. Permanent.
RULE BORN (CODE-1): Check package.json type before writing Node.js scripts.
────────────────────────────────────────────────────────────
[2026-06-29 DRIVE] DRIVE · SCORE: 400/1000
FLAW: Used old ACT AI Drive file ID without checking service account access.
Permission error mid-sync after 6 files succeeded.
FIX: Always create fresh Drive files via copy_file.
RULE BORN (DRIVE-2): Never reuse Drive IDs from old projects.
────────────────────────────────────────────────────────────
[2026-06-29 OUTPUT] OUTPUT · SCORE: 500/1000
FLAW: Vercel MCP SSE config failed silently. OAuth flip-switch workaround.
Should have known Claude Desktop only supports stdio MCPs.
RULE BORN (OUTPUT-1): Claude Desktop config.json = stdio only. HTTP/SSE = OAuth or SA.
────────────────────────────────────────────────────────────
[2026-06-29 MEMORY] MEMORY · SCORE: 460/1000
FLAW: Recommended installing tmux when already installed (3.6b).
Did not check `which tmux` first.
RULE BORN (MEMORY-1): Check if tool exists before recommending installation.
────────────────────────────────────────────────────────────

## SESSION SCORES (track trajectory)
S21 setup:  620/1000 (Drive auth errors · ESM error · storage quota error)
S21 T1:     Logged as 255/300 (terminal scale)
S21 T2:     Logged as 220/300
S21 T3:     Logged as 235/300
