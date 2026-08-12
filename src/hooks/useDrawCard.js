// NeoTopia · useDrawCard (T3 S22). The client-side wiring for the ATOMIC seat-scoped draw RPC
// (draw_card_for_seat · chain 011>014>021 · DEPLOYED + VERIFIED live · supabase 20260630104754).
//
// WHY THIS EXISTS (T3 S17 finding · migration 011 header): game state syncs as a WHOLE-STATE snapshot, so two
// clients drawing at the "same time" each read → mutate → write-back and the second CLOBBERS the first (a draw
// can be silently LOST). Flow mode makes concurrent draws the norm (every seat draws inside its own 15s
// window). The fix is atomicity at the DB: draw_card_for_seat holds a FOR UPDATE row lock on the session,
// pops one card, appends it to the caller's hand, and writes back · atomically · so concurrent draws serialize
// on the lock instead of racing. This hook is the thin, faithful client wrapper for that RPC.
//
// SCOPE (Rule 63 · honest): this is the WIRING PRIMITIVE only. It calls the RPC and RETURNS the drawn card so
// the caller can apply it to local state (per the migration's wiring note) · it does NOT itself mutate the
// Zustand store or re-render the board · that integration (replacing gameStore.drawCard's local deck.shift in
// the GameRoom draw path) is a later, cross-lane step (src/pages · T1). Keeping the hook pure makes it unit-
// testable without React-tree/store coupling and lets the integration land deliberately, not implicitly.
//
// AUTH: the RPC is SECURITY DEFINER and rejects a null auth.uid() + enforces seat ownership server-side
// (Rule 59 · the trust boundary is the DB, not this hook). This hook adds NO auth of its own · it only
// forwards the caller's already-authenticated supabase session.

import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// drawCard({ sessionId, seat, source, cardIndex }) → Promise<{ card, error }>
//   sessionId : game_sessions.id (uuid · REQUIRED)
//   seat      : the seat to draw FOR (integer · REQUIRED · 0 is valid · guard on == null, never !seat)
//   source    : 'deck' (default · pop deck top) | 'offer' (take theOffer[cardIndex])
//   cardIndex : index into theOffer when source==='offer' (default 0 · ignored for 'deck')
// Returns the drawn card object (the RPC's jsonb return · apply to local state) or null + an error string.
export function useDrawCard() {
  const [isDrawing, setIsDrawing] = useState(false)
  const [error, setError] = useState(null)

  const drawCard = useCallback(async ({ sessionId, seat, source = 'deck', cardIndex = 0 } = {}) => {
    // Validate the two REQUIRED args before spending a round-trip. seat 0 is a real seat, so the guard is
    // `seat == null` (not `!seat`) · `!seat` would wrongly reject seat 0 (the host's seat · the common case).
    if (!sessionId || seat == null) {
      const msg = 'drawCard requires sessionId and seat'
      setError(msg)
      return { card: null, error: msg }
    }

    setIsDrawing(true)
    setError(null)
    try {
      const { data, error: rpcError } = await supabase.rpc('draw_card_for_seat', {
        p_session_id: sessionId,
        p_seat: seat,
        p_source: source,
        p_card_index: cardIndex,
      })
      if (rpcError) {
        // Surfaces the server's own message (e.g. 'deck is empty' · 'not your turn' · 'permission denied:
        // seat N is not owned ...') so the caller can show why the draw was refused · the RPC is authoritative.
        setError(rpcError.message)
        return { card: null, error: rpcError.message }
      }
      // A 200 WITH A NULL BODY IS A FAILURE, NOT A DRAW (T2 S40 · Rule 80).
      // The RPC's contract is total: every path either raises (PostgREST 400, handled above) or returns
      // the drawn card. So `200 + null` is a state this function cannot legally produce · and until now
      // it was reported as SUCCESS with card:null, which is the worst available answer. GameRoom does
      // `drawn?.name ?? card.name`, so a null draw still logs "drew Solar Temple" against the local
      // card, and the hand never changes: a silent no-op wearing the costume of a completed action.
      // T3 spent a session on "the RPC returns 200 and nothing happens", and this is the surface that
      // makes that sentence sayable · the read-only audit found the DB untouched by every draw in that
      // run, so no draw ever landed and nothing here said so. Name it instead of resting on null.
      if (data == null) {
        const msg = 'draw returned no card · the server accepted the call but drew nothing'
        setError(msg)
        return { card: null, error: msg }
      }
      return { card: data, error: null }
    } catch (e) {
      // Network / client-side throw (the RPC errors arrive as { error } above, not as throws · this is the
      // transport failing). Never let a draw crash the caller · return the failure as data.
      const msg = e?.message ?? 'draw failed'
      setError(msg)
      return { card: null, error: msg }
    } finally {
      setIsDrawing(false)
    }
  }, [])

  return { drawCard, isDrawing, error }
}
