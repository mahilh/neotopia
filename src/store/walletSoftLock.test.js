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
const { WALLET_ENABLED, CARD_PRICE } = await import('./gameConfig')

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
        for (const seed of SEEDS) {
          const r = playWithPolicy(policy, seed, { wallet: budget })
          refused += r.refusedDraws
          if (r.outcome === 'hung') {
            hung++
            if (evidence.length < 2) {
              evidence.push(`turn ${r.turns} · cardsExist ${r.cardsExist} · placements ` +
                `${r.placements} · allBroke ${r.broke}`)
            }
          } else if (r.outcome === 'scoring') scoring++
          else capped++
        }
        rows.push({ policy, cards, hung, scoring, capped, refused, evidence })
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
  }, 600_000)

  // ── THE DEFECT, CARRIED AS AN EXPECTED FAILURE SO IT CANNOT RED A SHARED GATE ──────────────────
  // The fix is ONE LINE IN T1'S FILE (GameRoom.jsx:750 · `canDraw` asks whether a card EXISTS, not
  // whether it can be BOUGHT), so reddening the merge gate for three lanes would be a tripwire aimed
  // at colleagues (preamble §5 / Rule 103b). `it.fails` is the documented shape: it passes while the
  // defect stands, and REDS THE DAY T1 FIXES IT · which is the signal to promote it to a real
  // assertion. The counterweights above are the WORKS guard, because an it.fails cannot notice its
  // own broken setup.
  it.fails('T1 ROUTED · no policy soft-locks at the shipping budget', () => {
    const locks = globalThis.__s68_locks ?? []
    expect(locks, `a PRICE can soft-lock the game: ${locks.map(l => `${l.policy}@${l.cards}cards ` +
      `${l.hung}/${SEEDS.length}`).join(', ')}. A player who cannot afford a card and cannot place ` +
      'can neither act nor pass, because T1\'s End Turn escape asks whether a card EXISTS rather ' +
      'than whether it can be BOUGHT · and the engine\'s own deadlock terminal does not save them ' +
      'because it also requires no placement. This is the S44 lock returning through a door the ' +
      'wallet opened. DO NOT flip WALLET_ENABLED until the gate reads affordability.\n' +
      'IF THIS TEST IS RED, the gate has been fixed · delete the .fails and keep the assertion.')
      .toEqual([])
  })
})
