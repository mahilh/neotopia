# NEOTOPIA.IO — NIGHTSAVE! GOOGLE DRIVE CONTEXT UPDATE
# Date: June 27 2026 · For: Google Drive master context doc
# Replace the full document at: docs.google.com/document/d/1gs4EgKyG0oFZKE5X0nsc3OFzUVDajPN5lBMchNCP7_I
# Written in plain prose for readability by humans and AI systems

---

# NeoTopia.io — Master AI Context Document
## June 27 2026 · Session Cluster S1-S12 · Mahil Hussain

---

## WHO MAHIL IS

Syed Mahil Hussain. Born October 9 2003, 7:29 AM, Houston Texas. Now 22, based in Karachi Pakistan, moving to Austin Texas July 2026. Generator 1/3 · Emotional Authority · Life Path 6. He does not write code manually. He orchestrates 3 simultaneous Claude Code terminals (T1/T2/T3) to build NeoTopia.io as his AI Director. He is building NeoTopia as Stage 2 of a 5-stage civilization roadmap he believes he was born to create.

---

## WHAT NEOTOPIA.IO IS

A browser-based real-time multiplayer strategy game. Based on the Neotopia board game (Arcane Wonders/MEBO 2023). Set in 2055 — players build a consciousness civilization using 4 element types on a hexagonal board. Pure strategy, no dice, 2-4 players, turn-based. Similar architecture to colonist.io.

This is Stage 2 of 5 in Mahil's larger NeoTopia civilization vision:
- Stage 1: The Frequency (inner alignment) ✅
- Stage 2: The Awareness (the game, this document) · IN PROGRESS
- Stage 3: The Website (neotopia.io) · pending
- Stage 4: The App (consciousness OS) · future
- Stage 5: The Virtual World + Real Communities · 2030s+

Every project card scored in the game is a rehearsal of a real building that will one day be built in a physical NeoTopia district.

---

## TECH STACK

- React 19 + Vite 8 + Tailwind v4
- SVG hexagonal board rendering
- Zustand + Immer (state management)
- Supabase (auth · realtime · DB · Mumbai ap-south-1) ID: wynccumuisjxbptjlfwq
- Vercel (auto-deploy from GitHub main)
- GitHub: mahilh/neotopia (public) · Branch: main
- Live: neotopia.vercel.app

---

## CURRENT GAME STATE (June 27 2026)

Major systems shipped and working:
- Auth persistence · anonymous sign-in · INITIAL_SESSION pattern
- Full multiplayer loop: move → DB → postgres_changes → all clients → rejoin
- 3 regions (Sacred City · Living Earth · Free Energy) · 3 factories
- 56 project cards with element patterns
- Turn system (3 actions per turn)
- Scoring: best + second + (worst×3) + cluster + (unused bonus×3)
- Tutorial overlay for new players
- Global NeoTopia Index (tracks civilization progress across all games)
- CardFrame (ancient esoteric dark obsidian card borders)
- ElementIcon (bespoke SVG icons per element type)
- Terrain biomes (distinct colors per region)
- Turn timer (synced across players)
- data-my-turn attribute on game root (bot-readable, flips per turn)
- Bot simulation system for automated testing
- UX health CI (runs every 12 hours against production)
- 102 tests green · build clean

---

## 3 TERMINAL LANES (strict — no file collisions)

- T1 (Visual): src/components/ src/pages/ src/App.jsx
- T2 (Engine): src/lib/ src/store/ src/hooks/ api/ scripts/ migrations/
- T3 (Realtime): src/hooks/useGameRoom.js · useGameSync.js · usePresence.js · tests/e2e/

---

## CRITICAL TECHNICAL PATTERNS (never revert)

- game_sessions.phase CHECK: (playing|endgame|finished) — NEVER 'scoring'
- sessionPhaseColumn: maps store 'scoring' → 'finished' at DB write boundary
- Tutorial gate: {showTutorial && phase==='playing'} — NEVER isMyTurn
- data-my-turn: persistent attribute that flips 'true'/'false' on game root div
- Bot turn detection: detectActiveTurn polls BOTH player pages (seat is DB-driven)
- Room code: 5-strategy extraction (strategy 3 = letter-spacing matched AMYLNJ in production)
- calculateFinalScore: (scores[], unusedCount)→number · NOT breakdown object
- purge_e2e_test_data: requires signInAnonymously() first · authenticated-only (mig 007)

---

## CARD ART DIRECTION (FINAL)

