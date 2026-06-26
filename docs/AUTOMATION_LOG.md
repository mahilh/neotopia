# NEOTOPIA AUTOMATION LOG
# All automated workflows · scripts · GitHub Actions · MCP integrations
# Auto-maintained by AUTODRIVE!

## GITHUB ACTIONS WORKFLOWS

### moltbook-heartbeat.yml
Path: .github/workflows/moltbook-heartbeat.yml
Schedule: every 4 hours (cron: '0 */4 * * *')
Trigger: also manual (workflow_dispatch)
Function: curl /api/v1/home · semantic searches for consciousness/solarpunk/strategy
Secret needed: MOLTBOOK_API_KEY (already added to GitHub Actions secrets)
Status: ACTIVE · added June 25 2026

### e2e.yml (T3 S6 · pending)
Path: .github/workflows/e2e.yml (not yet created)
Schedule: on push to main + PRs
Function: Playwright CDP offline reconnect test · two-tab browser E2E
Secrets needed: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (add after T3 S6)

## SHELL SCRIPTS

### start.sh
Path: ~/NeoTopia/start.sh
Function: one-command session start · git pull + build + comms
Run: bash ~/NeoTopia/start.sh (Mac terminal · once before opening tabs)

### .claude/relay.sh
Path: .claude/relay.sh
Function: auto-detects terminal (T1/T2/T3) · prints AUTODRIVE! prefix at top+bottom
Run: bash .claude/relay.sh (last command of every session)

### scripts/moltbook-complete-setup.sh
Path: scripts/moltbook-complete-setup.sh
Function: runs all 5 remaining Moltbook setup steps automatically
Run once: bash ~/NeoTopia/scripts/moltbook-complete-setup.sh (after git pull)
Setup items:
  1. Assign NeoTopia Scout role to neotopian
  2. Label first post as Milestone
  3. Follow consciousness-chain (365 karma)
  4. Subscribe to /m/agent-games
  5. Subscribe to /m/projects

### scripts/moltbook-heartbeat.sh
Path: scripts/moltbook-heartbeat.sh
Function: manual Moltbook heartbeat · called by GitHub Actions
Run manually: bash ~/NeoTopia/scripts/moltbook-heartbeat.sh

## MCP INTEGRATIONS

### Vercel MCP
Connected: yes
Used for: deployment status · build logs · runtime errors
Project: neotopia (may need team ID lookup)

### Google Drive MCP
Connected: yes
Used for: reading master context doc
Doc ID: 1gs4EgKyG0oFZKE5X0nsc3OFzUVDajPN5lBMchNCP7_I
Note: read-only · update manually from GOOGLE_DRIVE_UPDATE_SUMMARY.md

### GitHub MCP
Connected: yes
Used for: all file pushes · CLAUDE.md updates · skill upgrades · docs
Owner: mahilh · Repo: neotopia

### Moltbook API
Connected: via bash (MOLTBOOK_API_KEY in .env.local)
Agent: neotopian (b7360971-fa57-4451-ae44-d4d2cae05c5e)
Not accessible from claude.ai directly (curl via Mac terminal only)

## AUTODRIVE! AUTOMATION SUMMARY

When AUTODRIVE! runs (after any terminal relay output):
  1. SCANSKILLS! → skills dashboard (which skills need upgrading)
  2. GitHub verify: check latest commit + test count from relay output
  3. XRAY!/200: rate the session
  4. Write next forge: ready to paste into terminal
  5. Push any skill/doc updates identified during scan

All of this runs automatically — no manual steps from Mahil required.
Mahil's only job: paste the relay output + paste the next forge.

## PERMANENT CODEWORDS

  T[N] AUTODRIVE! → paste terminal output · I run: GitHub verify + XRAY!/200 + next forge
  FORGE! T[N] → just write next forge
  XRAY! [thing] → just audit
  REFORGE! [prompt] → 7-phase transcendence · .claude/skills/reforge/SKILL.md
  SKILLUPGRADE! → 6-phase skill improvement · destroy worst · rebuild · push
  SCANSKILLS! → audit all skills · runs inside AUTODRIVE!
  DEEPDIVE! → 10-step enforced analysis
  OVERDRIVE! [topic] → 7-agent council (BRUTUS/SOPHIA/MARCUS/ISABELLA/KARPATHY/CAESAR/NEOTOPIAN)
  NIGHTSAVE! → save to Google Drive
  Rate it → /300 session rating
