// CAN A PRICE SOFT-LOCK A GAME?  (T2 S68 · answering my own S67 scope critique)
// ═════════════════════════════════════════════════════════════════════════════════════════════════
// S67 measured that the wallet's terminal term never fires and I said so in a commit message. Then I
// wrote the honest limit into my own closing note: *"I never measured whether real play can reach a
// board where placement is genuinely impossible and money is gone. walletEnabled.test.js constructs
// it by emptying factories; nothing shows play ARRIVES there. Until that runs, 'the wallet's
// terminal term is inert' is scoped to greedy bots on a full board."*
//
// That scope matters more now than when I wrote it: the flag is one line from being flippable, and
// the soft-lock class it reopens took FOUR fixes across THREE lanes to close (Rule 103).
//
// ⚠ AND THE INTERESTING FAILURE IS NOT THE TERMINAL TERM · IT IS T1's END TURN GATE.
// The escape T1 shipped in S44 reads "no legal placement AND nothing to draw". `fuzzDriver.canDraw`
// models it faithfully: `theOffer.length > 0 || deck.length > 0`. Under a price those two questions
// come apart · a broke player with 46 cards on the table has NOTHING TO DRAW and the gate says there
// is. So they cannot act and cannot pass, which is the S44 lock returning through a door nobody
// closed. The engine's own terminal term does not save them, because it also requires no placement.
//
// This drives the REAL policies through the REAL engine with the flag mocked on. It does not model
// the wallet (Rule 45 · affordability and the debit are the engine's, seeded budget aside).

import { describe, it, expect, vi } from 'vitest'

vi.mock('./gameConfig', async (importOriginal) => ({ ...(await importOriginal()), WALLET_ENABLED: true }))

const { POLICIES, playWithPolicy } = await import('./fuzzDriver')
const { useGameStore, PRODUCTION_TILES } = await import('./gameStore')
const { WALLET_ENABLED, CARD_PRICE } = await import('./gameConfig')
const { DECK } = await import('../lib/projectCards')

const SEEDS = Array.from({ length: 12 }, (_, i) => 5100 + i * 41)
const names = Object.keys(POLICIES)

