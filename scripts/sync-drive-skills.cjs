#!/usr/bin/env node
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, '../.claude/service-account-key.json');
const SKILLS_DIR = path.join(__dirname, '../.claude/skills/library');

const FILE_IDS = {
  readme:        '1i6U4AU8F9NJLFjiiz23Hepx2WW4q8eNnIHtd1wqde0I',
  autodrive:     '1qlchet5zT4eNJLpQZ8My-nKNArOJ2vAQ9w6tF53c2Nw',
  omniscan:      '1d9x61KGxFRifg-YzjknV85h1DnwBB1pVrZFNfYBkC4c',
  xray:          '10HfvmEYyE9UmfZc6s_0kcg0WiXvFewBVJV5ER9_HBGI',
  nightsave:     '1CHGAxrRVYSHGl9V88QNMgv4l7_co9NLZPVC1jgP_oOE',
  llmcouncil:    '1ZrJhsm5FFQVGZlm5anzgAVZc_zH1cS7S1gCgbwAQxg4',
  manifest:      '1LvIAzmjQgzeagwBJ6DqTeyqadDNmzKz2TDsG7aCMCVE',
  context:       '18lv6K62-oIbCKA4-vQIeCp1vHgIhn2wl3gEXpqwNchM',
  sessionlog:    '1DO9jfa13qnR2qyC_nEbH0yEKZx6F5v2M7X4wh1KIqpU',
  deepdive:      '1fr8pPojdjhA-7CsmGk4SYG9SybT2Gf09z4FEhOmsl50',
  selfimprove:   '1rIX1P_gx35UftbUe5gPqXisVAOxOs4RB56O3S5RU9Pg',
  t1reviews:     '1YUch0UR-YpPNQ48fTxRW7gRJoL9lSzyxZYGVuAaeYdk',
  t2reviews:     '10FkUvJF0Bt0stSmuIMvpdEtiQ4Ccc9x74cskeRzs58c',
  t3reviews:     '11R8fXkcqUitdmvwVEA8sGj2lUDJVjRgKgUcskWAhhw0',
  platobooks: '1Qb8VkBdRprU2loJdu4oA9dI2ZmxHxT-AHMJ5dCgU9sQ',
};

const CARD_ART_FOLDER = '1mAMAeriwZSlrTJTFczFX56HCasvUQfyo';
const SKILLS_FOLDER   = '16VcjTyJA95ELauwukSEGXFt3FCgHu1R2';

async function getClients() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: ['https://www.googleapis.com/auth/documents', 'https://www.googleapis.com/auth/drive'],
  });
  const client = await auth.getClient();
  return { docs: google.docs({ version: 'v1', auth: client }), drive: google.drive({ version: 'v3', auth: client }) };
}

async function testConnection() {
  const { drive } = await getClients();
  const res = await drive.files.get({ fileId: FILE_IDS.manifest, fields: 'name,modifiedTime' });
  console.log(`✅ Connected · "${res.data.name}" · ${res.data.modifiedTime}`);
  console.log(`🏛️  ${Object.keys(FILE_IDS).length} files mapped · Drive sync operational`);
}

async function writeDocContent(docId, content, label) {
  const { docs } = await getClients();
  const doc = await docs.documents.get({ documentId: docId });
  const endIndex = (doc.data.body.content[doc.data.body.content.length - 1]?.endIndex || 2) - 1;
  const requests = [];
  if (endIndex > 1) requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex } } });
  requests.push({ insertText: { location: { index: 1 }, text: content } });
  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });
  console.log(`  ✅ ${label}`);
}

async function appendToDoc(docId, content) {
  const { docs } = await getClients();
  const doc = await docs.documents.get({ documentId: docId });
  const endIndex = (doc.data.body.content[doc.data.body.content.length - 1]?.endIndex || 2) - 1;
  await docs.documents.batchUpdate({
    documentId: docId,
    requestBody: { requests: [{ insertText: { location: { index: endIndex }, text: '\n' + content } }] },
  });
}

async function syncAllSkills() {
  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
  console.log(`Syncing ${files.length} skill files to Drive...`);
  let synced = 0; let skipped = 0;
  for (const file of files) {
    const key = file.toLowerCase().replace('_skill.md','').replace('.md','').replace(/_/g,'');
    const fileId = FILE_IDS[key];
    if (!fileId) { console.log(`  ⚠️  No Drive ID: ${file}`); skipped++; continue; }
    await writeDocContent(fileId, fs.readFileSync(path.join(SKILLS_DIR, file), 'utf8'), file);
    synced++;
  }
  console.log(`\n🏛️  Done · ${synced} synced · ${skipped} skipped`);
}

