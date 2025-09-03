/*
  Node-based deploy script for generic Linux hosts.
  - Loads .env
  - Installs Node deps (prod)
  - Ensures Python venv and scraper deps
  - Optional seed via SEED_ON_DEPLOY=true
  - Starts server via pm2 when available, otherwise background node process
*/

const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const projectDir = process.cwd();

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.error) throw result.error;
  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with code ${result.status}`);
  }
  return result;
}

function exists(cmd) {
  const which = spawnSync('bash', ['-lc', `command -v ${cmd}`], { stdio: 'ignore' });
  return which.status === 0;
}

async function main() {
  console.log(`[deploy.js] Project: ${projectDir}`);

  // Install Node dependencies (production only)
  if (!exists('npm')) throw new Error('npm not found');
  console.log('[deploy.js] Installing Node dependencies (production)');
  if (fs.existsSync(path.join(projectDir, 'package-lock.json'))) {
    run('npm', ['ci', '--omit=dev']);
  } else {
    run('npm', ['install', '--omit=dev']);
  }

  // Ensure Python venv and install scraper requirements
  if (exists('python3')) {
    console.log('[deploy.js] Ensuring Python venv and scraper requirements');
    const venvDir = path.join(projectDir, '.venv');
    if (!fs.existsSync(venvDir)) {
      run('python3', ['-m', 'venv', venvDir]);
    }
    const pipPath = path.join(venvDir, 'bin', 'pip');
    if (fs.existsSync(pipPath)) {
      run(pipPath, ['install', '-r', path.join(projectDir, 'requirements.txt')]);
    }
  } else {
    console.log('[deploy.js] WARNING: python3 not found; skipping scraper setup');
  }

  // Optional seed
  if (String(process.env.SEED_ON_DEPLOY || '').toLowerCase() === 'true') {
    console.log('[deploy.js] Seeding recent stories (one-time)');
    const scriptPath = path.join(projectDir, 'scripts', 'scrape.sh');
    if (fs.existsSync(scriptPath)) run('bash', [scriptPath]);
  }

  // Start server via pm2 when available
  console.log('[deploy.js] Starting server');
  const appName = 'redditxstory';
  if (exists('pm2')) {
    spawnSync('pm2', ['delete', appName], { stdio: 'ignore' });
    run('pm2', ['start', 'backend/server.js', '--name', appName, '--update-env']);
    spawnSync('pm2', ['save'], { stdio: 'ignore' });
    run('pm2', ['status', appName]);
  } else {
    // Background node process
    const out = fs.openSync(path.join(projectDir, 'server.out'), 'a');
    const err = fs.openSync(path.join(projectDir, 'server.out'), 'a');
    const child = spawn('node', ['backend/server.js'], { detached: true, stdio: ['ignore', out, err] });
    child.unref();
    fs.writeFileSync(path.join(projectDir, 'server.pid'), String(child.pid));
    console.log(`[deploy.js] Server PID ${child.pid}`);
  }

  console.log('[deploy.js] Done.');
}

main().catch((err) => {
  console.error('[deploy.js] ERROR:', err.message || err);
  process.exit(1);
});


