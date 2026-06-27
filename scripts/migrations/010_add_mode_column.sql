-- NeoTopia · migration 010 · game_sessions.mode ('classic' | 'flow') · T2 S15.
-- Authored by T2 S15 (2026-06-27). Applied to remote via Supabase MCP. Committed for the repo.
--
-- WHY: the FOUNDATION for NeoTopia Flow (real-time mode · src/store/gameConfig.js GAME_MODES). The chosen
-- mode is persisted on the session so a rejoining / spectating client knows which rules are live (15s vs 90s
-- turns, 9 vs 12 tiles, simultaneous vs sequential draws). DEFAULT 'classic' backfills every existing row, so
-- NOT NULL is safe. Deliberately NO CHECK constraint yet — the mode set is still expanding (Flow is the first
-- alternate) and a premature CHECK would block the next mode without a migration. Extensible by design.
-- Rollback: alter table public.game_sessions drop column mode.
alter table public.game_sessions add column if not exists mode text not null default 'classic';
