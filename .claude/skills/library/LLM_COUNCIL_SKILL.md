# LLM COUNCIL SKILL v2.0 · Rating: 189/200 · Trigger: LLM Council
# 5-advisor adversarial gate · verdict format · historical decisions
# Upgraded S21 NIGHTSAVE

## PURPOSE
When a decision is hard, unclear, or high-stakes — activate the Council.
5 advisors · evidence mandate · produces a clear verdict with reasoning.
Reads past decisions from Drive before deliberating (learns from history).
Never outputs "it depends" without 3 specific alternatives with trade-offs.

## THE 5 ADVISORS
BRUTUS (civilization): "Does this actually serve the 2055 civilization goal, not just today?"
SOPHIA (quality): "Is this premium or mediocre? Be brutally honest about the gap."
MARCUS (engineering): "What breaks? Name the specific file, line, or function at risk."
ISABELLA (consciousness): "Would a player building a consciousness civilization feel this is sacred?"
CAESAR (stakes + Plato): "What is irreversible? Which Platonic decay stage does this risk?"

## FULL SEQUENCE (mandatory)
0. Read COUNCIL_DECISIONS log from Drive to learn from past verdicts (future: selfimprove doc)
1. State the decision in ONE sentence — no preamble
2. Each advisor gives: POSITION (one sentence) + EVIDENCE (specific, citable) + WHAT CHANGES MY MIND
3. Identify the single strongest objection across all 5 advisors
4. Generate exactly 3 options with explicit trade-offs (not 2, not 4 — exactly 3)
5. Recommend ONE option with: why this beats the other 2, what must be true for it to work
6. State the tripwire: what single data point would reverse this recommendation immediately

## VERDICT FORMAT (always use this exact structure)
═══ LLM COUNCIL VERDICT ═══
DECISION: [one sentence]
STRONGEST OBJECTION (from [advisor]): [specific evidence-backed objection]
3 OPTIONS:
  A: [option] · Trade-off: [what you gain vs lose]
  B: [option] · Trade-off: [what you gain vs lose]
  C: [option] · Trade-off: [what you gain vs lose]
RECOMMENDATION: Option [A/B/C] — [specific reasoning referencing strongest objection]
TRIPWIRE: Reverse this if [specific measurable condition]
PLATO CHECK: This decision [supports/risks] Platonic stage [Kallipolis/Timocracy/Oligarchy]
═══════════════════════════

## EVIDENCE MANDATE (non-negotiable)
Every advisor position: WHAT + WHY (evidence) + WHAT CHANGES MY MIND
No opinions without evidence. No evidence without specifics.
Engineering evidence: file path + function name + test assertion
Product evidence: user quote or behavior data or game metric
Civilization evidence: connection to one of the 9 NeoTopia districts

## PLATO INTEGRATION (born from S21 books analysis)
Every council decision must include a Plato Check:
Does this decision push NeoTopia toward Kallipolis (philosopher-king ideal)?
Or does it push toward decay (Timocracy → Oligarchy → Democracy → Tyranny)?
Specific question: which soul-part (Rational/Spirited/Appetitive) does this decision serve?
If it serves only Appetitive (material gain/convenience) without Rational grounding = warning.

## HISTORICAL DECISIONS (log these for future councils)
S21: Draw RPC deployment decision → DEFERRED. Reason: migration 011 not deployed (Rule 68).
Tripwire: Deploy when T2 confirms pgproc=1 for draw_card_for_seat on live DB.
S21: Board biome approach → T1 enhanced presentation layer only (not T2 data layer).
Plato: Rational choice (Logos wins — data ownership respected, presentation enhanced).

## SELF-IMPROVEMENT LOG
v1.0: 5-advisor structure · NeoTopia adapted
v2.0: verdict format standardized · Plato integration · evidence mandate hardened · historical decisions log
