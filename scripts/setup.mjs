// One-time setup: Python venv + backend requirements, and frontend npm packages.
import { spawnSync } from 'child_process';
import { BACKEND, FRONTEND, venvPython, systemPython } from './_python.mjs';

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(' ')}   (in ${cwd})`);
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\nSetup step failed: ${cmd} ${args.join(' ')}`);
    process.exit(r.status || 1);
  }
}

function runNpm(script, cwd) {
  console.log(`
> npm ${script}   (in ${cwd})`);
  const r = spawnSync(`npm ${script}`, { cwd, stdio: 'inherit', shell: true });
  if (r.status !== 0) {
    console.error(`
Setup step failed: npm ${script}`);
    process.exit(r.status || 1);
  }
}

if (!venvPython()) run(systemPython(), ['-m', 'venv', '.venv'], BACKEND);
run(venvPython(), ['-m', 'pip', 'install', '-r', 'requirements.txt'], BACKEND);
runNpm('install', FRONTEND);
console.log('\nSetup complete. Start the app with:  npm run dev');
