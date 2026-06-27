# T1 S16 MASTER FORGE · sacredMilestone OVERLAY + FINALSCORE INDEX + MOBILE FIX
# NeoTopia · post S15 complete · June 27 2026
# LLM Council verdict: 3 tasks, scoped precisely by 5 advisors
# Forge self-rate /200 BEFORE touching any file. <85 = REWRITE.
# T1 lane: src/components/ · src/pages/ · src/index.css

## S15 COMPLETE (T1 committed, verified, merged):
  cc45e86: dim-the-rest UX (per-phase computed opacity)
  f8e8f56: action log (element-colored, left of board, age-fade)
  6a11c79: element placement burst (6 SVG particles, burst0-5)
  f423a8f: draw-log gate polish
  Key lessons: verify the value not the signature (Rule 61). sessionId silent no-op averted.
  Mobile gap found by T3: board collapses to 55px at 375px (T1 S16 Task C).

## WHAT T2 SHIPPED (read before touching sacredMilestone or Global Index):
  69fbc14: sacredMilestone events in store (tryScoreCard fires at 7/9/13/18/27/36)
    Shape: { player: seat, milestone: number, message: string, symbol: string }
    clearMilestone(): Zustand action
    SYMBOL WARNING: T2 swapped forge's \u2721 hexagram to \u2737. NEVER use \u2721.
  4780e00: getGlobalCivilizationTotal() query function (sum of all civilization scores)
    import from: check T2 S15 comms for exact file location
    RPC: record_civilization_score (not record_civilization_contribution)
  14400bc: Flow mode config + migration 010

## RULES MOST AT RISK THIS SESSION:
  Rule 61: Verify the VALUE not just the signature. console.log(sessionId) before wiring.
  Rule 55: Screenshots: overlay visible (1) + overlay gone after clearMilestone (2) +
           mobile fix desktop-no-regression (3) + mobile fix 375px board visible (4).
  Rule 37: CSS height is a request. Mobile fix must not break SVG board aspect ratio.
  Rule 1: mobile.e2e.js and tests/numerology.test.js are in the working tree.
           PATHSPEC COMMIT ONLY. Never git add -A.
  Rule 58: Read GameRoom.jsx z-index landscape + index.css media queries BEFORE writing.

