// NeoTopia · the dev-server target decision (T3 S63).
//
// tests/e2e/devServerTarget.js documents the defect. This file is the guard, and its ORDER is deliberate:
// the first describe is the case that MUST NOT MOVE (CI and the main clone), because the tempting fix for
// the worktree hazard is one that changes what CI does. A silent local wrong-tree run traded for a loud
// broken merge gate is not an improvement (T2's Rule 131 counterweight).
//
// Location: tests/ · vitest collects it (**/*.test.js), Playwright ignores it (testMatch **/*.e2e.js), the
// same split cluster-scoring.test.js and seededState.guard.test.js use.
//
// TEETH · every assertion below was mutation-proven, and the two that matter are recorded in the commit:
//   M1  make linkedWorktree always false      -> the worktree port assertion reds
//   M2  make linkedWorktree always true       -> the CI/main-clone assertions red (the counterweight fires)
//   M3  drop the `strip()` on the comparison  -> a trailing slash reads as a worktree · reds the main-clone case

import { describe, test, expect } from 'vitest'
import { resolveDevServer, DEFAULT_PORT } from './e2e/devServerTarget.js'

const MAIN = { gitDir: '/repo/.git', gitCommonDir: '/repo/.git', cwd: '/repo' }
const WORK = { gitDir: '/repo/.git/worktrees/wt63', gitCommonDir: '/repo/.git', cwd: '/tmp/wt63' }

describe('the case that must not move · CI and the main clone (counterweight, written first)', () => {

  test('CI resolves EXACTLY the pre-S63 target · 5173, no reuse', () => {
    const r = resolveDevServer({ ...MAIN, isCI: true })
    expect(r.port, 'CI must keep the port the config hardcoded before this file existed').toBe(5173)
    expect(r.origin, 'CI must keep the exact origin every spec and baseURL assumes').toBe('http://localhost:5173')
    expect(r.reuse, 'CI never reuses a server · changing this is the loud-broken-gate failure this ' +
      'counterweight exists to catch').toBe(false)
    expect(r.linkedWorktree, 'a CI checkout is a normal clone, not a linked worktree').toBe(false)
  })

  test('a developer in the MAIN clone keeps 5173 AND keeps reuse · no new friction for anyone', () => {
    const r = resolveDevServer({ ...MAIN, isCI: false })
    expect(r.port).toBe(5173)
    expect(r.reuse, 'reuse is what makes a local run fast · the fix is the PORT, and touching reuse would ' +
      'cost every developer a fresh Vite boot per run for a hazard they do not have').toBe(true)
  })

  test('a checkout with no git at all is treated as the main clone · absence never invents a worktree', () => {
    for (const missing of [{}, { gitDir: '/repo/.git' }, { gitCommonDir: '/repo/.git' }]) {
      const r = resolveDevServer({ cwd: '/repo', isCI: false, ...missing })
      expect(r.linkedWorktree, `${JSON.stringify(missing)} must not read as a worktree · an UNKNOWN that ` +
        'collapses to the special case is how a guard starts changing runs it was never meant to touch ' +
        '(Rule 101 corollary · the wrong boolean must be the harmless one)').toBe(false)
      expect(r.port).toBe(DEFAULT_PORT)
    }
  })

  test('a trailing slash is not a worktree · the comparison is on paths, not on strings', () => {
    const r = resolveDevServer({ gitDir: '/repo/.git/', gitCommonDir: '/repo/.git', cwd: '/repo', isCI: false })
    expect(r.linkedWorktree, 'git prints these from two different subcommands and they need not agree on a ' +
      'trailing slash · a string compare would send every main-clone run to a private port for nothing').toBe(false)
  })
})