async function logFlaw(category, flaw, score) {
  const ts = new Date().toISOString();
  const entry = `\n────────────────────────────────────────────────────────────\n[${ts}] ${category} · SCORE: ${score}/1000\nFLAW: ${flaw}\nFIX: [add fix description]\nRULE BORN: [add rule]\n────────────────────────────────────────────────────────────`;
  await appendToDoc(FILE_IDS.selfimprove, entry);
  console.log(`  ✅ Flaw logged to CLAUDE_SELF_IMPROVE`);
}

async function logSession(session, shipped, score) {
  const ts = new Date().toISOString();
  const entry = `\n────────────────────────────────────────────────────────────\n[${ts}] ${session}\nShipped: ${shipped}\nScore: ${score}\n────────────────────────────────────────────────────────────`;
  await appendToDoc(FILE_IDS.sessionlog, entry);
  console.log(`  ✅ Session logged to SESSION_LOG`);
}

async function logTerminalReview(terminal, session, forge, tasks, codeQ, ruleQ, laneQ, outQ, effQ, gitQ, bruteCritique, pathTo1000) {
  const fileId = FILE_IDS[`${terminal.toLowerCase()}reviews`];
  if (!fileId) { console.error(`Unknown terminal: ${terminal}`); process.exit(1); }
  const total = [tasks, codeQ, ruleQ, laneQ, outQ, effQ, gitQ].map(Number).reduce((a, b) => a + b, 0);
  const ts = new Date().toISOString();
  const entry = `\n════════════════════════════════════════════════════════════\n${terminal.toUpperCase()} · ${session} · [${ts}]\n════════════════════════════════════════════════════════════\nForge rating: ${forge}/200\n\nTask Completion:    ${tasks}/150\nCode Quality:       ${codeQ}/150\nRule Compliance:    ${ruleQ}/150\nLane Discipline:    ${laneQ}/100\nOutput Quality:     ${outQ}/100\nSession Efficiency: ${effQ}/100\nDrive/Git Hygiene:  ${gitQ}/100\n────────────────────────────────────────────────────────────\nTOTAL: ${total}/950\n\nBRUTAL HONEST CRITIQUE:\n${bruteCritique}\n\nPATH TO 1000:\n${pathTo1000}\n════════════════════════════════════════════════════════════`;
  await appendToDoc(fileId, entry);
  console.log(`  ✅ ${terminal.toUpperCase()} review logged (${total}/950)`);
}

async function listCardArt() {
  const { drive } = await getClients();
  const res = await drive.files.list({
    q: `'${CARD_ART_FOLDER}' in parents and mimeType contains 'image/'`,
    fields: 'files(id,name,size)', orderBy: 'name', pageSize: 60,
  });
  const files = res.data.files;
  console.log(`Card Art: ${files.length}/56 images in Drive`);
  files.forEach(f => console.log(`  ${f.name} (${(parseInt(f.size||0)/1024/1024).toFixed(1)}MB)`));
  return files;
}

