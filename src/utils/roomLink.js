// NeoTopia · invite-link helpers (T1 S27).
//
// WHY THIS EXISTS: a share link has to survive the messy round trip through WhatsApp, a screenshot,
// and a person retyping it. That means one place that decides what a room code looks like and what a
// link to it looks like, so the /join route, the share button, and the manual code field can never
// disagree about the same string.
//
// WHAT THIS IS NOT: it is NOT a join. Joining is T3's joinRoom(code) in src/hooks/useGameRoom.js and
// nothing here touches the network, Supabase, React, or room state (Rule 62 · reconcile, never
// rebuild). This module is pure string handling and is unit-tested without a browser.
//
// THE CHARSET IS A MIRROR, NOT A SECOND SOURCE OF TRUTH. The authority is generateRoomCode() in
// src/hooks/useGameRoom.js:25 (T3's lane). It is deliberately NOT imported here · that module pulls
// in the Supabase client, and a pure util must not drag a network dependency behind it. The drift
// risk that mirroring creates is closed in roomLink.test.js, which imports the REAL generator and
// asserts every code it produces passes isRoomCodeShape (Rule 45 · a duplicated contract is a second
// contract, so it gets pinned).

export const ROOM_CODE_LENGTH = 6

// No I, O, 0 or 1 · they misread when spoken aloud or typed from a photo.
export const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

const SHAPE = new RegExp(`^[${ROOM_CODE_CHARS}]{${ROOM_CODE_LENGTH}}$`)

// Everything a code picks up in transit: case, padding, and the spaces/dashes people add when they
// retype a code they are reading off a screen ("ABC 234", "abc-234").
export function normalizeRoomCode(raw) {
  if (typeof raw !== 'string') return ''
  return raw.trim().toUpperCase().replace(/[\s-]/g, '')
}

// Shape only. A code can be perfectly well-formed and still not exist · that answer lives in the DB
// and only joinRoom can give it. This exists so an obviously-broken link fails instantly with an
// honest message instead of costing a round trip to come back as 'Room not found'.
export function isRoomCodeShape(code) {
  return SHAPE.test(code)
}

// The full clickable thing a player pastes into a chat. Returns null rather than a half-built URL
// when the code is unusable, so a caller cannot accidentally share a link that cannot work.
export function buildInviteUrl(code, origin) {
  const normalized = normalizeRoomCode(code)
  if (!isRoomCodeShape(normalized)) return null
  if (typeof origin !== 'string' || origin === '') return null
  return `${origin.replace(/\/+$/, '')}/join/${normalized}`
}
