# T2 S13 MASTER FORGE
# Target: 200/200 · Tasks A/B/C rated /50 · Forge self-rated /200 before execution
# NeoTopia T2 · Engine/Bot/DB · src/lib/ · src/store/ · scripts/ · migrations/
# Date: June 27 2026 (post S12 · 36 placed confirmed · bot v4.3 live · ready-failed: 1 remains)

## MISSION

Bot v4.3 placed 36 elements in 20 turns. One `ready-failed` error remains (host doesn't use Ready,
host uses Start). Bot v4.4 fixes the lobby flow, adds DB-verified placed count, and adds
rate-limit retry so multi-game runs survive the 30-signins/hr Supabase ceiling.

Task A: Fix ready-failed (host lobby flow) + rate-limit retry on signin
Task B: DB-read placed count (true verification, replacing proxy counter)
Task C: Bot report enhancement with DB-proven placed count in summary

FORGE SELF-RATING BEFORE EXECUTION: If any gate below 85/100 · REWRITE.

---

## GATES

Gate 1: `cat .claude/CLAUDE.md | head -60`
  Verify: force:true LOAD-BEARING · 4-step placement verified · COMMS local only
  Verify: Bot proxy counter ≠ DB truth (Rule 53). Your task is to make them match.

Gate 2: `cat .claude/comms/tomorrow.md 2>/dev/null | tail -60`
  Verify: T1 and T3 have no pending tasks touching scripts/bot-simulate.js
  HARD STOP if: T3 is mid-edit on bot or E2E harness

Gate 3: Read scripts/bot-simulate.js FULLY.
  Verify the exact lobby flow:
  - Host creates room · waits for Start button ('button:has-text("Start")')
  - Joiner joins room · may see Ready button ('button:has-text("Ready")')
  - Bot currently tries Ready on BOTH pages · fails on host page (no Ready, only Start)
  Verify: The 'ready-failed' error is exactly this: p1 (host) has no Ready button.
  Root cause: The Ready button selectors loop runs on p1 AND p2. But p1 is the host ·
              in current lobby design the host only gets a Start button after joiner Ready.

Gate 4: `npx vitest run 2>&1 | tail -6` · 102 green required
Gate 5: `npm run build 2>&1 | tail -4` · 0 errors required
Gate 6: `git log --oneline -6 && git status --short`
  HARD STOP if: T1 files (src/components/ src/pages/) are in your working tree.

Gate 7: Verify Supabase access for DB read.
  The bot uses Supabase for auth. It can also query game_sessions for placed count.
  Confirm: supabase-js is already in package.json (it is · used by src/lib/supabase.js).
  Bot will import createClient from @supabase/supabase-js · use the same env vars.
  DO NOT: hardcode credentials in bot-simulate.js. Use process.env.VITE_SUPABASE_URL etc.
  Read src/lib/supabase.js to confirm the exact env var names.

---

## TASK A · Fix ready-failed + Rate-limit retry (target: 50/50)

### Fix 1: ready-failed (1 error per game)

ROOT CAUSE: Bot tries Ready on both p1 (host) and p2 (joiner).
But the lobby shows Ready only on the JOINER page. Host sees a different UI state.

FIX: Only click Ready on p2 (joiner). Skip Ready on p1 (host). Host waits for Start.
  Change the ready section from:
    for (const page of [p1, p2]) { click Ready }
  To:
    // Only joiner (p2) clicks Ready · host page has no Ready button in lobby
    const joinerReadyBtn = p2.locator('[data-testid="ready-btn"], button:has-text("Ready")').first()
    if (await joinerReadyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await joinerReadyBtn.click().catch(e => errors.push({type:'ready-failed', message: e.message.slice(0,80)}))
      await delay(500)
    }
    // Host waits for Start button (already handled below)

### Fix 2: Rate-limit retry on signin

ROOT CAUSE: Supabase anon auth rate limit is ~30 signins/hr. Multi-game runs exceed this.
FIX: Wrap signInAnonymously (inside enterLobby or Supabase client init) with retry:
  async function signInWithRetry(supabase, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      const { data, error } = await supabase.auth.signInAnonymously()
      if (!error) return data
      if (error.message?.includes('rate') || error.status === 429) {
        const waitMs = (i + 1) * 65000  // 65s, 130s, 195s
        log(`[AUTH] Rate limited · retry ${i+1}/${maxRetries} in ${waitMs/1000}s`)
        await delay(waitMs)
        continue
      }
      throw error  // non-rate-limit error · fail fast
    }
    throw new Error('Max auth retries exceeded')
  }

  Locate where enterLobby() navigates and authenticates (it currently uses Supabase anonymously).
  Wrap the signIn call with signInWithRetry.

