# T1 S18 MASTER FORGE · LANDING COUNTER + CLUSTER POINTS VIZ + REGION BREAKDOWN + ART REVEAL
# NeoTopia · post S17 complete · June 27 2026
# Vercel confirmed: c0a8cb2 production · 0 runtime errors · 137 tests green
# Forge self-rate /200 BEFORE touching any file. <85 = REWRITE.
# T1 lane: src/components/ · src/pages/ · src/index.css

## S17 COMPLETE (T1 committed · 6 commits on origin):
  2086628: factory 44px (transparent SVG hit-circle r=70 · measured 23→44px at 375×667)
  5d759aa: Flow lobby toggle (amber-gold · GAME_MODES single-source · Rule 61 traced)
  52b6d65: cluster viz (getClusterDetail consumed · count-only · namespace-guard Rule 65)
  2a69be5: art shimmer (CardFrame · not ProjectCard · Rule 58 reroute · 0.555→0.893)
  2068f53: em-dash fix (Rule 2)
  c0a8cb2: review polish (ModeToggle keys from Object.keys(GAME_MODES) · Rule 62)
  Rule 66 (T1 S17): read half-built uncommitted cross-lane deps before stubbing

## WHAT T2+T3 SHIPPED (read before any task):
  b092dd6: getClusterDetail(regions) · element keys LOWERCASE · no bonus field (count only)
  a33b0c5+7537b30: bot v4.6 Flow mode support
  1929db2: Flow E2E (gray-box via __neotopia_store)
  8e75feb: factory 44px hard-gate in CI (crediting 2086628)
  90637ec: usePresence mode-aware (in_lobby/in_game/in_flow_game)

## CRITICAL FOR TASK B (cluster points):
  T2 S18 Task A will implement cluster→points (board game rule: 1pt per element in biggest cluster).
  T1 Task B gates on T2's commit being in git log.
  The current cluster viz shows count-only with no points — that is INTENTIONALLY correct for now.
  Once T2 ships, T1 updates the display to show count + bonus points.
  DO NOT invent the points yourself (Rule 32).

## RULES MOST AT RISK:
  Rule 66: check git status before any cross-lane dependency assumption
  Rule 64: re-check T2's cluster points at the MOMENT of Task B, not just at boot
  Rule 55: screenshot every visual task
  Rule 1: NEVER git add -A
  Rule 32: DO NOT add cluster bonus points — read from T2's getClusterDetail

## GATES (all 7 required)
Gate 1: git pull --rebase · cat .claude/CLAUDE.md | head -80
  Confirm: c0a8cb2 in log (T1 S17 done)
  Check: git log | grep -i 'cluster.*point\|clusterDetail.*bonus\|1pt\|cluster.*score'
  This tells you if T2 S18 Task A has shipped. If YES: Task B is unlocked.
Gate 2: cat .claude/comms/tomorrow.md 2>/dev/null | tail -80
  Note: T2's cluster points implementation details (field name, shape)
  Note: T3's live-DB E2E plan (affects Task D testing)
Gate 3 (read before Tasks A and C):
  cat src/pages/Landing.jsx FULL (find the hardcoded 147823 number)
  cat src/components/FinalScore.jsx FULL (find cluster section + region score rendering)
  Answer: a. What variable holds 147823? b. Where is getGlobalCivilizationTotal called?
          c. How are region scores currently shown in FinalScore?
Gate 4: npx vitest run 2>&1 | tail -8 · 137 green required
Gate 5: npm run build 2>&1 | tail -5 · 0 errors
Gate 6: git log --oneline -12 && git status --short
Gate 7: npm run dev & · Screenshot landing page (verify you can see the 147823 counter)

---

## TASK A · Landing Page: Wire Real Global Counter (target 48/50)
# The landing page shows 147,823 — HARDCODED. Real DB has the actual civilization count.
# getGlobalCivilizationTotal() already exists (T2 S15 · used in FinalScore).
# Wire the same query to the landing page counter.

### FIND IT FIRST (Gate 3 answer a):
  grep -n '147' src/pages/Landing.jsx
  Find the exact variable or literal '147823' or '147,823'

### REPLACE WITH:
  import { getGlobalCivilizationTotal } from '[exact path from FinalScore imports]'
  const [civilizationTotal, setCivilizationTotal] = useState(null)
  useEffect(() => {
    getGlobalCivilizationTotal().then(total => {
      if (total !== null && total > 0) setCivilizationTotal(total)
      // keep hardcoded as fallback if DB returns 0 (optimistic display)
    })
  }, [])

  In JSX: {(civilizationTotal ?? 147823).toLocaleString()}
  // Keep 147823 as the floor — it's a credible starting civilization count

