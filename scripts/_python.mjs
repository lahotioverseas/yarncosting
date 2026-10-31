// Locates the backend virtualenv's Python (Windows: .venv\Scripts\python.exe, others: .venv/bin/python)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BACKEND = path.join(ROOT, 'backend');
export const FRONTEND = path.join(ROOT, 'frontend');

export function venvPython() {
  const win = path.join(BACKEND, '.venv', 'Scripts', 'python.exe');
  const nix = path.join(BACKEND, '.venv', 'bin', 'python');
  if (fs.existsSync(win)) return win;
  if (fs.existsSync(nix)) return nix;
  return null;
}

export function systemPython() {
  return process.platform === 'win32' ? 'python' : 'python3';
}
