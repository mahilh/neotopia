# NeoTopia Skills Library — README
# The persistent brain that survives every session reset
# Folder: https://drive.google.com/drive/folders/16VcjTyJA95ELauwukSEGXFt3FCgHu1R2

## SYSTEM ARCHITECTURE
Claude Desktop (me) → reads Drive via OAuth MCP → always current
Mac terminal / Claude Code → writes Drive via service account → never expires
Service account: neotopia-claude-code@neotopia-drive.iam.gserviceaccount.com
Key file: .claude/service-account-key.json (gitignored forever)
Sync command: node scripts/sync-drive-skills.cjs --all

## CODEWORDS → SKILL FILES
AUTODRIVE!     → AUTODRIVE_SKILL.md     → 195/200  session launch
OMNISCAN!      → OMNISCAN_SKILL.md      → 188/200  AI+MCP sweep
XRAY!          → XRAY_SKILL.md         → 190/200  brutal audit
DEEPDIVE!      → DEEPDIVE_SKILL.md     → 185/200  10-step analysis
NIGHTSAVE!     → NIGHTSAVE_SKILL.md    → 178/200  session close
LLM Council    → LLM_COUNCIL_SKILL.md  → 183/200  decision gate
Self-Improve   → SELFIMPROVE_SKILL.md  → /1000    flaw log

## HOW CLAUDE READS THIS
At any session start, I search Drive for SKILLS_MANIFEST to get all file IDs and ratings.
I read the SELFIMPROVE log to know what mistakes to avoid.
I read the SESSION_LOG to know what shipped last session.
Total boot time from Drive: under 10 seconds.

## FILE IDs (verified June 29 2026)
readme:       1i6U4AU8F9NJLFjiiz23Hepx2WW4q8eNnIHtd1wqde0I
autodrive:    1qlchet5zT4eNJLpQZ8My-nKNArOJ2vAQ9w6tF53c2Nw
omniscan:     1d9x61KGxFRifg-YzjknV85h1DnwBB1pVrZFNfYBkC4c
xray:         10HfvmEYyE9UmfZc6s_0kcg0WiXvFewBVJV5ER9_HBGI
nightsave:    1CHGAxrRVYSHGl9V88QNMgv4l7_co9NLZPVC1jgP_oOE
llmcouncil:   1ZrJhsm5FFQVGZlm5anzgAVZc_zH1cS7S1gCgbwAQxg4
manifest:     1LvIAzmjQgzeagwBJ6DqTeyqadDNmzKz2TDsG7aCMCVE
context:      18lv6K62-oIbCKA4-vQIeCp1vHgIhn2wl3gEXpqwNchM
sessionlog:   1DO9jfa13qnR2qyC_nEbH0yEKZx6F5v2M7X4wh1KIqpU
deepdive:     1fr8pPojdjhA-7CsmGk4SYG9SybT2Gf09z4FEhOmsl50
selfimprove:  1rIX1P_gx35UftbUe5gPqXisVAOxOs4RB56O3S5RU9Pg
card_art:     1mAMAeriwZSlrTJTFczFX56HCasvUQfyo
folder:       16VcjTyJA95ELauwukSEGXFt3FCgHu1R2

## ADDITIONAL FILES (added S21-S22)
T1 Reviews    → T1_REVIEWS_SKILL.md    → /1000 board·UI·CSS session log
T2 Reviews    → T2_REVIEWS_SKILL.md    → /1000 engine·DB·scripts session log
T3 Reviews    → T3_REVIEWS_SKILL.md    → /1000 hooks·E2E·realtime session log
Plato Books   → PLATO_BOOKS_SKILL.md   → 5 pillars · Atlantis · Avalon lineage

t1reviews:    1YUch0UR-YpPNQ48fTxRW7gRJoL9lSzyxZYGVuAaeYdk
t2reviews:    10FkUvJF0Bt0stSmuIMvpdEtiQ4Ccc9x74cskeRzs58c
t3reviews:    11R8fXkcqUitdmvwVEA8sGj2lUDJVjRgKgUcskWAhhw0
platobooks:   1Qb8VkBdRprU2loJdu4oA9dI2ZmxHxT-AHMJ5dCgU9sQ