describe('the wallet against the adversarial policies', () => {
  // ── COUNTERWEIGHT 1 · the flag is on, or every arm below is the free game ──────────────────────
  it('WALLET_ENABLED really is ON here', () => {
    expect(WALLET_ENABLED, 'the mock did not take effect · every card is free and a "no soft-lock" ' +
      'result below would be about a game with no prices in it').toBe(true)
  })

  // ── COUNTERWEIGHT 2 · AN UNBOUNDED BUDGET MUST REPRODUCE THE UNPRICED GAME EXACTLY ────────────
  // If seeding a wallet changed play on its own, every difference measured below would be about the
  // plumbing rather than about the price. Infinity is exact rather than approximate: the only
  // effects of money are the refusal and the debit, and Infinity - CARD_PRICE is Infinity.
  // ⚠ MY FIRST VERSION OF THIS COMPARED Infinity AGAINST "the unpriced game" AND CALLED THE DEFAULT
  // WALLET UNPRICED. It is not: with the flag on, STARTING_WALLET is $1B against a $70M card, i.e.
  // a FOURTEEN-CARD BUDGET, and it is the configuration the game will ship with. The control failed
  // and it was right to · `drawHeavy` reached scoring on Infinity and HUNG on the default. I had
  // written "far more than a game can spend" in the comment beside it, which was the assumption and
  // not a measurement (Rule 122a). The 14-card row is now in the sweep as a first-class arm.
  it('an infinite budget refuses nothing and never hangs · the control for every lock below', () => {
    for (const policy of names) {
      const rich = playWithPolicy(policy, SEEDS[0], { wallet: Infinity })
      expect(rich.refusedDraws, `${policy} refused a draw on an INFINITE budget · the engine is ` +
        'refusing for some reason other than money, so a hang at a finite budget could not be ' +
        'attributed to the price').toBe(0)
      expect(rich.outcome, `${policy} HUNG on an infinite budget · whatever the sweep finds below ` +
        'is not about money, and this file cannot answer the question it was written for').not.toBe('hung')
    }
  })

  // ── COUNTERWEIGHT 2b · THE MODEL CHANGE MUST BE A NO-OP WHERE NOTHING IS PRICED (T2 S70) ──────
  // The driver's End Turn gate and its never-abstain fallback now ask `canAcquire` instead of
  // `canDraw`, mirroring T1's dbdd622. If that swap changed behaviour when money is NOT the binding
  // constraint, then every difference the sweep reports afterwards would be about the edit rather
  // than about the price · and the direction it would move is toward FEWER hangs, which is the
  // flattering one and therefore the one nobody would query.
  //
  // Infinity is the exact control: a seat that can always afford anything makes `canAcquire` and
  // `canDraw` the same predicate by construction, so the two must agree game for game.
  it('with an unbounded budget, asking affordability is identical to asking existence', () => {
    for (const policy of names) {
      for (const seed of SEEDS.slice(0, 4)) {
        const g = playWithPolicy(policy, seed, { wallet: Infinity })
        expect(g.outcome, `${policy}/${seed} did not reach scoring on an INFINITE budget · the ` +
          'gate swap changed the game where money cannot bind, so nothing measured below is about ' +
          'the price').toBe('scoring')
        expect(g.refusedDraws, `${policy}/${seed} refused a draw with infinite money`).toBe(0)
      }
    }
    // ── AND THE PREDICATE MUST BE CAPABLE OF SAYING YES (Rule 130) ──────────────────────────────
    // Zero hangs across every row is the result this session wanted, which is exactly why it needs
    // its second producer named. `uiAllowsEndTurn` is `!placements && !canAcquire()`, so a
    // canAcquire that is STUCK AT FALSE erases every hang too · the game would simply be allowed to
    // pass whenever no placement existed. That failure is invisible in the outcome column and it
    // points the flattering way. So the predicate is asked directly, on a fresh board where the
    // answer is knowable: cards exist, money is unlimited, therefore YES.
    useGameStore.setState(useGameStore.getInitialState(), true)
    useGameStore.getState().initGame(
      [{ userId: 'A', username: 'A' }, { userId: 'B', username: 'B' }],
      [...DECK], [...PRODUCTION_TILES])
    useGameStore.setState(s => { for (const p of s.players) p.wallet = Infinity })
    expect(useGameStore.getState().canAcquireCard(0), 'canAcquireCard says NO on a full deck with ' +
      'an unlimited wallet · the predicate is stuck at false, which silently removes every soft-lock ' +
      'from the sweep above and would let the flag ship on a measurement of nothing').toBe(true)
    useGameStore.setState(s => { for (const p of s.players) p.wallet = 0 })
    expect(useGameStore.getState().canAcquireCard(0), 'canAcquireCard says YES at a zero wallet · ' +
      'stuck at true, which would report hangs the game does not have').toBe(false)
  })

  // ── COUNTERWEIGHT 3 · THE TIGHT BUDGET MUST ACTUALLY BITE ─────────────────────────────────────
  // A budget that refuses nothing makes "no soft-lock found" vacuous · the arm would be the free
  // game under a different label (Rule 130 · how many ways could this result be produced).
  it('a two-card budget really does refuse draws', () => {
    const refused = names.map(p => playWithPolicy(p, SEEDS[0], { wallet: CARD_PRICE * 2 }).refusedDraws)
    expect(Math.max(...refused), 'not one policy had a draw refused at a TWO-CARD budget · the ' +
      'price is not being applied and the absence of a lock below means nothing')
      .toBeGreaterThan(0)
  })

  // ── THE MEASUREMENT ───────────────────────────────────────────────────────────────────────────
  it('sweeps every policy at every budget and reports whether a price can hang a game', () => {
    const rows = []
    for (const policy of names) {
      for (const cards of [0, 1, 2, 4, 8, 14]) {   // 14 = STARTING_WALLET / CARD_PRICE · what ships
        const budget = CARD_PRICE * cards
        let hung = 0, scoring = 0, capped = 0, refused = 0
        const evidence = []
        const healthy = []   // the games that ENDED · the column the flag decision rests on
        for (const seed of SEEDS) {
          const r = playWithPolicy(policy, seed, { wallet: budget })
          refused += r.refusedDraws
          if (r.outcome === 'hung') {
            hung++
            if (evidence.length < 2) {
              evidence.push(`turn ${r.turns} · cardsExist ${r.cardsExist} · placements ` +
                `${r.placements} · allBroke ${r.broke}`)
            }
          } else if (r.outcome === 'scoring') { scoring++; healthy.push({ seed, ...r }) }
          else capped++
        }
        rows.push({ policy, cards, hung, scoring, capped, refused, evidence, healthy })
      }
    }
    for (const r of rows) {
      // eslint-disable-next-line no-console
      console.log(`SOFTLOCK ${r.policy.padEnd(18)} budget ${String(r.cards).padStart(2)} cards  ` +
        `hung ${String(r.hung).padStart(2)}/${SEEDS.length}  scoring ${String(r.scoring).padStart(2)}  ` +
        `capped ${String(r.capped).padStart(2)}  refusedDraws ${r.refused}`)
      for (const e of r.evidence) console.log(`           └─ ${e}`)  // eslint-disable-line no-console
    }

    // POSITIVE CONTROL ON THE SWEEP ITSELF · a budget of ZERO cards cannot buy anything, so if not
    // one draw was refused anywhere in this table the whole sweep ran without a price.
    expect(rows.filter(r => r.cards === 0).reduce((n, r) => n + r.refused, 0),
      'a ZERO budget refused no draws across every policy and seed · the sweep is unpriced')
      .toBeGreaterThan(0)

    globalThis.__s68_locks = rows.filter(r => r.hung > 0)
    expect(rows.length, 'the sweep produced no rows').toBeGreaterThan(0)

    // ══ THE SCOPING FACT THE OUTCOME COLUMN HID, AND IT NARROWS S68's HEADLINE (T2 S69) ══════════
    // S68 reported "greedy survives at the shipping budget, so 14 cards is only unsafe under
    // adversarial play". Printing the values behind the healthy column kills that reading: every
    // healthy row has refusedDraws ZERO. greedy places whenever it can, so it barely draws, so the
    // price never binds on it · its healthy games are the FREE game wearing a budget label.
    //
    // Stated as the relation rather than as four numbers I read off a table: NO MEASURED GAME HAS
    // EVER BOTH BEEN PRICED AND ENDED. Every row where a draw was refused hung 12/12; every row that
    // reached scoring refused nothing. That is a far stronger and far less comfortable claim than
    // "3 of 4 policies hang", and it is the one Council's flag decision should be read against.
    const pricedAndEnded = rows.filter(r => r.refused > 0 && r.scoring > 0)
    const pricedRows = rows.filter(r => r.refused > 0)
    // POSITIVE CONTROL · if no row was ever priced, "no priced row ended" is vacuously true and says
    // nothing at all (Rule 120 · the absence needs the mechanism exercised in the same run).
    expect(pricedRows.length, 'not one row in the sweep had a draw refused · nothing was priced, so ' +
      'the relation below is vacuous').toBeGreaterThan(0)
    // eslint-disable-next-line no-console
    console.log(`SCOPE · ${pricedRows.length} of ${rows.length} rows were actually PRICED (a draw ` +
      `was refused) · of those, ${pricedAndEnded.length} produced a game that ENDED`)

    // ══ THE HEALTHY COLUMN, CHECKED RATHER THAN COUNTED (T2 S69) ═════════════════════════════════
    // ⚠ THIS IS THE PRECONDITION COUNCIL PUT ON FLIPPING THE FLAG, and it exists because of my own
    // S68 closing critique: I reported hung/scoring/capped and asserted NOTHING about the games in
    // the scoring column. `greedy@14cards reaching scoring 12/12` is the entire basis for "the
    // shipping budget is only unsafe under adversarial play" · and a game that ended instantly, or
    // with nobody scoring, or having lost cards, would have read as green in exactly that column.
    //
    // A verdict-shaped absence sitting in a verdict column · the fourth instance in four sessions,
    // and the first one that is load-bearing for a DECISION rather than for a report.
    const healthyRows = rows.filter(r => r.healthy.length > 0)
    // PRINT THE UNMUTATED VALUES AT THE ASSERTED LINES. A bound sitting far from the data is a real
    // guard; one sitting on it is a flake, and one the fixture cannot violate is decoration · and
    // those three are indistinguishable from a green run (Rule 132a · print the value before
    // believing the pass).
    for (const row of healthyRows) {
      const t = row.healthy.map(g => g.turns)
      const sc = row.healthy.map(g => g.state.scored.reduce((n, x) => n + x, 0))
      // eslint-disable-next-line no-console
      console.log(`HEALTHY  ${row.policy.padEnd(18)} budget ${String(row.cards).padStart(2)} cards  ` +
        `n=${row.healthy.length}  turns ${Math.min(...t)}-${Math.max(...t)} (bound >8)  ` +
        `cards scored ${Math.min(...sc)}-${Math.max(...sc)} (bound >0)  ` +
        `deck reconciles to ${DECK.length}`)
    }
    // POSITIVE CONTROL FIRST · if nothing reached 'scoring' anywhere, every assertion below is
    // vacuous and the sweep has no healthy column to bound the defect with (Rule 120).
    expect(healthyRows.length, 'not one game in the entire sweep reached scoring · there is no ' +
      'healthy column, so nothing below is asserting anything and the blast radius is UNMEASURED')
      .toBeGreaterThan(0)

    const scoreless = []
    for (const row of healthyRows) {
      for (const g of row.healthy) {
        const tag = `${row.policy}@${row.cards}cards seed ${g.seed}`
        if (g.state.scored.reduce((n, x) => n + x, 0) === 0) scoreless.push({ ...row, tag })
        // 1 · IT WAS PLAYED, NOT ABANDONED. A two-player Classic game burns 12 tiles through
        //     placements plus a two-round endgame; ending in a handful of turns means the terminal
        //     condition fired on a board nobody had built on.
        expect(g.turns, `${tag} reached scoring in only ${g.turns} turns · the game ended almost ` +
          'immediately, so "scoring" here is a terminal condition firing early rather than a game ' +
          'being played, and this row cannot bound anything').toBeGreaterThan(8)
        expect(g.turns, `${tag} took ${g.turns} turns · past the 400-turn cap this is not a ` +
          'finished game').toBeLessThanOrEqual(400)

        // 2 · SOMEBODY ACTUALLY SCORED · asserted only where BUYING IS POSSIBLE AT ALL.
        //     ⚠ THIS FIRED AT budget 0 AND IT WAS RIGHT TO (T2 S70). `neverEmptyFactory@0cards`
        //     ends with [0,0] scored. At a zero budget no card can EVER be bought, so a player has
        //     only their three dealt cards and a policy that also declines to empty factories may
        //     legitimately complete none of them. That is a correct outcome of an impossible
        //     economy, not a defect · and budget 0 is the far end of a sweep, not a shipping
        //     configuration.
        //     It is SCOPED rather than weakened (Rule 110c · a tolerance widened to accommodate a
        //     defect is a defect with permission): the assertion's premise is a playable economy,
        //     and at 0 cards that premise is false. Every scoreless game is still COUNTED and
        //     printed below, so if one ever appears at a buyable budget it is loud.
        if (row.cards > 0) {
          expect(g.state.scored.reduce((n, x) => n + x, 0), `${tag} ended with NOBODY having ` +
            `scored a single card (${JSON.stringify(g.state.scored)}) at a budget that CAN buy ` +
            `${row.cards} card(s) · the outcome column calls that healthy and it is a game nobody ` +
            'could have played').toBeGreaterThan(0)
        }

        // 3 · THE DECK RECONCILES. Every one of the 56 cards is scored, in a hand, in the deck, or
        //     face-up in the offer. This is the assertion that would catch a draw that debited and
        //     delivered nothing · precisely the failure a price introduces (Rule 29), and the one
        //     the outcome column is structurally blind to.
        // ⚠ PROVEN FOR THE OFFER PATH ONLY. Mutating the DECK branch so a drawn card never reaches
        // the hand left this GREEN · the driver draws from the Offer whenever it is non-empty and
        // endTurn replenishes it every turn, so the deck branch is almost never taken and the
        // mutation landed in the file without landing in the measurement (Rule 132). The same
        // mutation on the OFFER branch reds immediately, at 50 of 56. So the assertion works and its
        // coverage is one path narrower than it reads.
        const inHands = g.state.hands.reduce((n, x) => n + x, 0)
        const inScored = g.state.scored.reduce((n, x) => n + x, 0)
        const total = inHands + inScored + g.state.deck + g.state.offer
        expect(total, `${tag} accounts for ${total} of ${DECK.length} cards · ${inHands} held + ` +
          `${inScored} scored + ${g.state.deck} deck + ${g.state.offer} offer. A card left the ` +
          'accounting: a purchase that debited and delivered nothing would look exactly like this, ' +
          'and it is the failure mode a price is most likely to introduce').toBe(DECK.length)
      }
    }
    // THE CENSUS, printed whether or not anything failed · a scoreless game at a BUYABLE budget is
    // the alarming case and it must never be silently absent from the record.
    const atBuyable = scoreless.filter(x => x.cards > 0)
    // eslint-disable-next-line no-console
    console.log(`SCORELESS · ${scoreless.length} game(s) ended with nobody scoring · ` +
      `${atBuyable.length} of them at a budget that can buy at least one card` +
      (scoreless.length ? ` · ${[...new Set(scoreless.map(x => `${x.policy}@${x.cards}`))].join(', ')}` : ''))
    expect(atBuyable, 'a game ended with nobody scoring at a budget where cards CAN be bought · ' +
      'that is not the zero-budget artifact, it is a playable economy producing an unplayable game')
      .toEqual([])
  }, 600_000)

  // ── PROMOTED FROM it.fails · THE DEFECT IS CLOSED (T2 S70) ────────────────────────────────────
  // S68 carried this as `it.fails` because the fix was one line in T1's file and reddening the merge
  // gate for three lanes would have been a tripwire aimed at colleagues. The contract was: it passes
  // while the defect stands and REDS THE DAY T1 FIXES IT.
  //
  // It red tonight · `Error: Expect test to fail` · which is the whole design working. T1 shipped
  // dbdd622 ("the gate asked whether a card EXISTS"), the driver now models the fixed gate, and
  // every one of the 24 rows reports 0 hangs. So it becomes an ordinary assertion, which is the only
  // form that can protect the fix from being reverted.
  //
  //     S68   drawHeavy / oneRegion / neverEmptyFactory   12/12 HUNG at the shipping budget
  //     S70   every policy, every budget                  0/12 hung
  it('no policy soft-locks at any budget · T1 dbdd622 closed it', () => {
    const locks = globalThis.__s68_locks ?? []
    expect(locks, `a PRICE can soft-lock the game: ${locks.map(l => `${l.policy}@${l.cards}cards ` +
      `${l.hung}/${SEEDS.length}`).join(', ')}. A player who cannot afford a card and cannot place ` +
      'can neither act nor pass, because T1\'s End Turn escape asks whether a card EXISTS rather ' +
      'than whether it can be BOUGHT · and the engine\'s own deadlock terminal does not save them ' +
      'because it also requires no placement. This is the S44 lock returning through a door the ' +
      'wallet opened. If this is red the End Turn escape has stopped asking affordability · check ' +
      'GameRoom.jsx and fuzzDriver.uiAllowsEndTurn together, because the model and the product have ' +
      'to move as one.').toEqual([])
  })
})
