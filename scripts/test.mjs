// Runs every check: backend pytest suite, frontend type-check and production build.
import { spawnSync } from 'child_process';
import { BACKEND, FRONTEND, venvPython } from './_python.mjs';

const python = venvPython();
if (!python) {
  console.error('Backend virtualenv not found. Run "npm run setup" first.');
  process.exit(1);
}
const steps = [
  ['Backend tests (pytest)', python, ['-m', 'pytest'], BACKEND],
  ['Frontend type-check (tsc)', 'npm run lint', null, FRONTEND],
  ['Frontend build (vite)', 'npm run build', null, FRONTEND],
];
for (const [label, cmd, args, cwd] of steps) {
  console.log(`\n=== ${label} ===`);
  const r = args
    ? spawnSync(cmd, args, { cwd, stdio: 'inherit' })
    : spawnSync(cmd, { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`\nFAILED: ${label}`);
    process.exit(r.status || 1);
  }
}
console.log('\nAll checks passed.');