## GATES (all 7 required before writing a single line)

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -100
  Confirm: cc45e86 f8e8f56 6a11c79 f423a8f in log (T1 S15 done)
  Confirm: 69fbc14 4780e00 14400bc in log (T2 S15 done)
  Confirm: Rule 61 + 62 + 63 in rules list
  Check: is T3 S16 Task A (sessionId exposure) in log? If YES: Task D (Global Index wire) is
         unlocked for this session. If NO: Task D is CONDITIONAL-SKIP.

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -80
  Confirm: T2 handed the sacredMilestone shape + getGlobalCivilizationTotal import path.
  Confirm: T3 handed sessionId exposure details (or confirmed it's pending).
  HARD STOP if another terminal claims src/pages/GameRoom.jsx or src/index.css mid-session.

Gate 3 (10 min — DO NOT SKIM):
  cat src/pages/GameRoom.jsx  (FULL FILE)
  Answer BEFORE coding:
    a. What is the main game layout class/div structure? (What class name or data attribute
       wraps the board+sidebar flex row?)
    b. What z-indexes exist in the file? List every z-index value.
    c. Does ScoreFlash render here? At what z-index?
    d. What does the sidebar's width come from? (CSS class? inline style? Tailwind?)
    e. Is there already a @media (max-width) query in src/index.css? List any found.
    f. Where does useGameStore expose sacredMilestone and clearMilestone?
       (grep: grep -n 'sacredMilestone\|clearMilestone' src/store/gameStore.js)
  Rule 58: DO NOT assume the layout class name. Verify it.
  Rule 37: DO NOT assume the sidebar has no fixed height. Check.

Gate 4: npx vitest run 2>&1 | tail -8 · 111 green required
Gate 5: npm run build 2>&1 | tail -5 · 0 errors required
Gate 6: git log --oneline -12 && git status --short
  Only T1 files in working tree. Any T3 file (mobile.e2e.js etc.) = DO NOT TOUCH.
Gate 7 (SCREENSHOT BASELINE — Rule 55):
  npm run dev &
  Screenshot the game in desktop mode BEFORE any changes.
  This is your regression baseline for Task C.
  If you cannot screenshot in dev: document why and proceed cautiously.

---

## TASK A · sacredMilestone OVERLAY (target: 49/50)
# Council verdict: HIGHEST ROI in S16. Zero collision risk. Pure new component.
# Store events are LIVE since T2 S15. This is just the visual layer.
# The mystery school reveals itself. This is the game's most conscious moment.

### WHAT TO BUILD: MilestoneOverlay.jsx
  A component that:
    - Reads sacredMilestone and clearMilestone from Zustand
    - Renders a centered overlay when sacredMilestone is non-null
    - Auto-dismisses after 2500ms via setTimeout + clearMilestone()
    - Shows: large symbol (amber-gold, 36px) + milestone number + message
    - Fades in 400ms, holds 1700ms, fades out 400ms (total: 2500ms = 2+5=7 spiritual perfection)

### DESIGN DECISIONS (from council):
  POSITION: absolute within the game container (NOT position:fixed — iframe restriction)
    The game container must have `position: relative` for this to work.
    Check Gate 3 answer: does the main game div already have position:relative?
    If not: add it (CSS only, no logic change).
  Z-INDEX: above everything else (ScoreFlash is in SVG = z-index: auto in SVG context)
    Use z-index: 200 on the overlay.
  NEVER use \u2721 hexagram. T2 S15 already caught this. The 9 symbol is \u2737.
    Full symbol map from T2 comms:
      7: \u2734 (six-pointed asterisk), 9: \u2737, 13: \u263d (crescent),
      18: \u2665 (heart), 27: \u25b3 (triangle), 36: \u25c6 (diamond)
  COLORS: amber-gold #C89440 for symbol and milestone number
          white/rgba for message text
          dark semi-transparent background: rgba(10,10,46,0.85)

### IMPLEMENTATION:

  Create src/components/MilestoneOverlay.jsx:

    import { useEffect } from 'react'
    import { useGameStore } from '../store/gameStore'  // verify import path

    const MILESTONE_MESSAGES = {
      7:  { message: 'Sacred Seven · Spiritual Perfection Awakens', symbol: '\u2734' },
      9:  { message: 'Nine · Completion · The Ennead Speaks',       symbol: '\u2737' },
      13: { message: 'Thirteen · Sacred Feminine · Transformation',  symbol: '\u263d' },
      18: { message: 'Eighteen · Life Doubled · The District Breathes', symbol: '\u2665' },
      27: { message: 'Twenty-Seven · Three Nines · Mastery',         symbol: '\u25b3' },
      36: { message: 'Thirty-Six · The Four Elements Complete',       symbol: '\u25c6' },
    }

    export function MilestoneOverlay() {
      const sacredMilestone = useGameStore(s => s.sacredMilestone)
      const clearMilestone = useGameStore(s => s.clearMilestone)

      useEffect(() => {
        if (!sacredMilestone) return
        const id = setTimeout(clearMilestone, 2500)
        return () => clearTimeout(id)
      }, [sacredMilestone, clearMilestone])

      if (!sacredMilestone) return null

      const info = MILESTONE_MESSAGES[sacredMilestone.milestone] ?? {}

      return (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(10,10,46,0.85)',
          animation: 'milestoneIn 0.4s ease',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 48, color: '#C89440', lineHeight: 1 }}>
            {info.symbol ?? '\u2737'}
          </div>
          <div style={{ fontSize: 32, fontWeight: 500, color: '#C89440',
            fontVariantNumeric: 'tabular-nums', marginTop: 8 }}>
            {sacredMilestone.milestone}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)',
            marginTop: 12, letterSpacing: 1.5, textAlign: 'center',
            maxWidth: 280 }}>
            {info.message ?? sacredMilestone.message}
          </div>
        </div>
      )
    }

  Add animation to src/index.css:
    @keyframes milestoneIn {
      0%  { opacity: 0; }
      16% { opacity: 1; }  /* 400ms of 2500ms */
      84% { opacity: 1; }  /* hold */
      100%{ opacity: 0; }  /* 400ms fade out */
    }

  Mount in GameRoom.jsx:
    Import MilestoneOverlay and render it inside the game container div:
    <div style={{ position: 'relative', ...existingStyles }}>
      <GameBoard ... />
      <ActionLog ... />
      <MilestoneOverlay />
    </div>
    VERIFY: the game container div already has or can have position:relative.
    If it does: just add the component. If it doesn't: add position:relative inline style.

