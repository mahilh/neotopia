# T1 S14 MASTER FORGE · FINAL SCORE + ART PIPELINE
# NeoTopia · June 27 2026 · post S13 · 7/7 E2E green · CI live · 28 esoteric card names live
# Forge self-rate /200 BEFORE touching any file. <85 = rewrite.
# T1 lane: src/components/ · src/pages/ · src/App.jsx · src/utils/

## S13 WHAT SHIPPED (do not redo)
  Sacred geometry placeholders: all 4 render, distinct, visible (zIndex fixed — Rule 55)
  Dual-player score: solo single-column, multiplayer side-by-side
  Instruction theming: element-color on pick, #1DC864 on scorePending
  FinalScore.jsx: NOT shipped in S13 — it is Task A this session
  PNG auto-load: already wired in CardFrame (artUrl = /art/cards/${card.id}.png) — not re-done

## KEY RULE FROM S13
  Rule 55: The render is the witness; the node-tree is not.
  A DOM assertion proves presence. Only a screenshot proves visibility.
  When the goal is visual, screenshot-verify, not just DOM-count-verify.
  The zIndex bug passed every DOM check and failed every real render.

## SESSION GOAL
  Task A: FinalScore.jsx civilization upgrade (the end-game moment must earn its place)
  Task B: PNG art pipeline — name every card correctly so art auto-loads (card ID mapping)
  Task C: Landing page (Lobby) civilization theming — first impression must feel like NeoTopia

---

## GATES

Gate 1 (3 min):
  git pull --rebase
  cat .claude/CLAUDE.md | head -60
  VERIFY: FinalScore was deferred from S13 (not in commits 06ac10e, c8c0395, 040f438)
  VERIFY: zIndex Rule 55 is in the rules list
  HARD STOP if you see a rule you are about to violate.

Gate 2 (2 min):
  cat .claude/comms/tomorrow.md 2>/dev/null | tail -60
  VERIFY: T2 is on bonus data + Global Index. T3 is on comms cleanup + bot race fix.
  HARD STOP if T3 has claimed src/pages/Lobby.jsx or src/App.jsx mid-session.

Gate 3 (7 min — READ EVERY LINE before touching anything):
  cat src/components/FinalScore.jsx
  cat src/pages/Lobby.jsx (or src/pages/LandingPage.jsx — find the landing file first)
  cat src/App.jsx | head -40  (understand routing)
  After reading FinalScore: answer these before coding:
    □ Does it show a clear winner?
    □ Does it show per-player per-region score breakdown?
    □ Does it show the final score formula?
    □ Does it have a Play Again button?
    □ Does it show civilization stage / NeoTopia branding?
  Whatever is MISSING from that list — that is what you build.

Gate 4: npx vitest run 2>&1 | tail -6 · 102 green required
Gate 5: npm run build 2>&1 | tail -4 · 0 errors required
Gate 6: git log --oneline -8 && git status --short
  VERIFY: HEAD = origin/main. Only T1 files in working tree.
Gate 7 (screenshot-verify — new per Rule 55):
  Start dev server (npm run dev), take a screenshot of /game in solo mode.
  Confirm sacred geometry renders visibly on offer cards.
  Confirm opponent score column is visible (or hidden gracefully in solo).
  Screenshot the confirmation — do not rely on DOM count.

---

## TASK A · FinalScore Civilization Upgrade
# Target: 49/50 · The end-game moment must be worthy of the civilization being built

WHAT TO BUILD (based on what Gate 3 reveals is missing):

