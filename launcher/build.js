#!/usr/bin/env node
'use strict';

/**
 * Smartway × Claude Code — Build Script
 *
 * Pasos:
 *  1. Lee smartway.config.json (API key + Supabase) desde la raíz del repo
 *  2. Codifica la config en base64 e inyecta en el source
 *  3. Compila con @yao-pkg/pkg para Windows, Linux y macOS
 *  4. Limpia el archivo temporal
 *
 * Uso (desde el directorio launcher/):
 *   npm install
 *   node build.js
 *
 * Los binarios quedan en ../dist/
 */

const fs           = require('fs');
const path         = require('path');
const { execSync } = require('child_process');

const ROOT        = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'smartway.config.json');
const SRC_FILE    = path.join(__dirname, 'src', 'index.js');
const TMP_FILE    = path.join(__dirname, 'src', 'index.build.js');
const DIST_DIR    = path.join(ROOT, 'dist');

// ── Validaciones ──────────────────────────────────────────────────────────────
if (!fs.existsSync(CONFIG_FILE)) {
  console.error('✗ No se encontró smartway.config.json en la raíz del repo.');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));

if (!config.anthropicApiKey || config.anthropicApiKey.includes('REEMPLAZAR')) {
  console.error('✗ Configurá la API key en smartway.config.json antes de compilar.');
  process.exit(1);
}

if (!config.supabase?.url || config.supabase.url.includes('REEMPLAZAR')) {
  console.warn('⚠ Supabase no configurado — los reportes estarán desactivados en el binario.');
}

if (!fs.existsSync(DIST_DIR)) fs.mkdirSync(DIST_DIR, { recursive: true });

// ── Inyectar config en el source ──────────────────────────────────────────────
const configBase64 = Buffer.from(JSON.stringify(config)).toString('base64');
const source       = fs.readFileSync(SRC_FILE, 'utf8');
const injected     = source.replace('__SMARTWAY_CONFIG_BASE64__', configBase64);

fs.writeFileSync(TMP_FILE, injected);
console.log('✓ Config inyectada en el source.');

// ── Compilar para cada plataforma ─────────────────────────────────────────────
const targets = [
  { target: 'node18-win-x64',      output: path.join(DIST_DIR, 'claude-smartway-windows.exe') },
  { target: 'node18-linux-x64',    output: path.join(DIST_DIR, 'claude-smartway-linux')       },
  { target: 'node18-macos-x64',    output: path.join(DIST_DIR, 'claude-smartway-macos')       },
  { target: 'node18-macos-arm64',  output: path.join(DIST_DIR, 'claude-smartway-macos-arm64') },
];

const pkg = path.join(__dirname, 'node_modules', '.bin', 'pkg');

for (const { target, output } of targets) {
  process.stdout.write(`  Compilando ${target}... `);
  try {
    execSync(
      `"${pkg}" "${TMP_FILE}" --target ${target} --output "${output}" --compress GZip`,
      { stdio: 'pipe' }
    );
    console.log(`✓  →  ${path.relative(ROOT, output)}`);
  } catch (err) {
    console.error(`✗\n${err.stderr?.toString() || err.message}`);
  }
}

// ── Limpiar archivo temporal ───────────────────────────────────────────────────
fs.unlinkSync(TMP_FILE);

console.log('\n✓ Build completado. Binarios en dist/\n');
console.log('  claude-smartway-windows.exe  →  Windows x64');
console.log('  claude-smartway-linux        →  Linux x64');
console.log('  claude-smartway-macos        →  macOS Intel');
console.log('  claude-smartway-macos-arm64  →  macOS Apple Silicon\n');
