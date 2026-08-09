// NeoTopia · the fixture-name guard's own evidence (T3 S32).
//
// Collected by VITEST, not Playwright: playwright.config.js testMatch is '**/*.e2e.js', so a
// *.test.js in this directory is invisible to it · the same two-runner separation seedHelpers.js
// itself relies on. That matters here, because a guard about fixture naming should cost nothing to
// run: no browser, no dev server, no anonymous sign-in.
//
// Rule 72 in miniature. The guard is three lines and looks obviously correct, which is exactly the
// kind of code that ships subtly wrong · the interesting assertions below are the ones that must NOT
// throw, because a guard that rejects too much would be quietly disabled by the next person to hit it.

import { describe, test, expect } from 'vitest'
import { uniqueName, UI_RESERVED_WORDS, makeRoomCode } from './fixtureNames'

describe('uniqueName · a fixture cannot impersonate the thing under test', () => {
  test('the exact S31 mistake is refused, and the error says what to do instead', () => {
    // E2EHOST + the roster's own <span>HOST</span> badge = a strict-mode violation that read like a
    // roster defect for the length of one debugging detour.
    expect(() => uniqueName('E2EHOST')).toThrow(/contains the UI word "HOST"/)
    // The message has to carry the fix, not just the verdict · this is the whole value of the guard.
    expect(() => uniqueName('E2EHOST')).toThrow(/E2EOWNER/)
  })

  test('every reserved word is actually enforced · the list is not decoration', () => {
    for (const w of UI_RESERVED_WORDS) {
      expect(() => uniqueName(`E2E${w}`), `"${w}" is listed but not enforced`).toThrow()
    }
  })

  test('case does not launder a collision', () => {
    // claimUsername uppercases nothing · the guard does, because the SCREEN's word is uppercase and a
    // lowercase prefix produces exactly the same rendered collision.
    expect(() => uniqueName('e2ehost')).toThrow(/HOST/)
    expect(() => uniqueName('E2eHoSt')).toThrow(/HOST/)
  })

  test('the names actually in use are all accepted · the guard is not over-broad', () => {
    // The counterweight, and the one that keeps this guard alive. If it rejected working prefixes,
    // the next person would delete it rather than rename their fixture.
    for (const p of ['E2EH', 'E2EG', 'E2ESOLO', 'E2EOWNER', 'E2EGUEST', 'E2EDRWH', 'E2EDRWG', 'E2EFLH', 'E2EFLG']) {
      expect(() => uniqueName(p), `"${p}" is a real prefix in use and must be accepted`).not.toThrow()
    }
  })

  test('a random suffix that happens to spell a reserved word is NOT rejected', () => {
    // Deliberate, and the reason the guard is scoped to the prefix. Three random base36 characters can
    // spell BOT, and a generator that threw on its own randomness would be a flake factory · the exact
    // shape of test that gets deleted instead of fixed. Proven by construction rather than asserted:
    // 2000 draws from a safe prefix must never throw, whatever the randomness produced.
    for (let i = 0; i < 2000; i++) expect(() => uniqueName('E2EX')).not.toThrow()
  })

  test('the generated name is shaped the way claimUsername needs', () => {
    const n = uniqueName('E2EOWNER')
    expect(n).toMatch(/^[A-Z0-9]+$/)
    expect(n.length).toBeLessThanOrEqual(20) // claimUsername slices to 20 · a longer name would be truncated mid-test
    expect(n.startsWith('E2EOWNER')).toBe(true)
    expect(uniqueName('E2EOWNER')).not.toBe(n) // unique per call · the whole point
  })
})

describe('makeRoomCode · still the shape the DB CHECK requires', () => {
  test('6 chars from the unambiguous alphabet, never I O 0 1', () => {
    for (let i = 0; i < 500; i++) {
      const c = makeRoomCode()
      expect(c).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/)
    }
  })
})
