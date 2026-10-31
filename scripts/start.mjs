// Production: build the React app, then serve it and the API from FastAPI on one port (default 8080).
import { spawn, spawnSync } from 'child_process';
import { BACKEND, FRONTEND, venvPython } from './_python.mjs';

const python = venvPython();
if (!python) {
  console.error('Backend virtualenv not found. Run "npm run setup" first.');
  process.exit(1);
}
const build = spawnSync('npm run build', { cwd: FRONTEND, stdio: 'inherit', shell: true });
if (build.status !== 0) process.exit(build.status || 1);

const port = process.env.PORT || '8080';
console.log(`\n  App running on http://0.0.0.0:${port}\n`);
const p = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', port], { cwd: BACKEND, stdio: 'inherit' });
p.on('exit', (code) => process.exit(code ?? 0));