EVIDENCE GATE:
  Run: BOT_GAMES=3 BOT_TURNS=15 BOT_URL=https://neotopia.vercel.app node scripts/bot-simulate.js
  Verify: 0 ready-failed errors across 3 games
  Verify: if rate limited, bot logs '[AUTH] Rate limited · retry ...' and continues

---

## TASK B · DB-Read Placed Count (target: 50/50)

ROOT CAUSE: The current bot reports `placed: N` based on a counter that increments on
'attempted click' not on 'committed to DB'. This is the proxy T3 caught in S12.

FIX: After the game ends (or at the end of each turn), query game_sessions for the
actual board state and count placed elements.

IMPLEMENTATION:
  Add a helper at the bottom of bot-simulate.js:

  async function dbPlacedCount(roomCode) {
    // roomCode is 6-char string from extractRoomCode
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY
    )
    // Find the game_sessions row for this room
    const { data, error } = await sb
      .from('game_sessions')
      .select('board_state')
      .eq('room_code', roomCode)  // adjust column name if different
      .single()
    if (error || !data?.board_state) return null
    // board_state is JSON: count all hex entries that have an element
    let count = 0
    const board = typeof data.board_state === 'string' ? JSON.parse(data.board_state) : data.board_state
    for (const region of Object.values(board?.regions ?? {})) {
      for (const hex of Object.values(region?.hexes ?? {})) {
        if (hex?.element) count++
      }
    }
    return count
  }

PREMISE CHECK FIRST:
  Before implementing, run: npx supabase db dump --schema public 2>/dev/null | grep game_sessions
  OR: query the live DB in Supabase Studio to see the ACTUAL column name for the board state.
  NEVER guess column names. The column might be 'board_state', 'state', 'game_state', or similar.
  Read src/lib/supabase.js and the game store to find where board state is written to Supabase.
  Find the exact column name before writing dbPlacedCount.

INTEGRATION:
  Call dbPlacedCount(roomCode) after the game ends (after the TURN_LIMIT loop).
  Add to the game result:
    result.dbPlacedCount = await dbPlacedCount(roomCode).catch(() => null)
  Log: log(`DB-verified placed: ${result.dbPlacedCount ?? 'unavailable'} · proxy: ${placed}`)
  If dbPlacedCount !== placed: log a WARNING

EVIDENCE GATE (Rule 53):
  Run the bot · check the log for 'DB-verified placed: N'
  Verify N matches what Supabase Studio shows for the room
  If proxy says 36 and DB says 36 · milestone fully confirmed
  If they differ · the DB count wins · investigate the discrepancy

---

## TASK C · Bot Report Enhancement (target: 50/50)

FIX: Add DB-proven placed count to the JSON report and console summary.

  In the summary object:
    totalPlacedProxy: [old placed counter],
    totalPlacedDB: [sum of result.dbPlacedCount across games, null if query failed],
    dbVerified: totalPlacedProxy === totalPlacedDB,

  In the console output:
    console.log(`Elements placed: ${s.totalPlacedProxy} (proxy) · ${s.totalPlacedDB ?? 'N/A'} (DB-verified)`)
    if (!s.dbVerified && s.totalPlacedDB !== null) {
      console.warn('WARNING: proxy and DB counts disagree · check board_state writes')
    }

COMMIT SEQUENCE:
  git add scripts/bot-simulate.js
  git commit -m 'feat(bot): v4.4 · fix ready-failed host lobby · rate-limit retry · DB-verified placed count · NeoTopia T2 S13'
  NEVER: git add -A
  NEVER: touch src/components/ src/pages/ tests/e2e/

## SELF-RATE AFTER EACH TASK
  Task A: rate /50. <35 = redo.
  Task B: rate /50. Read the actual board_state schema before coding.
  Task C: rate /50. <35 = redo.
  Session: /300. Forge: /200 retroactive.

## EVOLUTION LESSON
  Write to .claude/comms/tomorrow.md · FILESYSTEM ONLY · DO NOT git commit
