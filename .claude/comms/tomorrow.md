# NeoTopia Cross-Terminal Comms
# Updated automatically each session
# ALL terminals read this on boot

## HOW GIT PULL WORKS (permanent note)
Git is file-based. ~/NeoTopia/.git is SHARED between all terminals on disk.
One `git pull` in ANY terminal (Mac terminal, T1, T2, T3) updates the shared .git refs.
Every forge boot sequence now starts with `git pull --rebase` — you never need to pull manually.
If unsure: run `bash ~/NeoTopia/start.sh` from Mac terminal before opening Claude Code tabs.

## SESSION STATUS (end of S3 / S4 in progress)
Last verified HEAD: de6db8d (T2 S4) / 7802096 (T3 S3) / 45d0d43 (T1 S3)
Tests: 66 green · Build: clean · E2E: ✅ VERIFIED LIVE

## T1 → T2 (from S3)
tryScoreCard(seat, cardId, regionId, lastPlacedKey) → boolean · shipped · scoreCard delegates to it
Replace handleCardScore before/after comparison with:
  const scored = store.tryScoreCard(currentSeat, cardId, selectedRegion, lastPlacedKey)
  if (scored) { triggerScoreFlash(cardId); reset() }

## T1 → T3 (from S3)
App.jsx routing: /lobby → Lobby · /game → GameRoom · wiring pending T1 S4
GameRoom needs: if (phase !== 'playing') navigate('/lobby')

## T2 → T1 (from S4)
useBonus('subsidy') — draw 2 cards, Offer-first · no bonusData needed
useBonus('initiative', {elementType, toQ, toR, regionId}) — place from reserve
Bonus earn paths NOT YET BUILT (T2 S5) · 1-bonus-per-turn NOT YET ENFORCED (T2 S5)

## T2 → T3 (from S4)
Task C (sessionId in store) was NOT built — T3's sessionIdRef is the single owner. Stay as-is.
Read full comms before committing to any T3 task that overlaps T2.

## T3 → T1 (from S3)
roomId navigation hazard: useGameRoom unmounts on /lobby→/game navigation.
Recommended fix: no-navigation container pattern (conditional render, not route change)
OR: route param /game/:roomId + useParams()
Exact code for GameRoom loading gate:
  const phase = useGameStore(s => s.phase)
  useEffect(() => { if (phase !== 'playing') navigate('/lobby') }, [phase, navigate])
  if (phase !== 'playing') return <div>Connecting…</div>

## T3 → T2 (from S3)
player_count trigger: migration 003 SHIPPED (T3 S3 · SECURITY DEFINER · search_path='')
game_events.sequence_num: GENERATED ALWAYS AS IDENTITY · DO NOT SET EXPLICITLY (rule 30)
sequence_num fix: use DB-assigned values only, omit from INSERT payload

## T3 LESSON (S3)
E2E fully verified live (7802096). sequence_num was GENERATED ALWAYS AS IDENTITY —
information_schema showed NOT NULL no-default but didn't show IDENTITY. Fixed.

## OPEN DECISIONS
- /lobby routing: T1 S4 wires it · T3 S4 Task A gates on T1 completing this
- roomId nav hazard: T1 chooses container pattern vs route param · T3 adopts
- permits bonus token: T2 S5
- bonus earn paths (hex cover + score track): T2 S5
- 1-bonus-per-turn enforcement: T2 S5
- Vercel deployment: confirm auto-deploy is live on main branch
