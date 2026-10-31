// Creates all MongoDB collections and pushes the application data (backend/scripts/setup_mongo.py).
import { spawnSync } from 'child_process';
import { BACKEND, venvPython } from './_python.mjs';

const python = venvPython();
if (!python) {
  console.error('Backend virtualenv not found. Run "npm run setup" first.');
  process.exit(1);
}
const r = spawnSync(python, ['scripts/setup_mongo.py'], { cwd: BACKEND, stdio: 'inherit' });
process.exit(r.status ?? 1);
