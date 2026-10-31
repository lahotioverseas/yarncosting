// Starts the FastAPI backend (auto-reload) and the Vite React dev server together.
// If the preferred ports are busy (another app already uses 8000 / 3000) the next free port is used.
import { spawn, spawnSync } from 'child_process';
import net from 'net';
import { BACKEND, FRONTEND, venvPython } from './_python.mjs';

const python = venvPython();
if (!python) {
  console.error('Backend virtualenv not found. Run "npm run setup" first.');
  process.exit(1);
}

function isFree(port, host) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, host);
  });
}

async function freePort(preferred) {
  for (let port = preferred; port < preferred + 50; port++) {
    // must be free on loopback and on all interfaces (Vite listens on 0.0.0.0)
    if ((await isFree(port, '127.0.0.1')) && (await isFree(port, '0.0.0.0'))) return port;
  }
  throw new Error(`No free port found near ${preferred}`);
}

const backendPort = await freePort(Number(process.env.BACKEND_PORT) || 8000);
const frontendPort = await freePort(Number(process.env.FRONTEND_PORT) || 3000);
const backendUrl = `http://127.0.0.1:${backendPort}`;

const procs = [
  spawn(python, ['-m', 'uvicorn', 'app.main:app', '--reload', '--host', '127.0.0.1', '--port', String(backendPort)], {
    cwd: BACKEND,
    stdio: 'inherit',
  }),
  spawn('npm run dev -- --strictPort', {
    cwd: FRONTEND,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, BACKEND_URL: backendUrl, FRONTEND_PORT: String(frontendPort) },
  }),
];

console.log(`\n  Open the app : http://localhost:${frontendPort}`);
console.log(`  API docs     : ${backendUrl}/api/docs\n`);

let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const p of procs) {
    if (p.exitCode !== null) continue;
    if (process.platform === 'win32') {
      // kill the whole tree (npm -> node vite), otherwise Vite keeps running in the background
      spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      p.kill('SIGTERM');
    }
  }
  process.exit(code);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
procs.forEach((p) => p.on('exit', (code) => stopAll(code ?? 0)));