// ── --validate-manifest (T3 S22) ────────────────────────────────────────────────────────────────
// Born from SELFIMPROVE flaw #7 + Rule 71: "Sync ≠ current." The manifest is SYNCED to Drive every
// NIGHTSAVE, but the FACTS inside it (HEAD hash · test count) are last-WRITTEN snapshots that rot the
// moment a commit lands or a test is added. Two sessions in a row booted on a manifest whose HEAD/Tests
// line lied. This command makes the rot machine-detectable: it reads the live truth (git HEAD + a real
// `vitest run`) and compares it to what MANIFEST_SKILL.md claims · prints MATCH or DRIFT with exact
// values · exits 1 on drift so it is usable as a pre-NIGHTSAVE / CI gate. It NEVER edits the manifest
// (detector, not fixer · reconciliation is a deliberate human/NIGHTSAVE step). The HEAD it compares is
// the working-tree HEAD where the gate RUNS (Rule 67: gate what's true where the gate runs).
async function validateManifest() {
  const { execSync } = require('child_process');
  const repoRoot = path.join(__dirname, '..');
  const manifestPath = path.join(SKILLS_DIR, 'MANIFEST_SKILL.md');
  if (!fs.existsSync(manifestPath)) { console.error(`❌ MANIFEST not found: ${manifestPath}`); process.exit(1); }
  const manifest = fs.readFileSync(manifestPath, 'utf8');

  // ── Live truth ──────────────────────────────────────────────────────────────────────────────
  let liveHead = null;
  try { liveHead = execSync('git rev-parse --short HEAD', { cwd: repoRoot, encoding: 'utf8' }).trim(); }
  catch (e) { console.error(`❌ git rev-parse failed: ${e.message}`); process.exit(1); }

  console.log('🔍 MANIFEST VALIDATION · running vitest (live test count) ...');
  let liveTests = null, liveFailed = 0;
  try {
    const out = execSync('npx vitest run', { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 });
    const pm = out.match(/Tests\s+.*?(\d+)\s+passed/s); if (pm) liveTests = parseInt(pm[1], 10);
  } catch (e) {
    // vitest exits non-zero when a test fails · still parse the counts (a failing suite is itself drift).
    const out = (e.stdout || '') + (e.stderr || '');
    const pm = out.match(/(\d+)\s+passed/); if (pm) liveTests = parseInt(pm[1], 10);
    const fm = out.match(/(\d+)\s+failed/); if (fm) liveFailed = parseInt(fm[1], 10);
  }

  // ── Manifest claims ─────────────────────────────────────────────────────────────────────────
  const headM  = manifest.match(/HEAD:\s*([0-9a-f]{7,40})/i);
  const testsM = manifest.match(/Tests:\s*(\d+)/i);
  const manHead  = headM  ? headM[1]  : '(unparseable)';
  const manTests = testsM ? parseInt(testsM[1], 10) : null;

  // ── Compare ─────────────────────────────────────────────────────────────────────────────────
  const headOk  = liveHead != null && manHead === liveHead;
  const testsOk = liveTests != null && manTests != null && manTests === liveTests && liveFailed === 0;
  const fmt = (ok) => ok ? '✅ MATCH' : '❌ DRIFT';

  console.log('🔍 MANIFEST VALIDATION');
  console.log(`  HEAD   · live ${liveHead} · manifest ${manHead} · ${fmt(headOk)}`);
  console.log(`  Tests  · live ${liveTests == null ? '(unknown · vitest unparsed)' : liveTests}${liveFailed ? ` (${liveFailed} FAILED)` : ''} · manifest ${manTests == null ? '(unparseable)' : manTests} · ${fmt(testsOk)}`);
  console.log('────────────────────────────────────────────────────────────');
  if (headOk && testsOk) {
    console.log('✅ MANIFEST CURRENT · HEAD + test count match live source.');
    return;
  }
  console.error('❌ DRIFT DETECTED · MANIFEST_SKILL.md is stale · reconcile its HEAD/Tests line to live truth before NIGHTSAVE --all (else you sync rot · Rule 71).');
  process.exit(1);
}

async function main() {
  if (!fs.existsSync(KEY_FILE)) { console.error('❌ Key file missing'); process.exit(1); }
  const [cmd, ...rest] = process.argv.slice(2);
  if (cmd === '--test') await testConnection();
  else if (cmd === '--all') await syncAllSkills();
  else if (cmd === '--skill' && rest[0]) {
    const key = rest[0].toLowerCase().replace(/_/g,'');
    const fileId = FILE_IDS[key];
    if (!fileId) { console.error(`Unknown: ${rest[0]}\nAvailable: ${Object.keys(FILE_IDS).join(', ')}`); process.exit(1); }
    const f = path.join(SKILLS_DIR, `${rest[0].toUpperCase()}_SKILL.md`);
    if (!fs.existsSync(f)) { console.error(`Not found: ${f}`); process.exit(1); }
    await writeDocContent(fileId, fs.readFileSync(f,'utf8'), rest[0]);
  }
  else if (cmd === '--log-flaw') await logFlaw(rest[0]||'GENERAL', rest[1]||'unspecified', rest[2]||'500');
  else if (cmd === '--log-session') await logSession(rest[0]||'SESSION', rest[1]||'unspecified', rest[2]||'0');
  else if (cmd === '--log-terminal-review') await logTerminalReview(...rest);
  else if (cmd === '--list-card-art') await listCardArt();
  else if (cmd === '--validate-manifest') await validateManifest();
  else {
    console.log('NeoTopia Drive Sync · 15 files · Service Account · Never expires');
    console.log('--test · --all · --skill <name> · --log-flaw · --log-session · --log-terminal-review · --list-card-art · --validate-manifest');
    console.log('Files:', Object.keys(FILE_IDS).join(', '));
  }
}
main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
