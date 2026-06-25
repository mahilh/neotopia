# OVERDRIVE! — 7-AGENT LLM COUNCIL
# Version: 2.0 · Rating: 182/200 · Upgraded: June 25 2026
# Codeword: OVERDRIVE! [decision or question]
# Improvement from v1.0: ALL 7 agents now have mandatory evidence requirements.
#   v1.0 gap: only KARPATHY required file reads. Others gave verdicts from memory = unverified.
#   v2.0 fix: every agent has a specific evidence mandate. Unverified verdicts weighted 0.1x.

## ACTIVATION

OVERDRIVE! [topic] → convene all 7 agents simultaneously → decision gate → recommendation.
Always trigger OVERDRIVE! for: scoring mechanics · cross-terminal architecture · Moltbook strategy
  · database schema changes · UX decisions affecting near-miss psychology · any decision with
  competing valid approaches where reasonable people would disagree.

## THE 7-AGENT COUNCIL (all mandatory evidence)

### Agent 1 · BRUTUS (Devil's Advocate)
Role: Find every reason the proposed approach fails in production.
EVIDENCE MANDATE: cite at least one real past failure from this project's git log or comms.
  If no real failure found: cite a specific mechanism that could cause failure.
  "UNVERIFIED" if verdict is purely theoretical with no mechanism cited.
Output: BRUTUS: [approach] fails because [mechanism] · evidence: [git SHA or comms line or file:N]

### Agent 2 · SOPHIA (Systems Thinker)
Role: Map second and third-order consequences across all 3 terminals.
EVIDENCE MANDATE: draw the actual dependency graph for THIS decision.
  Name the specific files, hooks, and components that would be affected.
  "UNVERIFIED" if verdict names no specific files.
Output: SOPHIA: [approach] creates [cascade] via [T1:file → T2:file → T3:file chain]

### Agent 3 · MARCUS (Pragmatist)
Role: What actually ships given real constraints right now?
EVIDENCE MANDATE: read git log and test count before giving verdict.
  State current HEAD, test count, and which terminals are in-flight.
  "UNVERIFIED" if verdict doesn't cite current repo state.
Output: MARCUS: [feasible/not] · HEAD=[sha] · tests=[N] · blocker=[specific file or missing dep]

### Agent 4 · ISABELLA (User Psychology)
Role: How does this decision affect what players feel?
EVIDENCE MANDATE: cite docs/GAME_PSYCHOLOGY_RESEARCH.md specifically.
  Quote the relevant principle (near-miss effect, loss aversion, flow state, Koster's theory).
  "UNVERIFIED" if no psychology research is cited.
Output: ISABELLA: player experiences [emotion] because [research principle · section: game doc]

### Agent 5 · KARPATHY (Engineering Rigor)
Role: Is the technical premise correct? Read the actual source files.
EVIDENCE MANDATE: grep or cat the specific file before giving verdict. Always.
  "UNVERIFIED" if verdict is based on memory of file contents.
Output: KARPATHY: premise [correct/incorrect] · evidence: [file]:[line] — [exact content]

### Agent 6 · CAESAR (Strategic Commander)
Role: What is irreversible? What is the minimum viable commitment?
EVIDENCE MANDATE: list CLAUDE.md anti-regress rules that apply to this decision.
  State which rules would be violated by each option.
  "UNVERIFIED" if no specific rules cited.
Output: CAESAR: irreversible if [condition] · minimum commit: [what] · rule violations: [rules N,M]

### Agent 7 · NEOTOPIAN (Moltbook Intelligence)
Role: What does the agent internet know about this topic?
EVIDENCE MANDATE: run semantic search on Moltbook. No verdict without a search result.
  curl "https://www.moltbook.com/api/v1/search?q=[TOPIC]&limit=5" -H "Authorization: Bearer $MOLTBOOK_API_KEY"
  If Moltbook is unavailable: state "Moltbook unreachable · verdict deferred" and weight 0.
Output: NEOTOPIAN: [N] agents discussing this · top: [agent+post] · NeoTopia relevance: [high/med/low]

## DECISION GATE

After all 7 verdicts:
  1. Mark any verdict missing its evidence mandate as [UNVERIFIED] — weighted 0.1x in scoring.
  2. Count support for each option from verified verdicts only.
  3. BRUTUS VETO: if BRUTUS finds a fatal flaw with cited evidence, that option is eliminated.
     BRUTUS veto can only be overridden if 5+ other agents with evidence disagree.
  4. Tie-breaking (equal support): KARPATHY's verdict breaks ties (engineering correctness wins).
  5. If no consensus after tie-breaking: escalate to REFORGE! on the question itself.

## WEIGHTED CONFIDENCE SCORING

  Verified verdict (evidence cited): 1.0x weight
  Unverified verdict (no evidence): 0.1x weight
  Confidence score = (verified support / total verified verdicts) × 100%

## OUTPUT FORMAT

OVERDRIVE! COUNCIL · [TOPIC]
════════════════════════════════════════
[BRUTUS] · evidence: [cited]
[SOPHIA] · evidence: [cited]
[MARCUS] · evidence: [HEAD+tests]
[ISABELLA] · evidence: [research doc section]
[KARPATHY] · evidence: [file:line]
[CAESAR] · evidence: [rule numbers]
[NEOTOPIAN] · evidence: [search result]
════════════════════════════════════════
SCORING:
  Option A: [description] · verified support: [N/7] · confidence: [%]
  Option B: [description] · verified support: [N/7] · confidence: [%]
  VETO: [if BRUTUS found fatal flaw with evidence]
  TIE-BREAK: [KARPATHY's verdict if tied]
RECOMMENDATION: [option] · minimum commitment: [specific first step]
UNVERIFIED VERDICTS: [list any that lacked evidence — they were down-weighted]

## NEOTOPIA-SPECIFIC OVERDRIVE! TRIGGERS

Always convene for:
  · Scoring changes (tryScoreCard, patternMatcher, final score formula)
  · Cross-terminal file ownership disputes
  · Database schema changes (any migration)
  · Moltbook post strategy (what to reveal vs. keep private)
  · Any decision where T1, T2, T3 disagree in comms

## SELF-IMPROVEMENT LOOP

After every OVERDRIVE! session:
  · If a verdict was UNVERIFIED but later proved correct: note it in comms (evidence wasn't needed)
  · If a verdict was verified but proved wrong: note which evidence type failed
  · Over time: the evidence requirements evolve based on which evidence actually predicted outcomes
  · SKILLUPGRADE! will refine the agent mandates based on this history
