#!/usr/bin/env node
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, '../.claude/service-account-key.json');
const SKILLS_DIR = path.join(__dirname, '../.claude/skills/library');

const FILE_IDS = {
  readme:       '1i6U4AU8F9NJLFjiiz23Hepx2WW4q8eNnIHtd1wqde0I',
  autodrive:    '1qlchet5zT4eNJLpQZ8My-nKNArOJ2vAQ9w6tF53c2Nw',
  omniscan:     '1d9x61KGxFRifg-YzjknV85h1DnwBB1pVrZFNfYBkC4c',
  xray:         '10HfvmEYyE9UmfZc6s_0kcg0WiXvFewBVJV5ER9_HBGI',
  nightsave:    '1CHGAxrRVYSHGl9V88QNMgv4l7_co9NLZPVC1jgP_oOE',
  llmcouncil:   '1ZrJhsm5FFQVGZlm5anzgAVZc_zH1cS7S1gCgbwAQxg4',
  manifest:     '1LvIAzmjQgzeagwBJ6DqTeyqadDNmzKz2TDsG7aCMCVE',
  context:      '18lv6K62-oIbCKA4-vQIeCp1vHgIhn2wl3gEXpqwNchM',
  sessionlog:   '1DO9jfa13qnR2qyC_nEbH0yEKZx6F5v2M7X4wh1KIqpU',
  deepdive:     '1fr8pPojdjhA-7CsmGk4SYG9SybT2Gf09z4FEhOmsl50',
  selfimprove:  '1rIX1P_gx35UftbUe5gPqXisVAOxOs4RB56O3S5RU9Pg',
  t1reviews:    '1YUch0UR-YpPNQ48fTxRW7gRJoL9lSzyxZYGVuAaeYdk',
  t2reviews:    '10FkUvJF0Bt0stSmuIMvpdEtiQ4Ccc9x74cskeRzs58c',
  t3reviews:    '11R8fXkcqUitdmvwVEA8sGj2lUDJVjRgKgUcskWAhhw0',
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

async function logTerminalReview(terminal, session, forge, tasks, codeQuality, ruleCompliance, laneDiscipline, outputQuality, efficiency, gitHygiene, bruteCritique, pathTo1000) {
  const ts = new Date().toISOString();
  const t = terminal.toUpperCase();
  const fileId = FILE_IDS[`${t.toLowerCase()}reviews`];
  if (!fileId) { console.error(`Unknown terminal: ${terminal}`); process.exit(1); }

  const codeQ = parseInt(codeQuality) || 0;
  const taskQ = parseInt(tasks) || 0;
  const ruleQ = parseInt(ruleCompliance) || 0;
  const laneQ = parseInt(laneDiscipline) || 0;
  const outQ  = parseInt(outputQuality) || 0;
  const effQ  = parseInt(efficiency) || 0;
  const forgeQ = parseInt(forge) || 0;
  const gitQ  = parseInt(gitHygiene) || 0;
  const total = codeQ + taskQ + ruleQ + laneQ + outQ + effQ + forgeQ + gitQ;

  const entry = `
════════════════════════════════════════════════════════════
${t} · ${session} · [${ts}]
════════════════════════════════════════════════════════════
/1000 RATING — World's Harshest Critic · No mercy · No bias

Code Quality:        ${codeQ}/150
Task Completion:     ${taskQ}/150
Rule Compliance:     ${ruleQ}/150
Lane Discipline:     ${laneQ}/100
Output Quality:      ${outQ}/100
Session Efficiency:  ${effQ}/100
Forge Rating Align:  ${forgeQ}/100
Drive/Git Hygiene:   ${gitQ}/100
────────────────────────────────────────────────────────────
TOTAL:               ${total}/1000

BRUTAL HONEST CRITIQUE:
${bruteCritique}

PATH TO 1000:
${pathTo1000}
════════════════════════════════════════════════════════════`;

  await appendToDoc(fileId, entry);
  console.log(`  ✅ ${t} review logged to ${t}_REVIEWS (${total}/1000)`);
}

async function listCardArt() {
  const { drive } = await getClients();
  const res = await drive.files.list({
    q: `'${CARD_ART_FOLDER}' in parents and mimeType contains 'image/'`,
    fields: 'files(id,name,size)',
    orderBy: 'name',
    pageSize: 60,
  });
  const files = res.data.files;
  console.log(`Card Art Folder: ${files.length} images`);
  files.forEach(f => console.log(`  ${f.name} (${(f.size/1024/1024).toFixed(1)}MB)`));
  return files;
}

async function main() {
  if (!fs.existsSync(KEY_FILE)) { console.error('❌ Key file missing'); process.exit(1); }
  const args = process.argv.slice(2);
  const [cmd, ...rest] = args;

  if (cmd === '--test') await testConnection();
  else if (cmd === '--all') await syncAllSkills();
  else if (cmd === '--skill' && rest[0]) {
    const key = rest[0].toLowerCase().replace(/_/g,'');
    const fileId = FILE_IDS[key];
    if (!fileId) { console.error(`Unknown: ${rest[0]}`); process.exit(1); }
    const f = path.join(SKILLS_DIR, `${rest[0].toUpperCase()}_SKILL.md`);
    if (!fs.existsSync(f)) { console.error(`Not found: ${f}`); process.exit(1); }
    await writeDocContent(fileId, fs.readFileSync(f,'utf8'), rest[0]);
  }
  else if (cmd === '--log-flaw') await logFlaw(rest[0]||'GENERAL', rest[1]||'unspecified', rest[2]||'500');
  else if (cmd === '--log-session') await logSession(rest[0]||'SESSION', rest[1]||'unspecified', rest[2]||'0/300');
  else if (cmd === '--log-terminal-review') {
    await logTerminalReview(rest[0], rest[1], rest[2], rest[3], rest[4], rest[5], rest[6], rest[7], rest[8], rest[9], rest[10] || '[no critique provided]', rest[11] || '[no path provided]');
  }
  else if (cmd === '--list-card-art') await listCardArt();
  else {
    console.log('NeoTopia Drive Sync · 14 files · Service Account · Never expires');
    console.log('Commands:');
    console.log('  --test');
    console.log('  --all');
    console.log('  --skill <name>');
    console.log('  --log-flaw <category> <flaw> <score>');
    console.log('  --log-session <name> <shipped> <score>');
    console.log('  --log-terminal-review <T1|T2|T3> <session> <forge> <tasks> <codeQ> <ruleQ> <laneQ> <outQ> <effQ> <gitQ> <critique> <path>');
    console.log('  --list-card-art');
    console.log('Files:', Object.keys(FILE_IDS).join(', '));
  }
}
main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
