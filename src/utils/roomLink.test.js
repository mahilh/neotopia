import { describe, it, expect } from 'vitest'
import {
  normalizeRoomCode,
  isRoomCodeShape,
  buildInviteUrl,
  ROOM_CODE_CHARS,
  ROOM_CODE_LENGTH,
} from './roomLink'
import { generateRoomCode } from '../hooks/useGameRoom'

const ORIGIN = 'https://neotopia.vercel.app'

describe('normalizeRoomCode · what a code picks up in transit', () => {
  it('uppercases a code someone typed in lower case', () => {
    expect(normalizeRoomCode('abc234')).toBe('ABC234')
  })

  it('strips the spaces and dashes people add when retyping from a screen', () => {
    expect(normalizeRoomCode('ABC 234')).toBe('ABC234')
    expect(normalizeRoomCode('abc-234')).toBe('ABC234')
    expect(normalizeRoomCode('  ABC234  ')).toBe('ABC234')
  })

  it('returns an empty string for anything that is not a string', () => {
    for (const bad of [null, undefined, 42, {}, []]) {
      expect(normalizeRoomCode(bad)).toBe('')
    }
  })
})

describe('isRoomCodeShape', () => {
  it('accepts a well-formed code', () => {
    expect(isRoomCodeShape('ABC234')).toBe(true)
  })

  it('rejects the ambiguous characters the charset deliberately excludes', () => {
    // This is the whole point of the charset · these four are why it exists.
    expect(isRoomCodeShape('ABC123')).toBe(false) // contains 1
    expect(isRoomCodeShape('ABC230')).toBe(false) // contains 0
    expect(isRoomCodeShape('IBC234')).toBe(false) // contains I
    expect(isRoomCodeShape('OBC234')).toBe(false) // contains O
  })

  it('rejects wrong lengths and lower case', () => {
    expect(isRoomCodeShape('ABC23')).toBe(false)
    expect(isRoomCodeShape('ABC2345')).toBe(false)
    expect(isRoomCodeShape('')).toBe(false)
    expect(isRoomCodeShape('abc234')).toBe(false) // normalize first, then test
  })
})

// Rule 45 · ROOM_CODE_CHARS is a MIRROR of generateRoomCode's charset in T3's useGameRoom.js. A
// duplicated contract is a second contract, so it is pinned against the real generator here. If T3
// ever changes the alphabet or the length, this fails loudly instead of silently rejecting valid
// invite links in production.
describe('DRIFT GUARD · the mirrored charset still matches the real generator', () => {
  it('accepts 500 codes from the live generateRoomCode', () => {
    for (let i = 0; i < 500; i++) {
      const code = generateRoomCode()
      expect(isRoomCodeShape(code)).toBe(true)
    }
  })

  it('agrees with the generator on length and alphabet', () => {
    const seen = new Set()
    for (let i = 0; i < 2000; i++) {
      const code = generateRoomCode()
      expect(code).toHaveLength(ROOM_CODE_LENGTH)
      for (const ch of code) seen.add(ch)
    }
    // Every character the generator can emit must be one this module accepts.
    for (const ch of seen) expect(ROOM_CODE_CHARS).toContain(ch)
  })
})

describe('buildInviteUrl', () => {
  it('builds the full clickable link a player pastes into a chat', () => {
    expect(buildInviteUrl('ABC234', ORIGIN)).toBe('https://neotopia.vercel.app/join/ABC234')
  })

  it('normalizes the code before putting it in the URL', () => {
    expect(buildInviteUrl('abc 234', ORIGIN)).toBe('https://neotopia.vercel.app/join/ABC234')
  })

  it('does not double the slash when the origin has a trailing one', () => {
    expect(buildInviteUrl('ABC234', 'https://neotopia.vercel.app/')).toBe(
      'https://neotopia.vercel.app/join/ABC234',
    )
  })

  it('works against a localhost origin with a port', () => {
    expect(buildInviteUrl('ABC234', 'http://localhost:5173')).toBe('http://localhost:5173/join/ABC234')
  })

  // Returning null rather than a half-built URL is deliberate: a caller cannot accidentally put a
  // link that can never work onto someone's clipboard.
  it('returns null rather than a broken link when the code is unusable', () => {
    expect(buildInviteUrl('ABC123', ORIGIN)).toBeNull()
    expect(buildInviteUrl('', ORIGIN)).toBeNull()
    expect(buildInviteUrl(null, ORIGIN)).toBeNull()
  })

  it('returns null when there is no origin to build against', () => {
    expect(buildInviteUrl('ABC234', '')).toBeNull()
    expect(buildInviteUrl('ABC234', undefined)).toBeNull()
  })
})
