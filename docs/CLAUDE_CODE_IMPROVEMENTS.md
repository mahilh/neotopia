# CLAUDE CODE OUTPUT IMPROVEMENTS
# What Claude Code is NOT outputting that would be superpowered if it did
# June 27 2026 · Overnight AUTODRIVE! analysis
# These improvements are now PERMANENT via relay.sh v3.0

## CURRENT STATE (relay.sh v2.0)

Claude Code terminals output via relay.sh:
  + git log (last 8 commits)
  + npx vitest run (tail -10 only)
  + npm run build (tail -3 only)
  + Bot health from last report
  + comms file (tail -60)
  + find src jsx files
  + git status --short

## WHAT WAS MISSING — NOW FIXED IN relay.sh v3.0

### 1. FAILING TEST NAMES (CRITICAL)
  BEFORE: Only showed tail -10 of vitest, which often just shows the summary.
  MISSING: The actual names of failing tests. When there are 3 failures in 102 tests,
           which 3? "3 failed" alone means debugging from scratch.
  FIXED: Now extracts FAILING lines with test names + error messages.
  IMPACT: NeoTopia AI can immediately diagnose which rule is violated,
          which component is broken, without re-running the suite.

### 2. BUNDLE SIZE
  BEFORE: Build output showed webpack/vite logs but not the actual KB totals.
  MISSING: Is the bundle growing? Did someone accidentally import a huge library?
           Is the eager bundle still under 1MB? This matters for mobile users.
  FIXED: Now shows total JS KB + eager index KB + per-chunk breakdown.
  IMPACT: Catches accidental bundle bloat immediately (Rule 32 equivalent for performance).

### 3. ART FILE STATUS (VISUAL SCAN)
  BEFORE: No art status in relay output. NeoTopia AI didn't know 0/56 existed.
  MISSING: Which of the 56 card art files exist? Which priority cards are missing?
           The check-art.js script existed but wasn't in relay.
  FIXED: Now shows X/56 count + missing priority cards (cards 1-12 first).
  IMPACT: Every session reminds both terminals and NeoTopia AI that 0/56 is critical.
          Cannot score 100% visual quality without card art.

### 4. MIGRATION COUNT AND LIST
  BEFORE: Never showed what migrations exist or how many.
  MISSING: When T2 ships a new migration, did it land? How many migrations total?
           Which numbers are present? Gaps = danger (migration ordering issues).
  FIXED: Shows count + full list of migration filenames.
  IMPACT: NeoTopia AI immediately catches missing migrations or numbering gaps.
          Prevents the "I thought migration 009 existed" blind spot.

### 5. ANTI-REGRESS RULE COUNT
  BEFORE: Never shown in relay.
  MISSING: How many permanent rules are in CLAUDE.md? Growing or stale?
           Rule count = civilization growth metric.
  FIXED: Shows count from CLAUDE.md.
  IMPACT: Motivates rule growth. Confirms rules are growing session to session.
          "60 rules" visible in every relay = constant signal.

### 6. ANTI-REGRESS VIOLATION SCAN
  BEFORE: Never done. Rules could be violated without anyone knowing.
  MISSING: Actual code scanning for known rule violations:
           Rule 1: git add -A in scripts
           Rule 3: window.confirm()
           Rule 32: Math.random() in synced code
  FIXED: Now scans src/ and scripts/ for violation patterns.
  IMPACT: Catches violations at commit time, not weeks later in production.
          The forge could prescribe a violation; this catches it.

### 7. HOT FILE DETECTION
  BEFORE: Only showed current git status (staged/modified).
  MISSING: Files modified in the last 30 minutes (actively being worked on).
           Cross-terminal collision detection: T2 editing src/store/gameStore.js
           while T1 was about to touch the same file.
  FIXED: Shows files newer than CLAUDE.md (= files modified since last CLAUDE.md update).
  IMPACT: Prevents the "two lanes both fixed it" collision bug (Rule 42).
          NeoTopia AI can immediately spot dangerous cross-lane overlaps.

### 8. SCREENSHOT COUNT (RULE 55 VERIFICATION)
  BEFORE: Rule 55 says "screenshot every visual task" but relay never verified it.
  MISSING: How many screenshots were taken this session?
           Did T1 actually screenshot the FinalScore or just DOM-check it?
  FIXED: Counts tmp/.playwright-mcp/page-*.yml files.
         Warns if 0 screenshots on a session with visual tasks.
  IMPACT: Enforces Rule 55 mechanically. Can't hide a screenshot requirement in relay.

### 9. SESSION DIFF STAT (what changed THIS session)
  BEFORE: Only showed git log (commit messages), not what files/lines changed.
  MISSING: How many lines changed in this session? Which files?
           Was the session surgical (10 lines) or broad (500 lines)?
  FIXED: Shows git diff --stat HEAD~1 HEAD.
  IMPACT: NeoTopia AI immediately sees the blast radius of this session's work.
          Catches over-broad changes that violate lane discipline.