MUST HAVE — implement all that are missing:
  1. WINNER announcement: "{PlayerName} built the stronger civilization"
     styled in gold (#C89440), large, centered, with a brief pause before showing scores
  2. PER-PLAYER REGION BREAKDOWN:
     Show all 3 players' regions: Sacred City / Living Earth / Free Energy
     Show both players side by side if 2-player game
     Highlight the winner's scores in white, loser's in rgba(255,255,255,0.5)
  3. FINAL SCORE FORMULA displayed below scores:
     "Best ({N}) + 2nd ({N}) + Worst ×3 ({N}×3={N}) + Cluster ({N}) + Unspent×3 ({N}) = {TOTAL}"
     The player should understand exactly how their score was calculated
  4. CIVILIZATION STAGE LINE:
     "Stage 2 of 5 · 2055 approaches" in small text at bottom
     This connects the game to the real vision
  5. PLAY AGAIN BUTTON:
     data-testid="play-again-btn" · height ≥44px · navigates to /
     Styled in the winner's element color (or gold if tie)
  6. CARDS BUILT count:
     "[Player1]: {N} cards built · [Player2]: {N} cards built"

DESIGN:
  Background: #0a0a0f (same as game room)
  Color palette: ambient colors from element types scored (energy=red, biofarming=green,
                 technology=purple, community=blue), not just flat white
  Do NOT add animations that break on slow connections
  Do NOT fetch new data (FinalScore already receives everything via props: players, mySeat, sync, roomId)

SCREENSHOT EVIDENCE GATE (Rule 55):
  Take a screenshot of the FinalScore screen (use Cmd+Shift+E in dev to trigger end-game)
  Confirm: winner name is large and gold
  Confirm: region breakdown is readable
  Confirm: Play Again button is visible and at least 44px tall
  DO NOT commit until the screenshot confirms visual correctness

COMMIT:
  git add src/components/FinalScore.jsx
  git commit -m 'feat(ui): FinalScore civilization upgrade · winner · breakdown · formula · Play Again · NeoTopia T1 S14'

---

## TASK B · PNG Art Pipeline — Card ID Mapping
# Target: 47/50 · CardFrame auto-loads art by card.id NOT by esoteric name

CRITICAL FIX: When Mahil generates pixel art and saves it, he must save it as card_NN.png
Because CardFrame.jsx loads: artUrl = `/art/cards/${card.id}.png`
NOT as 'ennead-source-temple.png' or 'orichalcum-arc-station.png' — those won't load!

MAP ESOTERIC NAMES TO CARD IDs:
  The image prompts in docs/ART_DIRECTION_PIXEL.md used esoteric names.
  Each must be saved as the corresponding card ID PNG.
  Read the current docs/ART_DIRECTION_PIXEL.md to see the full list.

UPDATE docs/ART_DIRECTION_PIXEL.md — add a FILENAME MAPPING section:

  ## FILENAME MAPPING (save art as card_NN.png NOT esoteric name)

  | Prompt Name              | Matches Card ID | Card Name                | Save As      |
  |---|---|---|---|
  | Ennead Source Temple     | card_50         | Source Temple (5pt)      | card_50.png  |
  | Orichalcum Arc Node      | card_05         | Orichalcum Arc Node (2pt)| card_05.png  |
  | Fohat Resonance Spire    | card_17         | Orichalcum Energy Spire  | card_17.png  |
  | Solar Fibonacci Array    | card_01         | Fibonacci Solar Terrace  | card_01.png  |
  | Naacal Seed Vault        | card_06         | Naacal Seed Archive (2pt)| card_06.png  |
  | Lemurian Resonance Garden| card_20         | Food Forest (3pt)        | card_20.png  |
  | Metatron's Cube Processor| card_33         | Holographic Research Ctr | card_33.png  |
  | Akashic Information Matrix| card_28        | Akashic Living Archive   | card_28.png  |
  | Ennead Council Chamber   | card_39         | Ennead Council Chamber   | card_39.png  |

  All files go in: ~/NeoTopia/public/art/cards/
  Example: ~/NeoTopia/public/art/cards/card_50.png

ALSO: Add a placeholder verification script in scripts/check-art.js:
  Lists which of the 56 cards have art and which are still using placeholders.
  Usage: node scripts/check-art.js

  import { PROJECT_CARDS } from '../src/lib/projectCards.js'
  import { existsSync } from 'fs'
  const withArt = PROJECT_CARDS.filter(c => existsSync(`public/art/cards/${c.id}.png`))
  const missing = PROJECT_CARDS.filter(c => !existsSync(`public/art/cards/${c.id}.png`))
  console.log(`Art: ${withArt.length}/56 cards have PNG art`)
  if (missing.length) {
    console.log('Missing:', missing.map(c => `${c.id} (${c.name})`).join(', '))
  }

COMMIT:
  git add docs/ART_DIRECTION_PIXEL.md scripts/check-art.js
  git commit -m 'docs(art): card ID filename mapping + check-art.js audit script · NeoTopia T1 S14'

---

## TASK C · Landing Page (Lobby) Civilization Theming
# Target: 46/50 · First impression: players must feel NeoTopia before they play

FIND THE LANDING PAGE FIRST:
  grep -r 'Create Room\|Join Room\|username\|enterRoom' src/pages/ --include='*.jsx' -l
  That file is the landing/lobby page. Read it fully before touching it.

WHAT TO ADD (if not already present):
  1. NeoTopia TAGLINE above the username input:
     "Build a consciousness civilization. 2055 approaches."
     Styled: rgba(255,255,255,0.4), fontSize 13, letterSpacing 2, textAlign center
     This is not marketing copy — it's a soul reminder.

  2. ELEMENT ICONS below the tagline (the 4 elements as a visual row):
     Energy (red ⚡) · BioFarming (green ◈) · Technology (purple ◎) · Community (blue ✶)
     Each with its name. Small. Decorative only. Shows players what they're building with.

  3. STAGE INDICATOR at the bottom of the page:
     "Stage 2 of 5 · The Awareness" (Stage 2 = the game/digital world)
     Styled: rgba(255,255,255,0.2), fontSize 11, letterSpacing 3

  4. The room-code input / display area should show the code in the NeoTopia element color palette
     (room code glows in a cycling element color — OR just in gold #C89440)

SCREENSHOT EVIDENCE GATE (Rule 55):
  Take a screenshot of the landing page before and after.
  Confirm: tagline is readable, element icons are visible, stage indicator is present.
  DO NOT commit until the screenshot confirms.

COMMIT:
  git add src/pages/[Lobby or LandingPage].jsx
  git commit -m 'feat(ui): landing page civilization theming · tagline · element icons · stage indicator · NeoTopia T1 S14'

---

## COMMIT RULES
  NEVER git add -A · pathspec only
  NEVER touch: scripts/ (except check-art.js) · migrations/ · tests/e2e/ · src/lib/ · src/store/ · src/hooks/useGameRoom*
  NEVER commit .claude/comms/
  Rule 55: screenshot-verify every visual task before committing

## SELF-RATE
  Task A /50 · Task B /50 · Task C /50 · Session /300 · Forge /200 retroactive
  Evolution lesson → .claude/comms/tomorrow.md (disk only)
