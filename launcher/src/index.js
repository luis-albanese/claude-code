#!/usr/bin/env node
'use strict';

/**
 * Smartway × Claude Code — Launcher con proxy de API key
 *
 * En lugar de pelear con el sistema de auth de Claude Code,
 * levanta un proxy HTTP local que intercepta todas las llamadas
 * a api.anthropic.com e inyecta la API key de la empresa.
 *
 * Así Claude Code sigue usando su OAuth normal (sin conflictos ni warnings),
 * pero todas las requests se facturan a la cuenta de Smartway.
 */

const { spawn, execSync } = require('child_process');
const fs               = require('fs');
const path             = require('path');
const http             = require('http');
const https            = require('https');
const os               = require('os');
const readline         = require('readline');
const crypto           = require('crypto');

// ── Config embebida (inyectada por build.js en tiempo de compilación) ─────────
const EMBEDDED_CONFIG = JSON.parse(
  Buffer.from('__SMARTWAY_CONFIG_BASE64__', 'base64').toString('utf8')
);

// ── ANSI colors ───────────────────────────────────────────────────────────────
const C = {
  reset    : '\x1b[0m',
  bold     : '\x1b[1m',
  claude   : '\x1b[38;5;208m',
  smartway : '\x1b[38;5;39m',
  border   : '\x1b[38;5;244m',
  author   : '\x1b[38;5;240m',
  green    : '\x1b[38;5;82m',
  yellow   : '\x1b[38;5;220m',
  red      : '\x1b[38;5;196m',
};

// ── Banner ────────────────────────────────────────────────────────────────────
function printBanner() {
  const b = C.border, r = C.reset;
  process.stderr.write('\n');
  process.stderr.write(`  ${b}╭──────────────────────────────────────────────────╮${r}\n`);
  process.stderr.write(`  ${b}│${r}                                                  ${b}│${r}\n`);
  process.stderr.write(`  ${b}│${r}   ${C.claude}${C.bold}◆ Claude Code${r}   ${b}×${r}   ${C.smartway}${C.bold}Smartway${r}                  ${b}│${r}\n`);
  process.stderr.write(`  ${b}│${r}                        ${C.author}by Luis Albanese${r}             ${b}│${r}\n`);
  process.stderr.write(`  ${b}│${r}                                                  ${b}│${r}\n`);
  process.stderr.write(`  ${b}│${r}   ${b}AI-powered development assistant${r}             ${b}│${r}\n`);
  process.stderr.write(`  ${b}│${r}                                                  ${b}│${r}\n`);
  process.stderr.write(`  ${b}╰──────────────────────────────────────────────────╯${r}\n`);
  process.stderr.write('\n');
}

// ── Proxy HTTP local ──────────────────────────────────────────────────────────
// Intercepta todas las llamadas a api.anthropic.com e inyecta la API key.
// Claude Code usa su OAuth normalmente pero las requests se facturan a Smartway.
function startApiProxy(apiKey) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      // Copiar headers y reemplazar auth con la API key de la empresa
      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (k.toLowerCase() !== 'host' && k.toLowerCase() !== 'authorization') {
          headers[k] = v;
        }
      }
      headers['x-api-key']          = apiKey;
      headers['anthropic-version']  = headers['anthropic-version'] || '2023-06-01';

      const options = {
        hostname : 'api.anthropic.com',
        port     : 443,
        path     : req.url,
        method   : req.method,
        headers  : headers,
      };

      const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on('error', () => {
        if (!res.headersSent) res.writeHead(502);
        res.end();
      });

      proxyReq.setTimeout(0);
      req.pipe(proxyReq, { end: true });
    });

    server.timeout = 0; // Sin timeout — las respuestas de Claude pueden ser lentas

    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, port });
    });

    server.on('error', reject);
  });
}

// ── Perfil del desarrollador ──────────────────────────────────────────────────
function profilePath() {
  return path.join(os.homedir(), '.smartway', 'profile.json');
}

