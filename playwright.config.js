// NeoTopia · Playwright E2E config (T3 S6).
// Scope: realtime reconnect proofs. testMatch is '*.e2e.js' so these files are invisible to Vitest
// (whose default include is *.test/*.spec) · the two runners never fight over the same file.
// Reconnect tests mutate shared realtime state · they run SERIALLY (one worker, not parallel).

import { defineConfig, devices } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveDevServer } from './tests/e2e/devServerTarget.js'

// WHICH APP THIS RUN IS ALLOWED TO TALK TO (T3 S63). The port used to be a literal in three places, and
// that composed with the project's own "isolate in a worktree" discipline into a run that drives the MAIN
// CLONE's app while you believe you are testing your worktree · silently, and always green. The whole
// story, with the three identical mutation results that found it, is in tests/e2e/devServerTarget.js.
// git is asked rather than guessed; if git is unavailable this resolves to the pre-S63 behaviour exactly.
const git = (...args) => {
  try { return execFileSync('git', ['rev-parse', '--path-format=absolute', ...args], { encoding: 'utf8' }).trim() }
  catch { return '' }
}
const commonDir = git('--git-common-dir')
const DEV = resolveDevServer({
  gitDir: git('--git-dir'),
  gitCommonDir: commonDir,
  cwd: process.cwd(),
  isCI: Boolean(process.env.CI),
  // Read here, decided in the module · the I/O stays out of the pure function so both branches stay
  // testable without a worktree, a git repo or a filesystem.
  hasEnvFile: existsSync(resolve(process.cwd(), '.env.local')),
  mainHasEnvFile: Boolean(commonDir) && existsSync(resolve(commonDir, '..', '.env.local')),
})
if (DEV.linkedWorktree) console.log(`[playwright] dev server ${DEV.origin} · ${DEV.why}`)
if (DEV.envWarning) console.warn(`\n⚠️  [playwright] ${DEV.envWarning}\n`)

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.e2e.js',
  // After the whole suite: authenticated purge of residual E2E/bot test data (T3 S9 · global-teardown.js).
  globalTeardown: './tests/e2e/global-teardown.js',
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: DEV.origin,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // --strictPort so a port clash is a loud refusal rather than Vite quietly moving to the next free
    // port while baseURL keeps pointing at the old one · which would be this defect again, wearing a
    // different hat (the run would talk to whatever WAS on DEV.port).
    command: `npm run dev -- --port ${DEV.port} --strictPort`,
    url: DEV.origin,
    reuseExistingServer: DEV.reuse,
    timeout: 120_000,
    // HALF OF A TWO-LINE CROSS-LANE FIX · INERT UNTIL THE OTHER HALF LANDS (T3 S51).
    // src/lib/reservedNames.js refuses a username claim on 'E2E'/'BotAlpha'/'BotBeta' · correctly, it
    // stops a real player landing inside purge_e2e_test_data's delete scope and losing their game. But
    // the purge IDENTIFIES harness rows by exactly those prefixes, and every live spec claims its name
    // through the real UI, so the harness can no longer sign in: game-ux and reconnect fail on the merge
    // gate with a bare "Create Room" timeout that names nothing (measured · run 31545142925, 3 retries,
    // identical). The harness cannot simply rename off the prefix without leaking rows out of the purge's
    // scope forever, which trades a visible breakage for an invisible leak.
    // NOTHING READS THIS YET. It is set here so the remaining change is ONE line in T2's file:
    //     if (import.meta.env.VITE_E2E) return false      // first line of isReservedUsername
    // Vite replaces that statically at build time, so a production bundle cannot carry the bypass and the
    // guard stays strict everywhere a real player can reach it. Verify with (no identities needed):
    //     npx playwright test tests/e2e/preconditions.e2e.js --grep "claim a name"
    // which goes from 15 refused prefixes to 0. See comms/t3-s51-URGENT-reserved-names-blocks-live-suite.md.
    env: { ...process.env, VITE_E2E: 'true' },
  },
})
