// NeoTopia · fixture identity · the names and codes the E2E suite plays under (T3 S32).
//
// SEPARATE FROM seedHelpers.js ON PURPOSE, and not for tidiness. seedHelpers reads
// fixtures/seededState.json at MODULE level, which makes it unimportable outside Playwright's loader
// (vitest transforms import.meta.url to something readFileSync rejects: "The URL must be of scheme
// file"). Everything in this file is pure, so it can be unit-tested by vitest for free · no browser,
// no dev server, no anonymous sign-in · which is the only reason the guard below has evidence.
// seedHelpers re-exports both so no spec needs to know the split exists.
//
// THE BUG THIS FILE EXISTS FOR. In S31 a host fixture was named E2EHOST…, and the waiting-room roster
// renders a <span>HOST</span> badge. getByText('HOST') then matched two elements and the spec died on
// a strict-mode violation that read, for one debugging detour, like a roster defect. The name of the
// ACTOR was colliding with the vocabulary of the SCREEN.
//
// It was one character of carelessness, and it survived because uniqueName had been copy-pasted into
// SIX spec files · there was nowhere a rule about fixture names could live. That absence was the real
// defect. This is now the only definition, and it can say no.

// Words the interface renders as its own text. A fixture whose name contains one of these can make an
// assertion about the UI match the fixture instead.
export const UI_RESERVED_WORDS = Object.freeze(['HOST', 'READY', 'WAITING', 'START', 'JOIN', 'LEAVE', 'BOT'])

/**
 * A display name that cannot impersonate the interface. <=20 chars (claimUsername slices to 20).
 *
 * ONLY THE PREFIX IS GUARDED, deliberately. The suffix is base36 time + randomness, so a reserved
 * word can and eventually will appear inside it by chance (three random base36 characters can spell
 * BOT). Throwing on that would turn a safeguard into a random flake generator · precisely the kind of
 * test that gets deleted rather than fixed. The prefix is an authoring decision and can be held to a
 * rule; the suffix cannot. Suffix collisions stay harmless as long as assertions on badge text use
 * { exact: true }, which is the other half of the same lesson.
 */
export function uniqueName(prefix) {
  const p = String(prefix ?? '').toUpperCase()
  const clash = UI_RESERVED_WORDS.find(w => p.includes(w))
  if (clash) {
    throw new Error(
      `fixture name prefix "${prefix}" contains the UI word "${clash}". The lobby and the roster render ` +
      `that word as their own text, so a player named this way makes getByText("${clash}") ambiguous and ` +
      `the spec fails as if the SCREEN were wrong. Pick a prefix the interface does not use ` +
      `(E2EOWNER, E2EGUEST, E2EPLAYER…). Reserved: ${UI_RESERVED_WORDS.join(', ')}.`
    )
  }
  const t = Date.now().toString(36).slice(-5)
  const r = Math.random().toString(36).slice(2, 5)
  return (p + t + r).toUpperCase().slice(0, 20)
}

// 6-char code · same unambiguous charset the app uses (DB CHECK: length = 6). No I, O, 0 or 1.
export function makeRoomCode() {
  const CH = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let c = ''
  for (let i = 0; i < 6; i++) c += CH[Math.floor(Math.random() * CH.length)]
  return c
}