describe('the linked worktree · the case the whole file exists for', () => {

  test('a linked worktree NEVER gets 5173 · that is the entire fix', () => {
    const r = resolveDevServer({ ...WORK, isCI: false })
    expect(r.linkedWorktree).toBe(true)
    expect(r.port, 'a worktree asking for 5173 is what let three mutations come back green against the ' +
      'main clone\'s app · if this is ever 5173 again the hazard is back and nothing else will say so')
      .not.toBe(DEFAULT_PORT)
    expect(r.origin).toBe(`http://localhost:${r.port}`)
  })

  test('the port is DETERMINISTIC · the same worktree gets the same port every run', () => {
    const a = resolveDevServer({ ...WORK, isCI: false })
    const b = resolveDevServer({ ...WORK, isCI: false })
    expect(a.port, 'a port that moves between runs cannot reuse its own server, so every run pays a full ' +
      'Vite boot and a stale one is left listening').toBe(b.port)
  })

  test('two different worktrees do not share a port by construction of the same path', () => {
    const a = resolveDevServer({ ...WORK, cwd: '/tmp/wt63', isCI: false })
    const b = resolveDevServer({ ...WORK, cwd: '/tmp/wt64', isCI: false })
    expect(a.port).not.toBe(b.port)
  })

  test('the port stays inside the dynamic range · a probe asserts its own output range (preamble §3)', () => {
    // Range, not a spot check: a hash that wrapped negative or overflowed would still return A number,
    // and a plausible number is the failure this project keeps paying for (Rule 80).
    for (let i = 0; i < 500; i++) {
      const r = resolveDevServer({ ...WORK, cwd: `/tmp/worktree-${i}`, isCI: false })
      expect(Number.isInteger(r.port), `non-integer port ${r.port} at i=${i}`).toBe(true)
      expect(r.port, `port ${r.port} at i=${i} is outside the range this file promises`)
        .toBeGreaterThan(DEFAULT_PORT)
      expect(r.port).toBeLessThan(DEFAULT_PORT + 1 + 300)
    }
  })

  test('reuse is UNCHANGED for a worktree too · the port is the fix, nothing else moved', () => {
    expect(resolveDevServer({ ...WORK, isCI: false }).reuse).toBe(true)
    expect(resolveDevServer({ ...WORK, isCI: true }).reuse).toBe(false)
  })
})

describe('the env warning · the second defect the port fix exposed', () => {

  // THE COUNTERWEIGHT FIRST, because a warning that fires on a healthy run is switched off long before
  // the day it is right (Rule 94a). This one has FOUR ways to be wrong and only one to be right.
  test('SILENT in every configuration that is not the trap', () => {
    const cases = [
      ['main clone with an env file',      { ...MAIN, hasEnvFile: true,  mainHasEnvFile: true }],
      ['main clone with none (CI)',        { ...MAIN, hasEnvFile: false, mainHasEnvFile: false, isCI: true }],
      ['worktree that HAS its own copy',   { ...WORK, hasEnvFile: true,  mainHasEnvFile: true }],
      ['worktree, main clone has none',    { ...WORK, hasEnvFile: false, mainHasEnvFile: false }],
      ['worktree, facts not supplied',     { ...WORK }],
    ]
    for (const [name, o] of cases) {
      expect(resolveDevServer({ isCI: false, ...o }).envWarning, `${name} · warned when it must not. A ` +
        'warning on a working setup is noise, and noise is how a gate gets ignored on the day it is right')
        .toBeNull()
    }
  })

  test('FIRES on exactly the configuration that has never worked', () => {
    const w = resolveDevServer({ ...WORK, isCI: false, hasEnvFile: false, mainHasEnvFile: true }).envWarning
    expect(w, 'a worktree with no .env.local while the main clone has one is the state where the dev ' +
      'server boots and the app throws · it must not be discovered from a 20s practice-badge timeout')
      .toBeTruthy()
    expect(w, 'the warning has to say what to DO · a named failure with no next step is still a diagnosis ' +
      'somebody has to run').toMatch(/\.env\.local/)
  })

  test('the facts are the CALLER\'s · undefined is never read as absent', () => {
    // hasEnvFile===undefined means "nobody looked", and an UNKNOWN that collapses to the alarming
    // boolean is how a guard starts crying wolf in environments it was never pointed at (Rule 101 corollary).
    expect(resolveDevServer({ ...WORK, isCI: false, mainHasEnvFile: true }).envWarning).toBeNull()
    expect(resolveDevServer({ ...WORK, isCI: false, hasEnvFile: false }).envWarning).toBeNull()
  })
})

describe('the config actually uses it · a decision nobody reads is not a fix (Rule 84)', () => {
  test('playwright.config.js resolves its origin through this module, not from a literal', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')
    const src = fs.readFileSync(path.resolve(process.cwd(), 'playwright.config.js'), 'utf8')
    // The whole defect was a hardcoded 5173 in three places. If the config stops asking, this module
    // becomes a well-tested symbol with no caller · the exact shape Rule 84 is about, and it would leave
    // every worktree run silently back on the main clone's app with this suite still green.
    expect(src, 'playwright.config.js no longer imports the dev-server decision · the guard below is ' +
      'testing a module nothing calls').toMatch(/from\s+'\.\/tests\/e2e\/devServerTarget\.js'/)
    expect(src, 'playwright.config.js still hardcodes a localhost port · the resolved origin must be the ' +
      'ONLY source, or the two disagree and the literal wins').not.toMatch(/localhost:\d+/)
  })
})