### 10. CROSS-LANE COMMS VERIFICATION
  BEFORE: Only cat'd comms/tomorrow.md but didn't check git status on the comms dir.
  MISSING: Did comms accidentally get staged? (This happened in T3 S14 with the M state bug.)
  FIXED: Now shows git status .claude/comms/ specifically.
         Warns if 'A' (staged) appears — requires immediate git restore --staged.
  IMPACT: Prevents the comms-tracking bug from ever recurring.
          The git status is a hard gate on comms discipline.

## WHAT IS STILL MISSING (relay v4.0 scope)

### 11. VERCEL DEPLOYMENT STATUS
  Would show: last deployment hash + status (READY/ERROR) + URL
  Why powerful: confirm the pushed commit actually deployed without errors
  Implementation: curl https://api.vercel.com/v6/deployments | jq (needs token in env)
  Scope: T3 S16 (requires Vercel API token setup)

### 12. SUPABASE MIGRATION STATE
  Would show: which migrations have been applied to the live DB (not just which files exist)
  Why powerful: catches "migration file exists but was never run" (Rule 56 variant)
  Implementation: supabase migrations list --db-url $SUPABASE_DB_URL
  Scope: T2 S16 (requires Supabase CLI auth in env)

### 13. GITHUB ACTIONS LAST RUN STATUS
  Would show: bot-health CI last run (pass/fail) + e2e-placement-guard last run
  Why powerful: confirms CI is protecting the game even between sessions
  Implementation: gh run list --workflow bot-health.yml --limit 1
  Scope: T3 S16 (requires gh CLI auth)

### 14. PERFORMANCE BUDGET TRACKING
  Would show: test suite time (target <60s) + build time (target <30s)
  Why powerful: catches performance regressions (Rule 60 equivalent for time)
  Implementation: time npx vitest run ... time npm run build
  Scope: T3 S16 (timing audit is already T3 S15 Task C)

### 15. PROD ERROR COUNT (Vercel runtime errors)
  Would show: any JS errors in production in the last 24h (from Vercel logs)
  Why powerful: catches prod bugs that don't appear in test suite
  Implementation: Vercel Logs API (needs token)
  Scope: Post-S15 when Vercel MCP is integrated

## WHAT CLAUDE CODE TERMINALS SHOULD ALWAYS OUTPUT IN COMMS

The comms/tomorrow.md file is the primary cross-terminal communication channel.
Every session's comms block should include:

  ALWAYS:
  === T[N] S[N] COMPLETE ===
  Commits: [list with SHAs and 1-line descriptions]
  Forge self-rate: [X]/200
  Session: [X]/300
  Tests: [N] passing [N] failing
  Build: [CLEAN/WARN: description]
  Bundle: [XKB eager]
  Art: [N]/56
  Hot files: [list]
  Screenshots taken: [N]

  FOR T1 (visual sessions):
  Screenshots: [confirm each visual task was screenshot-verified]
  Browser test: [did you open the actual game in dev mode?]
  Mobile check: [did you test at 375px?]

  FOR T2 (engine sessions):
  DB migrations applied: [list]
  Security audit: [did you run the automated security review?]
  Schema verified: [did you confirm column names against information_schema?]
  Rule 59 check: [did any public writes need server-side trust boundary?]

  FOR T3 (realtime sessions):
  E2E files touched: [list]
  CI changes: [any workflow file changes?]
  Bot-health verified: [did you watch the CI run?]
  Tool contracts verified: [any new shell commands? did you verify their contracts?]

  CROSS-TERMINAL HANDOFFS:
  T[N] needs T[M] to: [exact one-liner task with file paths]

  EVOLUTION LESSON:
  Rule [N] candidate: [one-sentence lesson from this session]

## THE META-IMPROVEMENT: RULE 61 CANDIDATE

Relay is a contract. When relay.sh is stale, NeoTopia AI makes decisions on incomplete
information. Any relay upgrade that adds information is worth more than almost any
code change — it improves ALL future sessions simultaneously.

Rule 61 candidate (to be added after testing in S16):
  The relay is the session's witness. If it didn't appear in relay, it didn't happen.
  When adding any new permanent check to the project (new CI gate, new script, new metric),
  immediately also add it to relay.sh. The relay must grow as the project grows.

## RELAY v3.0 CHANGELOG

Added in this overnight AUTODRIVE! pass (June 27 2026):
  + THIS SESSION CHANGES (git diff --stat HEAD~1 HEAD)
  + Failing test name extraction (grep FAIL from vitest output)
  + Build warnings extraction (grep warn from build output)
  + Bundle size breakdown (total + eager + per-chunk)
  + Art file count (N/56 + missing priority list)
  + Migration count and file list
  + Anti-regress rule count from CLAUDE.md
  + Anti-regress violation scan (git add -A, window.confirm, Math.random)
  + Hot file detection (find src -newer CLAUDE.md)
  + Cross-terminal comms verification (git status .claude/comms/)
  + Screenshot count (tmp/.playwright-mcp/ files)
  + Sync status (LOCAL vs REMOTE SHA comparison)
  + NeoTopia Status Summary (one-line at end: Stage, Art, Rules, Migrations, Tests)
