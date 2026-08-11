// FLOW MODE · is anything we measured in Classic even true there?  (T2 S50 · P3)
// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE PREMISE, AND IT IS MY OWN RULE 111 AIMED AT MY OWN HARNESS FOR THE SECOND TIME.
// Rule 111 (S49): a constant that appears at every call site of an experiment is a hidden parameter,
// and its value silently qualifies every result. I wrote it about REFERENCE_POLICY, then ran the same
// grep against the balance harnesses and found a second one:
//
//     initGame(configs, deck, tiles)          <- every harness · NO 4th argument · always Classic
//     initGame(playerConfigs, shuffledDeck, shuffledTiles, mode = DEFAULT_GAME_MODE)
//
// So every balance finding from S39 to S50 · the token thresholds, the spend effect, the earn skew,
// the ladder retune · is a CLASSIC-MODE finding. Flow is shipped, user-selectable from the lobby
// (data-testid=mode-flow), and runs NINE production tiles instead of twelve.
//
// WHY THAT IS NOT A DETAIL. Bonus tokens are earned by crossing 7/13/18 points in a region
// (docs/NEOTOPIA_GAME_RULEBOOK.md:115-125). Production tiles are the game's clock, so a quarter fewer
// tiles is a materially shorter game and materially lower scores. If Flow games rarely reach 13, the
// token subsystem is close to inert there · and "change nothing, the effect is +7.7 points" would be
// a statement about a mode, described as a statement about the game.
//
// Mahil's decision was rescoped in S50 for exactly this reason: "change nothing" stands for 2-player
// Classic and is closed there; Flow is unmeasured and the decision does not extend to it. This file
// is the measurement that says how far it does or does not extend.
//
// WHAT THIS IS NOT. It is not a Flow BALANCE verdict. It answers the prior question · does the same
// machinery even engage · and reports the numbers a verdict would need.
//
// ── MEASURED · THREE DISJOINT 40-SEED BLOCKS (FLOW_OFFSET 0 / 700 / 1400) ─────────────────────────
//
// 1 · THE HYPOTHESIS IS FALSIFIED, AND THAT IS THE GOOD NEWS. The brief's worry was that "the 7/13/18
//     thresholds may rarely be crossed and the token subsystem could be near-inert" in Flow. It is
//     not. Flow grants tokens at a stable fraction of Classic's volume:
//
//       apprentice  0.612 / 0.656 / 0.596      (2.65 tokens per game against Classic's 4.33)
//       builder     0.787 / 0.792 / 0.807      (3.52 against 4.47)
//       architect   0.685 / 0.661 / 0.646      (3.70 against 5.40)
//
//     A quarter fewer tiles costs roughly a fifth to two fifths of the token volume · a proportionate
//     reduction, not a cliff. The block-to-block spread is under 0.06 in every row, so this is one of
//     the tightest numbers in the balance record. The token DECISION therefore transfers to Flow far
//     better than the rescope feared, and the one thing that would have made it not transfer · a mode
//     where the subsystem is unreachable · is ruled out.
//
// 2 · BUT THE LADDER CALIBRATION DOES NOT TRANSFER, and this is the finding worth acting on:
//
//                        Classic v2      Flow
//       app v bld           33.5         27.6
//       bld v arc           31.6         39.9
//       STEP GAP             1.9         12.3       <- evenness is a Classic property
//
//     Ordered in both, so no rung is broken. But S50 retuned the ladder to sit at ~33/33 and in Flow
//     it sits at ~28/40 · the bottom step is HARDER and the top step is EASIER. The likely mechanism,
//     stated as the hypothesis it is: apprentice's only handicap is random placement, and in a game a
//     quarter shorter there are fewer turns in which to recover from a bad placement, so the same
//     handicap bites harder. Untested · a decomposition sweep in Flow would settle it and did not run.
//
//     So docs/LADDER_CALIBRATION.md's numbers are Classic numbers, and they now say so.



import { describe, it, expect } from 'vitest'
import { ladderRow, makeReporter } from './ladderHarness'
import { DIFFICULTIES } from '../lib/botPolicy'
import { GAME_MODES } from './gameConfig'

const SEEDS = Number(process.env.FLOW_SEEDS || 12)
const OFFSET = Number(process.env.FLOW_OFFSET || 0)
const seeds = Array.from({ length: SEEDS }, (_, i) => 3000 + OFFSET + i * 11)
const report = makeReporter('FLOW_OUT')