### EVIDENCE GATE: screenshot landing page showing the counter area.

### COMMIT:
  git add src/pages/Landing.jsx
  git commit -m 'feat(ui): Landing Global Index wired to real DB · 147823 floor · NeoTopia T1 S18'

---

## TASK B · Cluster Visualization: Add Points (CONDITIONAL on T2 S18 Task A)
# BOARD GAME RULE: 1pt per element in biggest cluster per region.
# T2 S18 Task A implements this. T1 updates the display.
# GATE: git log | grep -i 'cluster.*point' — if T2's commit is not there, SKIP this task.

### IF T2 HAS SHIPPED CLUSTER POINTS:
  Read T2's comms for the exact getClusterDetail shape (field name for bonus points).
  Likely shape: [{element, count, bonus}] where bonus is the cluster point value.
  In FinalScore cluster section, add bonus point display:
    {clusters.map(c => (
      <div key={c.element} style={{ color: ELEMENT_COLORS[c.element] }}>
        {c.element}: {c.count} elements · +{c.bonus ?? 0} pts
      </div>
    ))}
  Rule 32: only show c.bonus if it exists — degrade gracefully if field absent.

### EVIDENCE GATE: screenshot FinalScore showing cluster section with point values.

### COMMIT:
  git add src/components/FinalScore.jsx
  git commit -m 'feat(ui): cluster viz shows bonus points · board game rule 1pt/element · NeoTopia T1 S18'

---

## TASK C · FinalScore Region Score Breakdown (target 47/50)
# Players see total score but not per-region breakdown.
# The board game scorepad shows: Region 1 score · Region 2 score · Region 3 score.
# Add this to FinalScore.

### WHAT TO BUILD:
  Below the main score total in FinalScore, add a region breakdown:
    Sacred City: N pts
    Living Earth: N pts
    Free Energy: N pts
    (worst region ×3 multiplied to: N×3 = N pts)
  Each region name in its corresponding color (or neutral).
  The worst region should be visually marked (slightly different style).

### FIND THE DATA (Gate 3 answer c):
  Read FinalScore.jsx to find how calculateFinalScore returns region scores.
  The function returns: { total, best, second, worst, ... }
  Does it also return which region is which? (regionScores[0,1,2] = which regions?)
  Read calculateFinalScore FULLY before coding.
  If region identifiers are not returned: check if scores[] is indexed by region.

### COMMIT:
  git add src/components/FinalScore.jsx
  git commit -m 'feat(ui): FinalScore region score breakdown · worst region marked · NeoTopia T1 S18'

---

## TASK D · Card Art Reveal Animation (target 45/50)
# When a card_NN.png file loads successfully, reveal it with a smooth transition.
# Currently: shimmer shows while art missing, then art just replaces it.
# Add: a fade-in from shimmer to real art when the PNG loads.

### WHAT TO BUILD:
  In CardFrame.jsx (the real art renderer — Rule 58 confirmed):
  Add an onLoad handler to the img element:
    const [artLoaded, setArtLoaded] = useState(false)
    <img
      src={artSrc}
      onLoad={() => setArtLoaded(true)}
      style={{ opacity: artLoaded ? 1 : 0, transition: 'opacity 0.4s ease' }}
    />
  The shimmer (behind the img) becomes invisible as img fades in.
  This creates a smooth reveal: shimmer → 0.4s crossfade → real art.
  Reduced-motion guard: if prefers-reduced-motion, skip the transition.

### COMMIT:
  git add src/components/CardFrame.jsx
  git commit -m 'feat(ui): card art reveal fade · 0.4s opacity crossfade from shimmer · NeoTopia T1 S18'

---

## RULES
  NEVER git add -A · pathspec only
  NEVER touch: src/lib/ · src/store/ · migrations/ · tests/e2e/
  Rule 32: cluster points come from T2's getClusterDetail · never invent them
  Rule 64: re-check T2's cluster points at the moment of Task B decision
  Rule 66: check git status and T2's comms before assuming cross-lane state
  Evolution lesson → comms disk only

## SELF-RATE
  Task A /50 · Task B /50 (conditional) · Task C /50 · Task D /50
  Session /300 · Forge /200 retroactive
