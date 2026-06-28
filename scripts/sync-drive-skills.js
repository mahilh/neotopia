#!/usr/bin/env node
/**
 * NeoTopia Drive Skills Sync · Service Account · Never expires · Fully automated
 * Called by NIGHTSAVE! at end of every session
 * Usage:
 *   node scripts/sync-drive-skills.js --all          (sync all skills to Drive)
 *   node scripts/sync-drive-skills.js --skill xray   (sync one skill)
 *   node scripts/sync-drive-skills.js --read manifest (read one skill from Drive)
 *   node scripts/sync-drive-skills.js --test          (verify connection)
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const KEY_FILE = path.join(__dirname, '../.claude/service-account-key.json');
const SKILLS_DIR = path.join(__dirname, '../.claude/skills/library');

const FILE_IDS = {
  readme:      '1i6U4AU8F9NJLFjiiz23Hepx2WW4q8eNnIHtd1wqde0I',
  autodrive:   '1qlchet5zT4eNJLpQZ8My-nKNArOJ2vAQ9w6tF53c2Nw',
  omniscan:    '1d9x61KGxFRifg-YzjknV85h1DnwBB1pVrZFNfYBkC4c',
  xray:        '10HfvmEYyE9UmfZc6s_0kcg0WiXvFewBVJV5ER9_HBGI',
  nightsave:   '1CHGAxrRVYSHGl9V88QNMgv4l7_co9NLZPVC1jgP_oOE',
  llmcouncil:  '1ZrJhsm5FFQVGZlm5anzgAVZc_zH1cS7S1gCgbwAQxg4',
  manifest:    '1LvIAzmjQgzeagwBJ6DqTeyqadDNmzKz2TDsG7aCMCVE',
  context:     '18lv6K62-oIbCKA4-vQIeCp1vHgIhn2wl3gEXpqwNchM',
  sessionlog:  '1DO9jfa13qnR2qyC_nEbH0yEKZx6F5v2M7X4wh1KIqpU',
};

async function getDocsClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive',
    ],
  });
  const client = await auth.getClient();
  return { docs: google.docs({ version: 'v1', auth: client }), drive: google.drive({ version: 'v3', auth: client }) };
}

async function readDocContent(docId) {
  const { docs } = await getDocsClient();
  const doc = await docs.documents.get({ documentId: docId });
  const text = doc.data.body.content
    .map(el => el.paragraph?.elements?.map(e => e.textRun?.content || '').join('') || '')
    .join('');
  return text;
}

async function writeDocContent(docId, content) {
  const { docs } = await getDocsClient();
  const doc = await docs.documents.get({ documentId: docId });
  const bodyContent = doc.data.body.content;
  const lastEl = bodyContent[bodyContent.length - 1];
  const endIndex = (lastEl?.endIndex || 2) - 1;

  const requests = [];
  if (endIndex > 1) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex } } });
  }
  requests.push({ insertText: { location: { index: 1 }, text: content } });

  await docs.documents.batchUpdate({ documentId: docId, requestBody: { requests } });
  console.log(`  ✅ ${docId.slice(0, 20)}... updated`);
}

async function testConnection() {
  console.log('Testing service account connection...');
  try {
    const { drive } = await getDocsClient();
    const res = await drive.files.get({ fileId: FILE_IDS.manifest, fields: 'name,modifiedTime' });
    console.log(`✅ Connected · File: "${res.data.name}" · Modified: ${res.data.modifiedTime}`);
    console.log('🏛️  Drive sync ready for NeoTopia');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    if (err.message.includes('not been shared')) {
      console.log('\nFix: share each Drive doc with neotopia-claude-code@neotopia-drive.iam.gserviceaccount.com');
    }
    if (err.message.includes('Docs API')) {
      console.log('\nFix: enable Google Docs API at console.cloud.google.com');
    }
    process.exit(1);
  }
}

async function syncAllSkills() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.log(`Creating skills directory: ${SKILLS_DIR}`);
    fs.mkdirSync(SKILLS_DIR, { recursive: true });
    console.log('No skill files yet. Create .claude/skills/library/*.md files first.');
    return;
  }
  const files = fs.readdirSync(SKILLS_DIR).filter(f => f.endsWith('.md'));
  if (files.length === 0) {
    console.log('No .md files in skills/library yet.');
    return;
  }
  console.log(`Syncing ${files.length} skill files to Drive...`);
  for (const file of files) {
    const key = file.toLowerCase().replace('_skill.md','').replace('.md','').replace(/_/g,'');
    const fileId = FILE_IDS[key];
    if (!fileId) { console.log(`  ⚠️  No Drive ID for: ${file}`); continue; }
    const content = fs.readFileSync(path.join(SKILLS_DIR, file), 'utf8');
    process.stdout.write(`  Syncing ${file}...`);
    await writeDocContent(fileId, content);
  }
  console.log('\n🏛️  All skills synced to Drive successfully.');
}

async function main() {
  if (!fs.existsSync(KEY_FILE)) {
    console.error(`❌ Key file not found: ${KEY_FILE}`);
    console.log('Run: cp ~/Downloads/neotopia-drive-*.json .claude/service-account-key.json');
    process.exit(1);
  }
  const args = process.argv.slice(2);
  if (args[0] === '--test') await testConnection();
  else if (args[0] === '--all') await syncAllSkills();
  else if (args[0] === '--skill' && args[1]) {
    const key = args[1].toLowerCase().replace(/_/g,'');
    const fileId = FILE_IDS[key];
    if (!fileId) { console.error(`Unknown skill: ${key}\nAvailable: ${Object.keys(FILE_IDS).join(', ')}`); process.exit(1); }
    const f = path.join(SKILLS_DIR, `${args[1].toUpperCase()}_SKILL.md`);
    if (!fs.existsSync(f)) { console.error(`File not found: ${f}`); process.exit(1); }
    await writeDocContent(fileId, fs.readFileSync(f, 'utf8'));
  } else if (args[0] === '--read' && args[1]) {
    const key = args[1].toLowerCase().replace(/_/g,'');
    const fileId = FILE_IDS[key];
    if (!fileId) { console.error(`Unknown skill: ${key}`); process.exit(1); }
    const content = await readDocContent(fileId);
    console.log(content);
  } else {
    console.log('NeoTopia Drive Sync · Service Account · Never expires');
    console.log('Usage:');
    console.log('  --test          verify connection');
    console.log('  --all           sync all skill files to Drive');
    console.log('  --skill xray    sync one skill file');
    console.log('  --read manifest read one skill from Drive');
    console.log('Skills:', Object.keys(FILE_IDS).join(', '));
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