describe(`flow mode · does the Classic measurement transfer? (${SEEDS} seeds x 2)`, () => {
  // ── COUNTERWEIGHT, FIRST AND ALONE (Rule 90) ────────────────────────────────────────────────────
  // The way this file reports a confident nothing is that the mode argument DOES NOT ARRIVE. If
  // `mode` were dropped anywhere between here and initGame · a missing parameter in playOnce, a
  // typo'd mode string falling back to the default, a store that ignores the 4th argument · then
  // every "Flow" row below would be a Classic game wearing a Flow label, and the file would
  // cheerfully report that Flow and Classic behave identically. That is not a hypothetical: it is
  // precisely the finding I would expect to see, so it is indistinguishable from the bug.
  //
  // The tile count is the discriminator, and it is structural rather than statistical: Flow is
  // defined as 9 tiles against Classic's 12, so a real Flow game MUST be shorter. Asserted before
  // anything is measured, and read from GAME_MODES rather than retyped (Rule 92a · a retyped constant
  // is a second contract).
  it('a Flow game is genuinely shorter than a Classic one · the mode argument arrives', () => {
    expect(GAME_MODES.flow.END_GAME_TILE, 'the premise of this whole file is that Flow has fewer ' +
      'production tiles · if that stops being true the discriminator below is gone')
      .toBeLessThan(GAME_MODES.classic.END_GAME_TILE)

    const classic = ladderRow('builder', 'builder', seeds, 'classic')
    const flow = ladderRow('builder', 'builder', seeds, 'flow')
    report('counterweight', {
      classicTokens: classic.tokensPerGame, flowTokens: flow.tokensPerGame,
      classicTiles: GAME_MODES.classic.END_GAME_TILE, flowTiles: GAME_MODES.flow.END_GAME_TILE,
    })

    // Identical policies, identical seeds · the ONLY difference is the mode. If these two rows agree
    // on token volume, the mode never reached the engine.
    expect(flow.tokensPerGame, `Flow granted ${flow.tokensPerGame} tokens per game and Classic ` +
      `granted ${classic.tokensPerGame} · IDENTICAL. The mode argument is not reaching initGame, so ` +
      'every row in this file is a Classic game with a Flow label and the finding is an artifact')
      .not.toBe(classic.tokensPerGame)

    // Both self-play rows must still tie · the mode must not hand either seat an advantage.
    for (const [name, r] of [['classic', classic], ['flow', flow]]) {
      expect(Math.abs(r.marginEarned), `${name}: builder against ITSELF carries a ${r.marginEarned}-` +
        'point margin · the harness has a side in this mode and every row below inherits it')
        .toBeLessThan(1)
    }
  }, 300_000)

  // ── THE QUESTION · is the token subsystem reachable in Flow at all? ─────────────────────────────
  it('reports whether bonus tokens are earnable in Flow, and how the ladder sits', () => {
    const out = {}
    for (const level of DIFFICULTIES) {
      const c = ladderRow(level, level, seeds, 'classic')
      const f = ladderRow(level, level, seeds, 'flow')
      out[level] = {
        tokensClassic: c.tokensPerGame, tokensFlow: f.tokensPerGame,
        tokenRatio: c.tokensPerGame ? +(f.tokensPerGame / c.tokensPerGame).toFixed(3) : null,
      }
    }
    const pairs = {
      app_v_bld: ladderRow('apprentice', 'builder', seeds, 'flow'),
      bld_v_arc: ladderRow('builder', 'architect', seeds, 'flow'),
      app_v_arc: ladderRow('apprentice', 'architect', seeds, 'flow'),
    }
    out.ladderFlow = {
      app_v_bld: pairs.app_v_bld.winPctEarned,
      bld_v_arc: pairs.bld_v_arc.winPctEarned,
      app_v_arc: pairs.app_v_arc.winPctEarned,
    }
    report('flow_vs_classic', out)

    // GATED: the ladder must still be ORDERED in Flow. A difficulty setting that is only a difficulty
    // in one of two shipped modes is a bug a player meets on their second game, and this is the only
    // thing here that is a property rather than a measurement.
    expect(pairs.app_v_bld.winPctEarned, 'apprentice must lose to builder in FLOW too')
      .toBeLessThan(50)
    expect(pairs.bld_v_arc.winPctEarned, 'builder must lose to architect in FLOW too')
      .toBeLessThan(50)

    // REPORTED, NOT GATED: how much of the token subsystem survives the shorter clock. A bound here
    // would be encoding a balance target for a mode nobody has decided anything about yet, which is
    // the mistake this file exists to prevent someone making in the other direction.
    // What IS gated is the honest floor · if Flow ever grants literally zero tokens in every game at
    // every difficulty, the subsystem is unreachable there and that is a product fact Mahil needs,
    // not a number to file away.
    const anyTokens = DIFFICULTIES.some(l => out[l].tokensFlow > 0)
    expect(anyTokens, 'NO bonus token was granted in ANY Flow game at ANY difficulty · the subsystem ' +
      'is unreachable in a shipped, user-selectable mode. That is not a balance question, it is a ' +
      'feature that does not exist for half the game modes').toBe(true)
  }, 600_000)
})
