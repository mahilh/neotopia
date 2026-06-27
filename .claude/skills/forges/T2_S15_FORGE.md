# T2 S15 MASTER FORGE · GLOBAL INDEX + BONUS DATA + NEOTOPIA FLOW
# NeoTopia · June 27 2026 · Overnight AUTODRIVE! pre-written
# Prerequisite: T2 S14 complete (Global Index migration · bonus data if available)

## S15 MISSION
  Task A: Global Index display in FinalScore (wire migration 009 to the UI)
  Task B: Numerological milestone events in the game engine
  Task C: NeoTopia Flow mode game config (faster 15s timer, 9 tiles, scoring rules)

## TASK A · Global Index in FinalScore (target: 48/50)
  After T2 S14 creates migration 009 and writes player scores at game-end:
  Display a small "Global Contribution" section in FinalScore:
    "This game contributed [N] points to Stage 2 of 5."
    "Civilization Index: [total across all games]"
  Query: SELECT SUM(total_score) FROM global_neotopia_index
  Display the running total alongside the individual game scores.
  Pair with the Light Rays animation from magicui (visual moment).

## TASK B · Numerological Milestone Events (target: 49/50)
  In src/store/gameStore.js, after score updates:
  Check if the new score crosses 7, 9, 13, 18, 27, 36.
  If yes: emit a custom event that T1 can listen to for visual celebration.

  const SACRED_MILESTONES = [7, 9, 13, 18, 27, 36]
  const MILESTONE_MESSAGES = {
    7: 'Sacred Seven · Spiritual Perfection Awakens',
    9: 'Nine · Completion · The Ennead Speaks',
    13: 'Thirteen · Sacred Feminine · Transformation',
    18: 'Eighteen · Life Doubled · The District Breathes',
    27: 'Twenty-Seven · Three Nines · Mastery',
    36: 'Thirty-Six · The Four Elements Complete · Stage 2 of 5 Honored',
  }

  When a player's score passes a milestone:
  useGameStore.setState({ sacredMilestone: { player, milestone, message } })
  GameRoom listens and shows the milestone notification (brief overlay, 2s).

## TASK C · NeoTopia Flow Config (target: 46/50)
  Create src/store/gameConfig.js (or update if exists):
  GAME_MODES = {
    classic: {
      TURN_TIME_LIMIT: 90,
      END_GAME_TILE: 12,  // last of 12 production tiles
      SIMULTANEOUS_DRAW: false,
    },
    flow: {
      TURN_TIME_LIMIT: 15,
      END_GAME_TILE: 9,   // last of 9 production tiles (for fast games)
      SIMULTANEOUS_DRAW: true,  // all players can draw between placements
      description: 'NeoTopia Flow · 15s turns · Pure creation',
    }
  }
  Add mode selection to lobby (radio button or toggle: Classic / Flow)
  The mode is passed to useGameSync and stored in game_sessions.

## RULES
  NEVER git add -A · NEVER commit comms
  Rule 56: verify schema live before coding any DB query
  102 green tests required before commit
  Evolution lesson → comms (disk only)