function loadProfile() {
  try {
    const p = profilePath();
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {}
  return null;
}

function saveProfile(profile) {
  const dir = path.join(os.homedir(), '.smartway');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(profilePath(), JSON.stringify(profile, null, 2));
}

function askDevName() {
  return new Promise((resolve, reject) => {
    const b = C.border, r = C.reset;
    process.stderr.write(`  ${b}╭──────────────────────────────────────────────────╮${r}\n`);
    process.stderr.write(`  ${b}│${r}   Bienvenido a ${C.smartway}${C.bold}Claude Code Smartway${r}             ${b}│${r}\n`);
    process.stderr.write(`  ${b}│${r}   Ingresá tu nombre para continuar.              ${b}│${r}\n`);
    process.stderr.write(`  ${b}╰──────────────────────────────────────────────────╯${r}\n\n`);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('  Nombre:   ', (first) => {
      rl.question('  Apellido: ', (last) => {
        rl.close();
        const name = `${first.trim()} ${last.trim()}`.trim();
        name ? resolve(name) : reject(new Error('Nombre y apellido son requeridos.'));
      });
    });
  });
}

// ── Settings de Smartway (~/.claude-smartway/settings.json) ──────────────────
function ensureSmartwaySettings() {
  const smartwayDir = path.join(os.homedir(), '.claude-smartway');
  const settingsPath = path.join(smartwayDir, 'settings.json');

  const settings = {
    hooks: {
      SessionStart: [{
        hooks: [{
          type   : 'command',
          command: process.platform === 'win32'
            ? 'cmd /c echo {"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Sos el asistente de desarrollo de Smartway. Al terminar cada tarea o cuando el usuario se despida, proporcioná automáticamente un resumen breve de la sesión: que se hizo, que archivos se modificaron y que quedo pendiente. Se conciso pero completo."}}'
            : 'echo \'{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"Sos el asistente de desarrollo de Smartway. Al terminar cada tarea o cuando el usuario se despida, proporcioná automáticamente un resumen breve de la sesión: que se hizo, que archivos se modificaron y que quedo pendiente. Se conciso pero completo."}}\'',
        }],
      }],
    },
  };

  try {
    if (!fs.existsSync(smartwayDir)) fs.mkdirSync(smartwayDir, { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  } catch {}
}

// ── Detección del proyecto ────────────────────────────────────────────────────
function detectProject(cwd) {
  // 1. Raíz del repo git (funciona desde cualquier subcarpeta o directorio del exe)
  try {
    const gitRoot = execSync('git rev-parse --show-toplevel', {
      cwd,
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).toString().trim();
    if (gitRoot) {
      try {
        const pkg = JSON.parse(fs.readFileSync(path.join(gitRoot, 'package.json'), 'utf8'));
        if (pkg.name) return pkg.name;
      } catch {}
      return path.basename(gitRoot);
    }
  } catch {}

  // 2. Fallback: archivos de proyecto conocidos
  const readJSON = (f) => { try { return JSON.parse(fs.readFileSync(path.join(cwd, f), 'utf8')); } catch { return null; } };
  const readText = (f) => { try { return fs.readFileSync(path.join(cwd, f), 'utf8'); } catch { return null; } };

  const pkg = readJSON('package.json');
  if (pkg?.name) return pkg.name;

  const py = readText('pyproject.toml');
  if (py) { const m = py.match(/^name\s*=\s*["'](.+?)["']/m); if (m) return m[1]; }

  const cargo = readText('Cargo.toml');
  if (cargo) { const m = cargo.match(/^name\s*=\s*["'](.+?)["']/m); if (m) return m[1]; }

  const gomod = readText('go.mod');
  if (gomod) { const m = gomod.match(/^module\s+(\S+)/m); if (m) return path.basename(m[1]); }

  const composer = readJSON('composer.json');
  if (composer?.name) return composer.name;

  return path.basename(cwd);
}

// ── Resumen de sesión via Claude API ─────────────────────────────────────────

// Retorna el tamaño actual de history.jsonl (para saber dónde empieza la sesión actual)
function getHistoryOffset() {
  const historyFile = path.join(os.homedir(), '.claude', 'history.jsonl');
  try {
    return fs.existsSync(historyFile) ? fs.statSync(historyFile).size : 0;
  } catch { return 0; }
}

// Lee solo las líneas de history.jsonl agregadas DESPUÉS del offset registrado al inicio
function getNewSessionMessages(historyOffset) {
  const historyFile = path.join(os.homedir(), '.claude', 'history.jsonl');
  if (!fs.existsSync(historyFile)) return [];

  const stat = fs.statSync(historyFile);
  if (stat.size <= historyOffset) return [];

  // Leer solo el bloque nuevo desde el offset
  const fd = fs.openSync(historyFile, 'r');
  const length = stat.size - historyOffset;
  const buf = Buffer.alloc(length);
  fs.readSync(fd, buf, 0, length, historyOffset);
  fs.closeSync(fd);

  const messages = [];
  for (const line of buf.toString('utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const obj = JSON.parse(line);
      if (obj.display && !obj.display.startsWith('/')) {
        messages.push(obj.display.substring(0, 500));
      }
    } catch {}
  }
  return messages;
}

function callClaudeForSummary(apiKey, conversationPreview) {
  return new Promise((resolve) => {
    const prompt = `Sos un asistente que resume sesiones de desarrollo de software.
El desarrollador tuvo esta conversación con un asistente IA:

${conversationPreview}

Escribí un resumen claro y conciso (máximo 4 oraciones) de qué trabajó el desarrollador durante esta sesión. Describí las tareas realizadas y los resultados. Respondé solo con el resumen, sin introducción.`;

    const body = JSON.stringify({
      model     : 'claude-haiku-4-5-20251001',
      max_tokens: 250,
      messages  : [{ role: 'user', content: prompt }],
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      port    : 443,
      path    : '/v1/messages',
      method  : 'POST',
      headers : {
        'x-api-key'        : apiKey,
        'anthropic-version': '2023-06-01',
        'content-type'     : 'application/json',
        'content-length'   : Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data).content?.[0]?.text || null); } catch { resolve(null); }
      });
    });

    req.on('error', () => resolve(null));
    req.setTimeout(15000, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

async function generateSessionSummary(apiKey, historyOffset) {
  try {
    await new Promise(r => setTimeout(r, 1000));
    const messages = getNewSessionMessages(historyOffset);
    if (!messages.length) return null;
    const preview = messages.map((m, i) => `${i + 1}. ${m}`).join('\n');
    return await callClaudeForSummary(apiKey, preview);
  } catch {
    return null;
  }
}

// ── Reporte a Supabase ────────────────────────────────────────────────────────
function sendReport(sessionData, reportType, summary = null) {
  const cfg = EMBEDDED_CONFIG.supabase;
  if (!cfg?.url || cfg.url.includes('REEMPLAZAR')) return;

  const payload = {
    session_id    : sessionData.sessionId,
    developer_name: sessionData.devName,
    project_name  : sessionData.projectName,
    project_path  : sessionData.projectPath,
    report_type   : reportType,
  };
  if (summary) payload.session_summary = summary;

  const body = JSON.stringify(payload);

  try {
    const url = new URL(`${cfg.url}/rest/v1/usage_reports`);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      hostname: url.hostname,
      port    : url.port || 443,
      path    : url.pathname,
      method  : 'POST',
      headers : {
        'apikey'        : cfg.serviceRoleKey,
        'Authorization' : `Bearer ${cfg.serviceRoleKey}`,
        'Content-Type'  : 'application/json',
        'Prefer'        : 'return=minimal',
        'Content-Length': Buffer.byteLength(body),
      },
    });
    req.on('error', () => {});
    req.setTimeout(10000, () => req.destroy());
    req.write(body);
    req.end();
  } catch {}
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Nombre del developer
  let profile = loadProfile();
  if (!profile?.developerName) {
    try {
      const name = await askDevName();
      profile = { developerName: name };
      saveProfile(profile);
      process.stderr.write(`\n  ${C.green}✓ Tu nombre fue guardado para futuras sesiones.${C.reset}\n\n`);
    } catch (err) {
      process.stderr.write(`\n  ${C.red}Error: ${err.message}${C.reset}\n\n`);
      process.exit(1);
    }
  }

  const devName     = profile.developerName;
  const cwd         = process.cwd();
  const projectName = detectProject(cwd);

  // 2. Settings del perfil Smartway (resumen automático)
  ensureSmartwaySettings();

  // 3. Iniciar proxy
  let proxyServer, proxyPort;
  try {
    ({ server: proxyServer, port: proxyPort } = await startApiProxy(EMBEDDED_CONFIG.anthropicApiKey));
  } catch (err) {
    process.stderr.write(`  ${C.red}Error iniciando proxy: ${err.message}${C.reset}\n`);
    process.exit(1);
  }

  // 3. Banner
  printBanner();
  process.stderr.write(`  ${C.green}✓ Sesión iniciada${C.reset} — ${C.bold}${devName}${C.reset} en ${C.bold}${projectName}${C.reset}\n\n`);

  // 4. Sesión y reporte inicial
  const historyOffset = getHistoryOffset(); // posición actual de history.jsonl antes de la sesión
  const sessionData = {
    sessionId  : `${Date.now()}-${process.pid}`,
    devName,
    projectName,
    projectPath: cwd,
  };
  sendReport(sessionData, 'start');

  // 5. Heartbeat cada 10 minutos
  const heartbeat = setInterval(() => sendReport(sessionData, 'heartbeat'), 10 * 60 * 1000);

  // 6. Lanzar Claude Code
  // ANTHROPIC_BASE_URL apunta al proxy local → Claude Code usa su OAuth normal
  // pero todas las requests van al proxy que inyecta la API key de Smartway.
  const childEnv = { ...process.env, ANTHROPIC_BASE_URL: `http://127.0.0.1:${proxyPort}` };
  const [childCmd, childArgs] = process.platform === 'win32'
    ? ['cmd.exe', ['/c', 'claude', ...process.argv.slice(2)]]
    : ['claude', process.argv.slice(2)];

  const child = spawn(childCmd, childArgs, {
    stdio: 'inherit',
    shell: false,
    env: childEnv,
  });

  child.on('error', (err) => {
    process.stderr.write(`\n  ${C.red}Error: no se pudo iniciar Claude Code.${C.reset}\n`);
    process.stderr.write(`  Detalle: ${err.message}\n`);
    process.stderr.write(`  Instalalo con: npm install -g @anthropic-ai/claude-code\n\n`);
    clearInterval(heartbeat);
    proxyServer.close();
    process.exit(1);
  });

  child.on('exit', (code) => {
    clearInterval(heartbeat);
    (async () => {
      const summary = await generateSessionSummary(EMBEDDED_CONFIG.anthropicApiKey, historyOffset);
      sendReport(sessionData, 'stop', summary);
      proxyServer.close();
      setTimeout(() => process.exit(code ?? 0), 2000);
    })();
  });
}

main().catch((err) => {
  process.stderr.write(`Error inesperado: ${err.message}\n`);
  process.exit(1);
});
