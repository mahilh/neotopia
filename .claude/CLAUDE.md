# NEOTOPIA.IO — CLAUDE.md
# Browser multiplayer civilization strategy game
# Domain: neotopia.io | GitHub: mahilh/neotopia

PROJECT: NeoTopia.io
Stack: React 18 + Vite + Tailwind v4 + SVG board + Zustand + Supabase + Vercel
Supabase: wynccumuisjxbptjlfwq (ap-south-1 Mumbai)

TERMINAL LANES:
  T1: src/components/ src/pages/ src/App.jsx (board + visual layer)
  T2: src/lib/ src/hooks/ api/ scripts/ (engine + backend + realtime)

RULES — ABSOLUTE:
  NO em dashes — use · instead
  NO window.confirm() — hold-to-confirm only
  44px minimum touch targets on all controls
  tabular-nums on all game numbers
  Tailwind v4 CSS-first config
  PREMISE CHECK: git status --short [files] before any edit
  STOP if M from other terminal (lane collision)
  npm run build must pass before every commit

GAME MECHANICS (memorize — the rules engine depends on these):
  3 REGIONS: Sacred City · Living Earth · Free Energy (hexagonal clusters)
  3 FACTORIES: at junction between every 2 regions
  4 ELEMENTS: Sustainable Energy (red) · BioFarming (green) · Technology (purple) · Community (blue)
  TURN: player performs EXACTLY 3 actions
  ACTIONS: draw project card (from Offer or deck) OR move element (factory to adjacent region)
  PLACEMENT: hex must be empty AND (center if region empty, OR adjacent to existing element)
  BUILD: last element placed completes a card pattern → score that card immediately
  DIVERSE CITY: cannot build same card illustration type consecutively in same region
  FACTORY REFILL: auto-refills immediately when cleared, reveals next production tile
  END GAME: last production tile revealed → complete round → one more round → final scoring
  FINAL SCORE: best region + 2nd region + (worst × 3) + cluster scoring + (unused bonus × 3)
  CLUSTER: count connected same-color elements, biggest cluster = bonus points

NEOTOPIA CIVILIZATION THEME:
  Elements map to districts:
    Sustainable Energy (red) → Energy and Invention District
    BioFarming (green) → Food and Regeneration · Living Earth
    Technology (purple) → Technology and AI · AetherNet
    Community (blue) → Source and Spirituality · Culture

SKILLS: 380 available via symlink to AetherProject/.claude/skills/

SELF-RATING SYSTEM (mandatory every session):
  Rate Sonnet's forge /100 FIRST before executing
  Rate each TASK /50 before moving to next task
  If TASK < 35/50: redo before committing
  Rate SESSION /300 (Prompt /100 + Code /200)
  ONE evolution lesson mandatory per session
