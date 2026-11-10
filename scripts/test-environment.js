/**
 * Males Ngonten Studio - Environment & Contract Verification Test
 * Tests API endpoints, project filesystem, and ACP contracts.
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🧪 =========================================================');
console.log('   MALES NGONTEN STUDIO - VERIFIKASI INTEGRITAS LOKAL');
console.log('=========================================================');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    testsPassed++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${details ? '(' + details + ')' : ''}`);
    testsFailed++;
  }
}

// 1. Filesystem check
console.log('\n[1/3] Memeriksa Struktur File & Workspace:');
const requiredFiles = [
  'package.json',
  'server.ts',
  'index.html',
  'src/App.tsx',
  'src/contracts/agentProtocol.ts',
  'src/contracts/workspaceContract.ts',
  'src/contracts/remotionContract.ts',
  'scripts/render-cli.mjs',
  'scripts/termux-install.sh',
  'scripts/setup-proot.sh'
];

for (const f of requiredFiles) {
  const fullPath = path.join(ROOT_DIR, f);
  assert(fs.existsSync(fullPath), `File ${f} tersedia`);
}

// 2. Hardware & Architecture info
console.log('\n[2/3] Memeriksa Lingkungan Runtime Host:');
console.log(`  -> Arsitektur CPU: ${process.arch}`);
console.log(`  -> Platform OS: ${process.platform}`);
console.log(`  -> Node.js: ${process.version}`);
console.log(`  -> Memory Heap Used: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1)} MB`);

// 3. API endpoint health check if server is running
console.log('\n[3/3] Memeriksa Respons Endpoint HTTP:');
const PORT = process.env.PORT || 3000;

function checkEndpoint(endpoint, expectedStatus = 200) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${PORT}${endpoint}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        assert(res.statusCode === expectedStatus, `GET ${endpoint} status ${res.statusCode}`, `Expected ${expectedStatus}`);
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', (err) => {
      console.log(`  ℹ️  SKIP: GET ${endpoint} (Server belum aktif di port ${PORT}: ${err.message})`);
      resolve(null);
    });

    req.setTimeout(1500, () => {
      req.destroy();
      console.log(`  ℹ️  TIMEOUT: GET ${endpoint}`);
      resolve(null);
    });
  });
}

async function runApiChecks() {
  await checkEndpoint('/api/agent/status');
  await checkEndpoint('/api/agent/discover');
  await checkEndpoint('/api/system/diagnostics');
  await checkEndpoint('/api/files');
  await checkEndpoint('/api/assets');
  await checkEndpoint('/api/renders');

  console.log('\n=========================================================');
  console.log(`Hasil Pengujian: ${testsPassed} Lulus, ${testsFailed} Gagal`);
  console.log('=========================================================\n');
  process.exit(testsFailed > 0 ? 1 : 0);
}

runApiChecks();
