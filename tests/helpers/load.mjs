/* ============================================================
   tests/helpers/load.mjs — carrega os scripts CLÁSSICOS do app
   (js/**, sem módulos ES, sem build) dentro de um sandbox do
   node:vm, para testar a lógica pura em Node.

   Fornece um `window`/`localStorage`/`crypto` falsos e NÃO define
   `indexedDB` — assim o Store.init() cai no adaptador de reserva
   (localStorage), que é justamente o difícil de exercitar à mão.
   ============================================================ */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');

/* localStorage em memória (a API usada pelo app) */
class MemoryStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
  clear() { this.map.clear(); }
  key(i) { return Array.from(this.map.keys())[i] ?? null; }
  get length() { return this.map.size; }
}

export function makeSandbox(overrides = {}) {
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.localStorage = new MemoryStorage();
  sandbox.console = console;
  sandbox.crypto = {
    randomUUID: function () {
      return 'id-' + Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
    }
  };
  Object.assign(sandbox, overrides);
  return sandbox;
}

export function loadScripts(sandbox, relPaths) {
  const context = vm.createContext(sandbox);
  for (const rel of relPaths) {
    const code = readFileSync(resolve(ROOT, rel), 'utf8');
    vm.runInContext(code, context, { filename: rel });
  }
  return sandbox;
}

/* atalhos usados pelos testes */
export function loadContent() {
  return loadScripts(makeSandbox(), ['js/core/content.js']);
}

export function loadPersistence() {
  return loadScripts(makeSandbox(), ['js/core/persistence.js']);
}

export async function loadStore() {
  const quiet = { log: function () {}, warn: function () {}, error: console.error };
  const sandbox = loadScripts(makeSandbox({ console: quiet }), [
    'js/core/persistence.js',
    'js/storage.js'
  ]);
  await sandbox.Store.init();
  return sandbox;
}