### EVIDENCE GATE (Rule 55 — TWO screenshots required):
  Trigger a sacredMilestone in dev: manually set the store state.
    In browser console: window.__neotopia_store?.setState({sacredMilestone:{milestone:9, player:0}})
    (Verify the store's global name by reading gameStore.js)
  SCREENSHOT 1: overlay visible with \u2737 symbol and 'Nine · Completion · The Ennead Speaks'
  Wait 3 seconds.
  SCREENSHOT 2: overlay gone (auto-dismissed). Store sacredMilestone is null.
  If EITHER screenshot is missing: DO NOT commit.

### COMMIT:
  git add src/components/MilestoneOverlay.jsx src/pages/GameRoom.jsx src/index.css
  git commit -m 'feat(ui): sacredMilestone overlay · 2500ms · auto-dismiss · amber-gold · NeoTopia T1 S16'

---

## TASK B · FinalScore: getGlobalCivilizationTotal DISPLAY (target: 48/50)
# Council verdict: 10 lines of code. Transforms individual win into civilization contribution.
# getGlobalCivilizationTotal() is already built by T2 S15. Just call it and display.

### WHAT TO BUILD:
  In FinalScore.jsx, add a Global Index display section:
    "Civilization Index: [N] total points"
    "Your civilization contributed [localScore] points to Stage 2 of 5."

  Implementation:
    const [globalTotal, setGlobalTotal] = useState(null)
    useEffect(() => {
      getGlobalCivilizationTotal().then(total => setGlobalTotal(total))
    }, [])

    // In JSX:
    {globalTotal !== null && (
      <div style={{ /* match existing FinalScore style */ }}>
        <div>Civilization Index: {globalTotal.toLocaleString()} total</div>
        <div>Your civilization contributed {localScore} to Stage 2 of 5</div>
      </div>
    )}

### PREMISE CHECKS REQUIRED (Rule 56):
  Find the exact import path for getGlobalCivilizationTotal:
    grep -rn 'getGlobalCivilizationTotal' src/lib/ src/store/
  Verify the function signature: does it take any arguments? What does it return?
  Read FinalScore.jsx FULLY to see how localScore is computed (what variable holds the total?)
  Confirm: does FinalScore already have any async effects? (Avoid double-firing)

### EVIDENCE GATE (Rule 55):
  Screenshot FinalScore after a real game (or trigger it in dev mode).
  Confirm: 'Civilization Index: N' appears.
  Confirm: 'Stage 2 of 5' text is visible.
  If globalTotal is null or query fails: the section is hidden (not errored). That's correct.

### COMMIT:
  git add src/components/FinalScore.jsx (or src/pages/FinalScore.jsx — verify path)
  git commit -m 'feat(ui): FinalScore Global Index display · civilization contribution · NeoTopia T1 S16'

---

## TASK C · MOBILE LAYOUT FIX (target: 46/50)
# Council verdict: CRITICAL. 55px board at 375px. The civilization must be accessible.
# Lemurian value: accessible to all. CSS only. Zero React logic changes.
# This is the hardest task due to blast radius risk: MUST NOT break dim-the-rest.

### WHAT T3 FOUND:
  At 375px viewport width: the sidebar (width: 288px fixed) squeezes the board SVG to ~55px.
  Factories render at 5px (below 44px Rule 4 minimum). Game is unplayable.
  The mobile E2E guard (mobile.e2e.js) is CURRENTLY measuring this gap, not passing it.
  After T1 ships this fix, T3 will upgrade the guard to a hard-gate.

### THE FIX (CSS only):
  Read src/index.css FULL before writing.
  Read GameRoom.jsx main layout structure (Gate 3 answer a).

  FIND: the class name or selector for the main game layout container (board + sidebar flex row).
  FIND: the class name for the sidebar.
  ADD a media query at the end of src/index.css:

  @media (max-width: 600px) {
    /* Replace [LAYOUT_CLASS] with the actual class name from Gate 3 */
    .[LAYOUT_CLASS] {
      flex-direction: column !important;
      height: auto !important;
    }
    /* Replace [SIDEBAR_CLASS] with the actual sidebar class */
    .[SIDEBAR_CLASS] {
      width: 100% !important;
      max-width: 100% !important;
      max-height: 240px;
      overflow-y: auto;
    }
  }

  CRITICAL CHECKS:
    1. Does this break dim-the-rest? The dim-the-rest rules use data attributes
       ([data-my-turn='true'][data-ui-phase='...']). They are ORTHOGONAL to flex-direction.
       Verify: dim-the-rest selectors are data-attribute based, not class-based.
       If they are class-based: test in mobile viewport that dimming still works.
    2. Does this break the SVG board aspect ratio? (Rule 37)
       The board SVG is likely sized by its parent flex item. In column layout,
       it gets full width, which should INCREASE the board size (good).
       Verify by checking what constrains the SVG's width in GameRoom.
    3. Check action log position: ActionLog is absolute positioned, left:8px.
       In column layout it may overlay the board differently. Verify it's still readable.

### EVIDENCE GATE (Rule 55 — FOUR screenshots required):
  SCREENSHOT 1 (BEFORE, desktop 1280px): Full game visible. Baseline.
  SCREENSHOT 2 (AFTER, desktop 1280px): No regression. Layout identical to Screenshot 1.
  Resize browser to 375px wide.
  SCREENSHOT 3 (AFTER, 375px): Board is visible and wide. Sidebar stacked below.
  SCREENSHOT 4 (AFTER, 375px): Click a factory to verify touch target is >=44px.
  If ANY of the 4 screenshots shows a problem: DO NOT commit.
  If dim-the-rest opacity is wrong in mobile: diagnose, fix, re-screenshot before committing.

### COMMIT:
  git add src/index.css  (NO GameRoom.jsx if no React changes needed)
  git commit -m 'fix(ui): mobile layout 375px · sidebar column-stack · board full-width · NeoTopia T1 S16'

---

## TASK D · recordCivilizationDetail WIRE (CONDITIONAL — target: 47/50 if done)
# CONDITIONAL: ONLY execute if T3's sessionId exposure is in git log.
# Rule 61: verify the VALUE. Even if T3 shipped the exposure, console.log it first.
# Rule 62: the RPC is record_civilization_score (NOT record_civilization_contribution)

### PREREQUISITE CHECK (Gate 1 item):
  git log --oneline | grep -i 'sessionId\|session.id\|useGameSync'
  If found: proceed. If not found: skip this task, write 'T1 Task D SKIPPED pending T3 S16 Task A' in comms.

### IF PROCEEDING:
  Find recordCivilizationDetail in T2's code:
    grep -rn 'recordCivil' src/lib/
  VERIFY the exact call signature (Rule 62: reconcile, don't rebuild).
  In FinalScore.jsx, add ONE useEffect:
    useEffect(() => {
      if (!sessionId) {
        console.log('[NeoTopia] recordCivilizationDetail: sessionId is', sessionId, '(skipping if falsy)')
        return
      }
      console.log('[NeoTopia] recordCivilizationDetail: sessionId confirmed', sessionId)
      recordCivilizationDetail({ sessionId, /* ...other verified params */ })
    }, [sessionId])
  Rule 61: the console.log is not optional. It proves the wire is live.
  Do NOT remove the console.log in the commit. It's the evidence gate.

### COMMIT (if done):
  git add src/components/FinalScore.jsx
  git commit -m 'feat(ui): FinalScore recordCivilizationDetail wire · sessionId-gated · NeoTopia T1 S16'

---

## RULES
  NEVER git add -A · pathspec only (mobile.e2e.js + numerology.test.js are in working tree)
  NEVER touch: src/lib/ · src/store/ · tests/e2e/ · migrations/
  Rule 55: 4 screenshots for Task C (before/after desktop, before/after mobile)
  Rule 61: console.log sessionId before wiring
  Rule 62: reconcile RPC call, don't rebuild
  NEVER use \u2721 hexagram in any symbol
  Evolution lesson → comms disk only

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 · Task D /50 (if done)
  Session /300 · Forge /200 retroactive