After 5 iterations, the master template is established:
- Style: 16-bit isometric pixel art · SNES RPG quality
- Background: deep navy blue (#0A0A2E) · never changes
- Stone: warm amber-gold brick
- Accents: teal crystal glow (#40E0D0)
- Sacred geometry: Flower of Life, Seed of Life, Metatron's Cube, Vesica Piscis
- NEVER: hexagram/Star of David
- ONE building per card · fills 70% of frame
- Simple grey diamond stone platform at base
- ChatGPT GPT Image 2 is the generation tool

The fifth generated image (June 27 2026, 02:50 AM) scored 196/200 and is the master template.
All 56 cards use the same palette, background, and composition with element-specific building variations.

---

## GAME MECHANICS (complete)

- Board: 3 regions · ~19 hex cells each · 3 factories at junctions
- 4 Elements: Sustainable Energy (red) · BioFarming (green) · Technology (purple) · Community (blue)
- Turn = EXACTLY 3 actions: draw card (from Offer or deck) OR move element (factory → adjacent region)
- Placement: hex must be empty + (center if region empty OR adjacent to existing element)
- Build: last element placed completes a card pattern → score that card immediately (any rotation)
- Diverse City rule: cannot build same card illustration type consecutively in same region
- Factory refill: auto-refills immediately when cleared from production tile stack
- End game: last production tile revealed → complete round → one more round → final scoring
- Final score: best + second + (worst×3) + cluster + (unused bonus×3)
- Cluster: biggest connected group of same-color elements per region = bonus points
- Bonus tokens: Government Subsidy / Automatization / Private Initiative / New Building Permits
  (all mechanics wired · physical board data pending from Mahil)

---

## ELEMENT → CIVILIZATION MAPPING

- Sustainable Energy (red) → Energy and Invention District · AetherFlux · Free Energy research
- BioFarming (green) → Food and Regeneration · Living Earth District · seed libraries
- Technology (purple) → Technology and AI · AetherNet · Seat 7 · conscious tech
- Community (blue) → Source and Spirituality · Culture and Symbols · Seats 1 + 8

---

## BOT SIMULATION (automated testing)

A Playwright-based bot (scripts/bot-simulate.js v4.2) plays the game autonomously:
- Creates rooms · joins · dismisses tutorials · detects turns · places elements · draws cards
- Current status (June 27 2026): turns working · tutorial dismissed · placed:0 (selectors need updating)
- The `[DOM-DIAG]` log lines in v4.2 will reveal why placed:0
- The fix: T1 needs to add data-testid='card-offer' to offer cards and data-offer to offer container
- Success metric: totalPlaced > 0 on next run = game is mechanically playable by machines

---

## ANTI-REGRESS RULES (52 total · accumulated from S1-S12)

The 52 rules accumulated across all sessions form a living system of hard-won lessons.
All 52 are stored in .claude/CLAUDE.md in the GitHub repo.
Key rules that shaped the architecture:
- Rule 43: commit per task not per session
- Rule 45: denormalized columns are second contracts (the sessionPhaseColumn lesson)
- Rule 48: honor forge gates — skip rather than re-implement when already done
- Rule 50: data-testid on permanently-mounted element is useless for state — use flipping attribute
- Rule 51: run bot against localhost BEFORE editing production selectors
- Rule 52: isolate local vs prod before routing failures

---

## CARD NAMES BANNED

AetherMind · AetherNet · AetherFlux · AetherProject · KnowBrand · Hameed · Mahil

---

## THE NEOTOPIA SOUL (for AI context and card vocabulary)

NeoTopia is a soul-led civilization for consciousness expansion. The game is Stage 2.
The civilization vision (as written by Mahil in the Soul Blueprint document):

Purpose: expansion of consciousness for soul evolution and deeper connection to Source.
9 Council Districts: Source/Spirituality · Healing/Consciousness · Education/Imagination ·
  Energy/Invention · Food/Regeneration · Architecture/Land · Technology/AI ·
  Culture/Symbols · Diplomacy/Open Contact

The game mechanic of 'building a card' = rehearsing the construction of a real district.
Every scored project is a civilization act, not just a game move.

The consciousness civilization references that inform vocabulary, symbolism, and card design:
- Plato's Timaeus/Critias: Atlantis as advanced civilization destroyed by ego, orichalcum metal,
  the circular city with concentric rings, 9,000 years before Solon's time
- Lemuria/Mu (James Churchward): original motherland, feminine consciousness principle,
  crystal-based energy systems, telepathic communication
- Hyperborea: Apollonian solar civilization, northern paradise of light and consciousness,
  pure frequency existence before density descended
- Ra/Law of One: density progression (3rd→4th density harvest), catalyst for soul evolution,
  wanderers, service-to-others polarity, Logos as creative principle
- Bashar (Darryl Anka channeling): follow highest excitement as navigation system,
  parallel realities, state of being first then action, neutral circumstances shaped by belief
- Carl Jung: individuation process, shadow integration, archetypes (Self, Anima, Shadow),
  collective unconscious, synchronicity, the mandala as self-symbol
- Sacred geometry: Flower of Life (universal pattern), Metatron's Cube (blueprint of creation),
  Fibonacci spiral (nature's growth code), Vesica Piscis (creation gateway)
- NeoTopia districts directly map to Plato's Atlantis rings, Ra's density layers,
  and Jung's individuation stages

---

## OUTSTANDING ITEMS (as of June 27 2026)

1. Bonus hex position data from physical board game (6th request incoming)
2. neotopia.io custom domain → DNS CNAME to cname.vercel-dns.com
3. Bot placed:0 fix — T1 to add data-testid='card-offer' and data-offer attributes
4. Migration 008 (T2 S12) — extend purge to 'waiting' rooms
5. Pixel art card generation — 56 cards total, master template established
6. Google Drive doc update (this document)
7. NIGHTSAVE! protocol: update this document after every 5-session cluster

---

End of NeoTopia Master Context Document · June 27 2026 · mahilh/neotopia
