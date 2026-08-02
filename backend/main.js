const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const spawn = require('cross-spawn');
const util = require('util');
const execAsync = util.promisify(exec);
const shellQuote = require('shell-quote');

let mainWindow;
let server;
let httpServer;

// --- Configurações do Gate de Confirmação ---
const MAX_DIFF_LINES = 2000;
const MAX_DIFF_SIZE_BYTES = 200 * 1024; // 200KB
const DEFAULT_CONFIRM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

// --- Fila de confirmações pendentes ---
// Map<requestId, { resolve, reject, timeout, action, filePath }>
const pendingConfirmations = new Map();

// --- Regras de permissão salvas ("Permitir sempre") ---
const PERMISSION_RULES_DIR = path.join(app.getPath('userData'), 'permissions');
const PERMISSION_RULES_FILE = path.join(PERMISSION_RULES_DIR, 'rules.json');

async function ensurePermissionRulesDir() {
  try { await fs.access(PERMISSION_RULES_DIR); } catch { await fs.mkdir(PERMISSION_RULES_DIR, { recursive: true }); }
}

async function readPermissionRules() {
  try { const data = await fs.readFile(PERMISSION_RULES_FILE, 'utf-8'); return JSON.parse(data); } catch { return { rules: [] }; }
}

async function writePermissionRules(data) {
  await ensurePermissionRulesDir();
  await fs.writeFile(PERMISSION_RULES_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Verifica se existe regra de "permitir sempre" para a ação+escopo.
 * Retorna true se auto-aprovado.
 */
async function checkPermissionRule(projectId, action, filePath) {
  const { rules } = await readPermissionRules();
  const now = new Date().toISOString();
  for (const rule of rules) {
    if (rule.projectId !== projectId) continue;
    if (rule.action !== action) continue;
    // Escopo: path deve começar pelo scope da regra
    if (filePath && rule.scope && filePath.startsWith(rule.scope.replace(/\*$/, ''))) {
      return true;
    }
  }
  return false;
}

/**
 * Salva uma nova regra de "permitir sempre".
 */
async function savePermissionRule(projectId, action, scope) {
  const data = await readPermissionRules();
  // Evitar duplicatas
  const exists = data.rules.some(r => r.projectId === projectId && r.action === action && r.scope === scope);
  if (!exists) {
    data.rules.push({
      id: crypto.randomUUID(),
      projectId,
      action,
      scope,
      createdAt: new Date().toISOString()
    });
    await writePermissionRules(data);
  }
}

// --- Logging ---
const LOG_PATH = path.join(app.getPath('userData'), 'operations.log');

// --- Write lock per file path ---
// Serializes writes to the same file, preventing race conditions between
// writeFileContent (user Ctrl+S) and edit_file (agent).
const writeLocks = new Map();

async function withWriteLock(filePath, fn) {
  // Wait for any pending write to the same path
  const prev = writeLocks.get(filePath);
  if (prev) {
    await prev.catch(() => {}); // don't let prior errors propagate
  }
  // Execute this write, store its promise, clean up when done
  const promise = fn().finally(() => {
    if (writeLocks.get(filePath) === promise) {
      writeLocks.delete(filePath);
    }
  });
  writeLocks.set(filePath, promise);
  return promise;
}

async function logOperation(action, filePath, result = '', extra = '') {
  const timestamp = new Date().toISOString();
  const parts = [timestamp, action, result || 'AUTO', filePath];
  if (extra) parts.push(extra);
  const line = `[${parts.join(' | ')}]\n`;
  try {
    await fs.appendFile(LOG_PATH, line, 'utf-8');
  } catch {
    // Se o log falhar, não quebra a operação
  }
}

// --- Diff simples linha a linha (sem dependência externa) ---
function computeDiff(oldContent, newContent) {
  const oldLines = (oldContent || '').split('\n');
  const newLines = (newContent || '').split('\n');

  // Verifica limites para não travar o main process
  if (
    oldLines.length > MAX_DIFF_LINES ||
    newLines.length > MAX_DIFF_LINES ||
    Buffer.byteLength(oldContent || '', 'utf-8') > MAX_DIFF_SIZE_BYTES ||
    Buffer.byteLength(newContent || '', 'utf-8') > MAX_DIFF_SIZE_BYTES
  ) {
    return {
      truncated: true,
      oldLines: oldLines.length,
      newLines: newLines.length,
      message: `Arquivo grande (${oldLines.length} → ${newLines.length} linhas) — alteração não pode ser pré-visualizada em detalhe, revise o arquivo após aprovar.`
    };
  }

  // Algoritmo LCS simples para diff mínimo
  const m = oldLines.length;
  const n = newLines.length;

  // Matriz LCS
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Reconstrói o diff
  const diff = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: 'context', content: oldLines[i - 1], lineOld: i, lineNew: j });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'added', content: newLines[j - 1], lineNew: j });
      j--;
    } else {
      diff.unshift({ type: 'removed', content: oldLines[i - 1], lineOld: i });
      i--;
    }
  }

  // Limita o contexto: mostra no máximo 3 linhas antes/depois de cada mudança
  const changes = diff.map((d, idx) => ({ ...d, idx })).filter(d => d.type !== 'context');
  const showIndices = new Set();

  for (const change of changes) {
    for (let k = Math.max(0, change.idx - 3); k <= Math.min(diff.length - 1, change.idx + 3); k++) {
      showIndices.add(k);
    }
  }

  const filtered = [];
  let lastIdx = -1;
  for (const idx of showIndices) {
    if (lastIdx >= 0 && idx - lastIdx > 1) {
      filtered.push({ type: 'separator', content: '...' });
    }
    filtered.push(diff[idx]);
    lastIdx = idx;
  }

  return { truncated: false, lines: filtered };
}

// --- Solicita confirmação do usuário (gate de confirmação) ---
// Agora aceita projectId e checkRule para auto-aprovação
async function requestConfirmation({ action, filePath, content, oldContent, timeout = DEFAULT_CONFIRM_TIMEOUT_MS, projectId, checkRule = false, scope }) {
  // Se checkRule=true, verificar se já existe regra salva antes de mostrar modal
  if (checkRule && projectId) {
    const approved = await checkPermissionRule(projectId, action, filePath);
    if (approved) {
      logOperation(action, filePath, 'AUTO_APPROVED', `Regra salva: ${action} @ ${scope || filePath}`);
      return; // Auto-aprovado, sem modal
    }
  }

  return new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID();

    const timer = setTimeout(() => {
      pendingConfirmations.delete(requestId);
      logOperation(action, filePath, 'TIMEOUT');
      reject(new Error('Confirmação expirada (timeout)'));
    }, timeout);

    pendingConfirmations.set(requestId, { resolve, reject, timeout: timer, action, filePath });

    let preview;
    if (action === 'EDIT_FILE') {
      preview = { type: 'diff', diff: computeDiff(oldContent, content) };
    } else {
      preview = { type: 'content', content: (content || '').slice(0, 500) };
    }

    mainWindow?.webContents.send('confirm:request', {
      requestId,
      action,
      filePath,
      preview,
      timeout,
      projectId,
      scope: scope || filePath
    });
  });
}

// --- Resolução de caminhos ---
const KNOWN_FOLDERS = {
  downloads: () => app.getPath('downloads'),
  download: () => app.getPath('downloads'),
  documents: () => app.getPath('documents'),
  document: () => app.getPath('documents'),
  desktop: () => app.getPath('desktop'),
  home: () => app.getPath('home'),
  appdata: () => app.getPath('appData'),
  temp: () => app.getPath('temp'),
};

function resolveFolderPath(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Caminho não fornecido');
  }

  const trimmed = input.trim();
  const lower = trimmed.toLowerCase();

  if (KNOWN_FOLDERS[lower]) {
    return KNOWN_FOLDERS[lower]();
  }

  if (path.isAbsolute(trimmed)) {
    return path.normalize(trimmed);
  }

  const home = app.getPath('home');
  return path.join(home, trimmed);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#ffffff',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, 'icon.ico')
  });

  const isDev = process.argv.includes('--dev');

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  return new Promise((resolve) => {
    server = express();
    server.use(cors());
    server.use(express.json());

    server.post('/api/chat', async (req, res) => {
      const { message, history = [], userContext = {} } = req.body;

      try {
        let systemPrompt = 'Você é um assistente inteligente e prestativo. Responda em português brasileiro. Seja direto e útil.';
        
        if (userContext.name) {
          systemPrompt += ` O usuário se chama ${userContext.name}. Use esse nome nas respostas quando apropriado.`;
        }
        
        if (userContext.instructions) {
          systemPrompt += ` Instruções do usuário: ${userContext.instructions}`;
        }

        const messages = [
          { role: 'system', content: systemPrompt },
          ...history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          { role: 'user', content: message }
        ];

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'http://localhost:3001',
            'X-Title': 'AI Assistant'
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: messages,
            max_tokens: 2048,
            temperature: 0.7
          })
        });

        const data = await response.json();
        
        if (data.error) {
          return res.json({ response: `Erro: ${data.error.message}` });
        }

        const reply = data.choices?.[0]?.message?.content || 'Sem resposta';
        res.json({ response: reply });
      } catch (error) {
        console.error('Erro na API:', error);
        res.json({ response: 'Erro ao conectar com a IA. Verifique sua conexão.' });
      }
    });

    const PORT = 3001;
    httpServer = http.createServer(server);
    httpServer.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Porta ${PORT} em uso, tentando ${PORT + 1}...`);
        httpServer.listen(PORT + 1, () => {
          console.log(`API server: http://localhost:${PORT + 1}`);
          resolve();
        });
      }
    });
    
    httpServer.listen(PORT, () => {
      console.log(`API server: http://localhost:${PORT}`);
      resolve();
    });
  });
}

// IPC - Controles da janela
ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});
ipcMain.handle('window:close', () => mainWindow?.close());

// IPC - API de chat com OpenRouter
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_MODEL = 'inclusionai/ling-3.0-flash:free';

// IPC - Skills Management
const SKILLS_DIR = path.join(app.getPath('userData'), 'skills');

async function ensureSkillsDir() {
  try {
    await fs.access(SKILLS_DIR);
  } catch {
    await fs.mkdir(SKILLS_DIR, { recursive: true });
  }
}

async function loadAllSkills() {
  try {
    await ensureSkillsDir();
    const files = await fs.readdir(SKILLS_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    const skills = await Promise.all(
      mdFiles.map(async (file) => {
        const filePath = path.join(SKILLS_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        return content;
      })
    );
    
    return skills;
  } catch {
    return [];
  }
}

// --- DEFINIÇÃO DAS TOOLS (Function Calling) ---
const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'create_folder',
      description: 'Cria uma pasta (diretório) no sistema de arquivos. Use para estruturar o projeto.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho completo da pasta a criar' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'create_file',
      description: 'Cria um arquivo novo com conteúdo. Use para criar arquivos de código, configuração, etc.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho completo do arquivo' },
          content: { type: 'string', description: 'Conteúdo completo do arquivo' }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'edit_file',
      description: 'Edita um arquivo existente substituindo um trecho específico por outro. Use para modificar código.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho do arquivo' },
          old_text: { type: 'string', description: 'Texto antigo a ser substituído (deve existir no arquivo)' },
          new_text: { type: 'string', description: 'Novo texto que substituirá o antigo' }
        },
        required: ['path', 'old_text', 'new_text']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'read_file',
      description: 'Lê o conteúdo de um arquivo. Use quando precisar ver o conteúdo atual antes de editar.',
      parameters: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Caminho do arquivo a ler' }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'run_command',
      description: 'Executa um comando no terminal SEM shell (spawn shell:false). Use apenas para comandos de build, instalação ou utilitários do projeto.',
      parameters: {
        type: 'object',
        properties: {
          cmd: { type: 'string', description: 'Binário/base do comando (ex: "npm", "git", "node")' },
          args: { type: 'array', items: { type: 'string' }, description: 'Argumentos do comando (ex: ["install", "express"])' },
          cwd: { type: 'string', description: 'Diretório de trabalho (opcional, padrão: projeto ativo)' }
        },
        required: ['cmd', 'args']
      }
    }
  }
];

// --- Blocklist de arquivos sensíveis (nunca ler/escrever via tools) ---
const SENSITIVE_FILE_PATTERNS = [
  /^\.env$/i,
  /^\.env\./i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /^id_rsa/i,
  /^id_ed25519/i,
  /^id_dsa/i,
  /^id_ecdsa/i,
  /credentials\.json$/i,
  /service.*account.*\.json$/i,
  /\.npmrc$/i,
  /\.pypirc$/i,
  /htpasswd/i,
  /\.secret$/i,
  /\.secrets$/i,
];

/**
 * Verifica se um arquivo é sensível (blocklist).
 * Retorna true se o arquivo NÃO deve ser lido/escrito.
 */
function isSensitiveFile(filePath) {
  const fileName = path.basename(filePath);
  const relativePath = filePath.replace(/\\/g, '/');
  return SENSITIVE_FILE_PATTERNS.some(pattern =>
    pattern.test(fileName) || pattern.test(relativePath)
  );
}

// Comandos permitidos sem confirmação (whitelist — nomes base apenas)
const SAFE_COMMAND_BASES = new Set([
  'npm', 'yarn', 'pnpm', 'npx',
  'git', 'ls', 'dir', 'pwd', 'echo', 'cat', 'type',
  'node', 'python', 'python3'
]);

// Subcomandos/args seguros para cada base (quando aplicável)
const SAFE_SUBCOMMANDS = {
  npm: ['install', 'ci', 'run', 'start', 'test', 'list', 'outdated', 'init'],
  yarn: ['install', 'add', 'dev', 'list', 'outdated', 'init'],
  pnpm: ['install', 'add', 'list', 'outdated', 'init'],
  git: ['status', 'log', 'diff', 'branch', 'remote', 'show'],
};

/**
 * Valida se um comando é seguro para execução com spawn(shell:false).
 * Recebe o binário e array de argumentos já separados — NÃO passa por shell.
 *
 * Validação:
 * 1. O binário base deve estar em SAFE_COMMAND_BASES
 * 2. Se o binário tem subcomandos restritos, o primeiro arg deve estar na lista
 * 3. Nenhum argumento pode conter metacaracteres de shell (defesa em profundidade)
 */
function isCommandSafe(cmd, args) {
  if (!cmd || typeof cmd !== 'string') return false;
  if (!Array.isArray(args)) return false;

  const base = path.basename(cmd);

  // 1. Binário na whitelist?
  if (!SAFE_COMMAND_BASES.has(base)) return false;

  // 2. Subcomando restrito?
  const allowed = SAFE_SUBCOMMANDS[base];
  if (allowed && args.length > 0) {
    if (!allowed.includes(args[0])) return false;
  }

  // 3. Defesa em profundidade: nenhum arg pode conter metacaracteres de shell
  //    shell:false já neutraliza aspas e $, mas rejeitar metacaracteres como camada extra.
  //    NOTA: aspas (' ") NÃO estão bloqueadas — com shell:false são só texto literal.
  const SHELL_METACHAR = /[;&|`$(){}!<>#~\n\r\\*?[\]%^\u200b]/;
  for (const arg of args) {
    if (typeof arg !== 'string') return false;
    if (SHELL_METACHAR.test(arg)) return false;
  }

  return true;
}

// --- EXECUÇÃO DE TOOLS ---
async function executeToolCall(toolName, args, activeProject) {
  const projectPath = activeProject?.path || process.cwd();
  const projectId = activeProject?.id || 'default';
  
  switch (toolName) {
    case 'create_folder': {
      const resolved = path.resolve(projectPath, args.path);
      if (!isPathInsideProject(resolved, projectPath)) {
        // Fora do projeto: verificar regra ou pedir confirmação
        await requestConfirmation({
          action: 'CREATE_DIR',
          filePath: resolved,
          content: `Criar pasta: ${resolved}`,
          projectId,
          checkRule: true,
          scope: resolved
        });
      }
      await fs.mkdir(resolved, { recursive: true });
      return { success: true, path: resolved };
    }
    
    case 'create_file': {
      const resolved = path.resolve(projectPath, args.path);
      // Blocklist: recusar escrita em arquivos sensíveis
      if (isSensitiveFile(resolved)) {
        return { error: `Arquivo sensível bloqueado: ${path.basename(resolved)}. Não é permitido criar/escrever neste arquivo via tools.` };
      }
      if (!isPathInsideProject(resolved, projectPath)) {
        await requestConfirmation({
          action: 'CREATE_FILE',
          filePath: resolved,
          content: args.content,
          projectId,
          checkRule: true,
          scope: path.dirname(resolved) + path.sep
        });
      }
      await withWriteLock(resolved, async () => {
        const dir = path.dirname(resolved);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(resolved, args.content, 'utf-8');
      });
      triggerFileReindex(resolved);
      emit('file:changed', { path: resolved, type: 'created' });
      return { success: true, path: resolved };
    }
    
    case 'edit_file': {
      const resolved = path.resolve(projectPath, args.path);
      // Blocklist: recusar edição de arquivos sensíveis
      if (isSensitiveFile(resolved)) {
        return { error: `Arquivo sensível bloqueado: ${path.basename(resolved)}. Não é permitido editar este arquivo via tools.` };
      }
      if (!isPathInsideProject(resolved, projectPath)) {
        const oldContent = await fs.readFile(resolved, 'utf-8').catch(() => '');
        await requestConfirmation({
          action: 'EDIT_FILE',
          filePath: resolved,
          content: args.new_text,
          oldContent,
          projectId,
          checkRule: true,
          scope: resolved
        });
      }
      // Serializar leitura + diff + escrita no mesmo arquivo
      const result = await withWriteLock(resolved, async () => {
        const content = await fs.readFile(resolved, 'utf-8');
        if (!content.includes(args.old_text)) {
          return { error: 'Texto antigo não encontrado no arquivo' };
        }
        const newContent = content.split(args.old_text).join(args.new_text);
        await fs.writeFile(resolved, newContent, 'utf-8');
        return { success: true };
      });
      if (result.error) return result;
      triggerFileReindex(resolved);
      emit('file:changed', { path: resolved, type: 'edited' });
      return { success: true, path: resolved };
    }
    
    case 'read_file': {
      const resolved = path.resolve(projectPath, args.path);
      // Blocklist: recusar arquivos sensíveis mesmo dentro do projeto
      if (isSensitiveFile(resolved)) {
        return { error: `Arquivo sensível bloqueado: ${path.basename(resolved)}. Este arquivo contém dados que não podem ser expostos via tools.` };
      }
      if (!isPathInsideProject(resolved, projectPath)) {
        await requestConfirmation({
          action: 'READ_FILE',
          filePath: resolved,
          content: `Ler arquivo: ${resolved}`,
          projectId,
          checkRule: true,
          scope: resolved
        });
      }
      const content = await fs.readFile(resolved, 'utf-8');
      return { success: true, content };
    }
    
    case 'run_command': {
      const cmd = args.cmd;
      const cmdArgs = Array.isArray(args.args) ? args.args : [];
      const cwd = args.cwd ? path.resolve(projectPath, args.cwd) : projectPath;
      const outsideProject = !isPathInsideProject(cwd, projectPath);
      const isUnsafe = !isCommandSafe(cmd, cmdArgs);

      // Pedir confirmação se: fora do projeto OU comando inseguro
      if (outsideProject || isUnsafe) {
        await requestConfirmation({
          action: 'RUN_COMMAND',
          filePath: `${cmd} ${cmdArgs.join(' ')}`,
          content: `Comando: ${cmd} ${cmdArgs.join(' ')}\nDiretório: ${cwd}${outsideProject ? '\n⚠ Fora do projeto' : ''}${isUnsafe ? '\n⚠ Comando não está na whitelist' : ''}`,
          projectId,
          checkRule: true,
          scope: cwd
        });
      }

      // Executar com spawn(shell:false) — SEM interpretador de shell
      return new Promise((resolve) => {
        const proc = spawn(cmd, cmdArgs, {
          cwd,
          shell: false,
          timeout: 60000,
          stdio: ['pipe', 'pipe', 'pipe']
        });

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => { stdout += data.toString(); });
        proc.stderr.on('data', (data) => { stderr += data.toString(); });

        proc.on('close', (exitCode) => {
          resolve({
            success: exitCode === 0,
            stdout,
            stderr,
            exit_code: exitCode
          });
        });

        proc.on('error', (err) => {
          resolve({
            success: false,
            stdout: '',
            stderr: err.message,
            exit_code: 1
          });
        });
      });
    }
    
    default:
      return { error: `Tool desconhecida: ${toolName}` };
  }
}

// --- Resumo da tool para o Activity Trace ---
function summarizeToolCall(toolName, args) {
  switch (toolName) {
    case 'read_file':
      return args.path || 'arquivo';
    case 'create_file':
      return args.path || 'arquivo';
    case 'edit_file':
      return args.path || 'arquivo';
    case 'create_folder':
      return args.path || 'pasta';
    case 'run_command':
      return `${args.cmd || ''} ${(args.args || []).join(' ')}`.trim().slice(0, 60);
    default:
      return JSON.stringify(args).slice(0, 50);
  }
}

// --- AGENT LOOP: Processa tool_calls até o modelo parar ---
// Agora aceita webContents para emitir eventos de Activity Trace
async function callModelWithTools(messages, model, maxIterations = 10, webContents = null) {
  const MAX_TOKENS = 8192;
  let totalToolCalls = 0;
  
  // Função auxiliar para emitir eventos
  const emit = (channel, data) => {
    if (webContents && !webContents.isDestroyed()) {
      webContents.send(channel, data);
    }
  };
  
  // Fase inicial: "Explorando" (tools de leitura/busca)
  emit('agent:phase_change', { phase: 'exploring', totalActions: 0 });
  
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    console.log(`[Agent Loop] Iteração ${iteration + 1}/${maxIterations}`);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://localhost:3000',
        'X-Title': 'AI Assistant'
      },
      body: JSON.stringify({
        model,
        messages,
        tools: AGENT_TOOLS,
        max_tokens: MAX_TOKENS,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || 'Erro na API');
    }

    const assistantMessage = data.choices?.[0]?.message;
    
    if (!assistantMessage) {
      throw new Error('Resposta vazia do modelo');
    }

    // Adicionar resposta do assistant às mensagens
    messages.push(assistantMessage);

    // Se não tem tool_calls, retornar a resposta final
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      console.log(`[Agent Loop] Resposta final após ${iteration + 1} iterações`);
      emit('agent:phase_change', { phase: 'responding', totalActions: totalToolCalls });
      return assistantMessage.content || 'Processado.';
    }

    // Processar cada tool_call
    console.log(`[Agent Loop] ${assistantMessage.tool_calls.length} tool call(s) recebida(s)`);
    
    for (const toolCall of assistantMessage.tool_calls) {
      const functionName = toolCall.function.name;
      let args;
      
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch {
        args = {};
      }
      
      console.log(`[Agent Loop] Executando: ${functionName}`, args);
      
      // Emitir evento de início da tool
      totalToolCalls++;
      emit('agent:tool:start', {
        type: 'tool_start',
        tool: functionName,
        target: summarizeToolCall(functionName, args),
        iteration: iteration + 1,
        totalActions: totalToolCalls,
        timestamp: Date.now()
      });
      
      // Buscar projeto ativo
      const active = await readActiveProject();
      
      // Executar tool
      let result;
      let error = null;
      try {
        result = await executeToolCall(functionName, args, active);
      } catch (err) {
        error = err.message;
        result = { error: err.message };
      }
      
      // Emitir evento de erro se houver
      if (error || result.error) {
        emit('agent:tool:start', {
          type: 'tool_error',
          tool: functionName,
          target: summarizeToolCall(functionName, args),
          error: error || result.error,
          iteration: iteration + 1,
          totalActions: totalToolCalls,
          timestamp: Date.now()
        });
      }
      
      // Adicionar resultado às mensagens
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }
    
    // Emitir fase "thinking" entre iterações (mais tools podem vir)
    emit('agent:phase_change', { phase: 'thinking', totalActions: totalToolCalls });
  }

  // Se chegou no limite de iterações
  console.log('[Agent Loop] Limite de iterações atingido');
  emit('agent:phase_change', { phase: 'responding', totalActions: totalToolCalls });
  return 'Tarefa concluída (limite de iterações).';
}

// --- HANDLER PRINCIPAL: chat:send ---
ipcMain.handle('chat:send', async (event, message, history = [], userContext = {}, model = OPENROUTER_MODEL) => {
  try {
    let systemPrompt = `Você é um assistente inteligente e prestativo. Responda em português brasileiro.

## INSTRUÇÕES CRÍTICAS SOBRE TOOLS:
Você tem ferramentas para criar pastas, criar arquivos, editar arquivos e executar comandos.
SEMPRE que a tarefa envolver produzir código ou estrutura de projeto, USE as ferramentas para criar os arquivos de verdade — nunca escreva código apenas como texto na resposta, a menos que o usuário peça explicitamente para ver/revisar antes de aplicar.

Quando o usuário pedir para criar uma landing page, estrutura de projeto, ou qualquer coisa que envolva múltiplos arquivos:
1. Comece criando as pastas necessárias com create_folder
2. Crie cada arquivo com create_file
3. Se precisar rodar comandos (npm install, etc), use run_command
4. Continue chamando tools até completar toda a tarefa
5. Só responda com texto quando todas as tools necessárias já foram chamadas

Sempre crie os arquivos reais no disco, não apenas como exemplo ou template no texto.`;
    
    if (userContext.name) {
      systemPrompt += `\n\nO usuário se chama ${userContext.name}. Use esse nome nas respostas quando apropriado.`;
    }
    
    if (userContext.instructions) {
      systemPrompt += `\n\n## Instruções personalizadas do usuário:\n${userContext.instructions}`;
    }

    if (userContext.skillContent) {
      systemPrompt += `\n\n## Habilidade selecionada pelo usuário:\n\n${userContext.skillContent}\n\nUse esta habilidade para guiar sua resposta.`;
    }

    if (userContext.knowledgeContext) {
      systemPrompt += `\n\n## Contexto do grafo de conhecimento (memória de longo prazo):\n\n${userContext.knowledgeContext}`;
    }

    // Repo Map: estrutura do projeto vinculado
    if (userContext.repoMap) {
      systemPrompt += `\n\n## Estrutura do projeto vinculado (repo map):\n\nO usuário está trabalhando no projeto localizado em: ${userContext.projectPath || 'caminho não informado'}\n\nEstrutura dos arquivos:\n${userContext.repoMap}\n\nUse esta estrutura para entender o projeto. Ao criar arquivos, respeite a estrutura existente.`;
    }

    const skills = await loadAllSkills();
    if (skills.length > 0) {
      systemPrompt += '\n\n## Habilidades disponíveis:\n\n';
      skills.forEach((skillContent, i) => {
        systemPrompt += `### Habilidade ${i + 1}\n${skillContent}\n\n`;
      });
    }

    // Montar mensagens iniciais
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: message }
    ];

    // DEBUG
    console.log('\n=== DEBUG CHAT:SEND ===');
    console.log(`[PROMPT] Tamanho total: ${systemPrompt.length} caracteres`);
    console.log(`[CONTEXT] repoMap: ${userContext.repoMap ? 'PRESENTE' : 'AUSENTE'}`);
    console.log(`[CONTEXT] projectPath: ${userContext.projectPath || 'NÃO INFORMADO'}`);
    console.log(`[TOOLS] ${AGENT_TOOLS.length} tools definidas`);
    console.log('========================\n');

    // Executar agent loop com tools (passando webContents para eventos de Activity Trace)
    const finalResponse = await callModelWithTools(messages, model, 10, event.sender);
    
    return { success: true, data: { response: finalResponse } };
  } catch (error) {
    // Emitir fase "responding" mesmo em erro para o frontend sair do estado de loading
    if (event.sender && !event.sender.isDestroyed()) {
      event.sender.send('agent:phase_change', { phase: 'responding', totalActions: 0 });
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('skills:list', async () => {
  await ensureSkillsDir();
  try {
    const files = await fs.readdir(SKILLS_DIR);
    const mdFiles = files.filter(f => f.endsWith('.md'));
    
    const skills = await Promise.all(
      mdFiles.map(async (file) => {
        const filePath = path.join(SKILLS_DIR, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);
        
        const name = file.replace('.md', '');
        const firstLine = content.split('\n').find(l => l.trim()) || '';
        const description = firstLine.replace(/^#+\s*/, '').trim();
        
        return {
          name,
          file,
          description: description || 'Sem descrição',
          updated: stats.mtime.toLocaleDateString('pt-BR'),
          author: 'Você'
        };
      })
    );
    
    return { success: true, data: skills };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('skills:read', async (event, fileName) => {
  await ensureSkillsDir();
  try {
    const filePath = resolveSafePath(SKILLS_DIR, fileName);
    if (!filePath) {
      return { success: false, error: 'Caminho inválido: tentativa de acesso fora do diretório de skills' };
    }
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, data: content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('skills:save', async (event, fileName, content) => {
  await ensureSkillsDir();
  try {
    const filePath = resolveSafePath(SKILLS_DIR, fileName);
    if (!filePath) {
      return { success: false, error: 'Caminho inválido: tentativa de escrita fora do diretório de skills' };
    }
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('skills:delete', async (event, fileName) => {
  await ensureSkillsDir();
  try {
    const filePath = resolveSafePath(SKILLS_DIR, fileName);
    if (!filePath) {
      return { success: false, error: 'Caminho inválido: tentativa de deleção fora do diretório de skills' };
    }
    await fs.unlink(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('skills:import', async () => {
  await ensureSkillsDir();
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    });
    
    if (result.canceled) return { success: false, canceled: true };
    
    const imported = [];
    for (const filePath of result.filePaths) {
      const content = await fs.readFile(filePath, 'utf-8');
      const fileName = path.basename(filePath);
      const destPath = resolveSafePath(SKILLS_DIR, fileName);
      if (!destPath) continue;
      await fs.writeFile(destPath, content, 'utf-8');
      imported.push(fileName);
    }
    
    return { success: true, data: imported };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC - System Control — SEMPRE pede confirmação antes de executar
// Usa spawn(shell:false): a string é parseada com shell-quote mas executada SEM shell.
ipcMain.handle('system:execute', async (event, command, cwd) => {
  try {
    const active = await readActiveProject();
    const execCwd = cwd || app.getPath('home');

    // Gate de confirmação obrigatório — sem exceção
    await requestConfirmation({
      action: 'RUN_COMMAND',
      filePath: command,
      content: `Comando: ${command}\nDiretório: ${execCwd}`,
      projectId: active?.id,
      checkRule: true,
      scope: execCwd
    });

    // Parsear string em cmd + args (shell-quote é seguro aqui — só parseia, não executa)
    let tokens;
    try {
      tokens = shellQuote.parse(command);
    } catch {
      return { success: false, error: 'Falha ao parsear comando' };
    }
    const filtered = tokens.filter(t => typeof t === 'string');
    if (filtered.length === 0) {
      return { success: false, error: 'Comando vazio' };
    }
    const cmd = filtered[0];
    const cmdArgs = filtered.slice(1);

    // Executar com spawn(shell:false) — SEM interpretador de shell
    const result = await new Promise((resolve) => {
      const proc = spawn(cmd, cmdArgs, {
        cwd: execCwd,
        shell: false,
        timeout: 30000,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (exitCode) => {
        resolve({ success: exitCode === 0, data: { stdout, stderr } });
      });

      proc.on('error', (err) => {
        resolve({ success: false, error: err.message, data: { stdout: '', stderr: err.message } });
      });
    });

    return result;
  } catch (error) {
    return { success: false, error: error.message, data: { stdout: error.stdout, stderr: error.stderr } };
  }
});

// --- 1. LOCALIZAR PASTA (sem gate — só leitura) ---
ipcMain.handle('system:locateFolder', async (event, folderName) => {
  try {
    const resolved = resolveFolderPath(folderName);
    await logOperation('LOCATE_FOLDER', folderName, 'AUTO', `→ ${resolved}`);
    return { success: true, data: resolved };
  } catch (error) {
    await logOperation('LOCATE_FOLDER', folderName, 'FAILED', error.message);
    return { success: false, error: error.message };
  }
});

// --- 2. CRIAR PASTA (com gate de confirmação) ---
ipcMain.handle('system:createDir', async (event, dirPath) => {
  try {
    const resolved = path.resolve(dirPath);

    // GATE DE CONFIRMAÇÃO — pausa até usuário aprovar
    await requestConfirmation({
      action: 'CREATE_DIR',
      filePath: resolved,
    });

    // Só executa SE a confirmação foi aprovada
    await fs.mkdir(resolved, { recursive: true });
    await logOperation('CREATE_DIR', resolved, 'APPROVED');
    return { success: true, data: resolved };
  } catch (error) {
    const errorMsg = error.message || String(error);
    // Se não é timeout nem negação, loga como falha
    if (!errorMsg.includes('expirada') && !errorMsg.includes('cancelada')) {
      await logOperation('CREATE_DIR', dirPath, 'FAILED', errorMsg);
    }
    return { success: false, error: errorMsg };
  }
});

// --- Helper: Reindexar arquivo após operação aprovada ---
async function triggerFileReindex(filePath) {
  try {
    const active = await readActiveProject();
    if (!active) return; // Sem projeto ativo, não indexa
    
    // Ler repo map do arquivo local diretamente (não via IPC)
    const repoMapsDir = path.join(app.getPath('userData'), 'repo_maps');
    const localPath = path.join(repoMapsDir, `${active.id}.json`);
    
    let repoMap;
    try {
      const localData = await fs.readFile(localPath, 'utf-8');
      repoMap = JSON.parse(localData);
    } catch {
      return; // Sem repo map, não reindexa
    }

    // Escanear arquivo
    const { scanSingleFile } = require('./repo_scanner');
    const fileData = await scanSingleFile(filePath, active.path);
    
    if (!fileData.success) return;

    // Atualizar repo map local
    const relativePath = fileData.relativePath || path.relative(active.path, filePath);
    const existingIndex = repoMap.files?.findIndex(f => f.relativePath === relativePath);
    
    const fileEntry = {
      path: fileData.path,
      relativePath,
      size: fileData.size,
      extension: fileData.extension,
      category: fileData.category,
      content: fileData.content,
      signatures: fileData.signatures
    };

    if (existingIndex >= 0) {
      repoMap.files[existingIndex] = fileEntry;
    } else {
      repoMap.files = repoMap.files || [];
      repoMap.files.push(fileEntry);
    }

    await fs.writeFile(localPath, JSON.stringify(repoMap, null, 2), 'utf-8');
    console.log(`[Reindex] Arquivo atualizado: ${relativePath}`);
  } catch (err) {
    // Erro silencioso — reindexação é best-effort
    console.log('[Reindex] Erro ao reindexar arquivo:', err.message);
  }
}

// --- Helper: Remover arquivo do índice ---
async function triggerFileRemove(filePath) {
  try {
    const active = await readActiveProject();
    if (!active) return;
    
    // Converter path absoluto para relativo
    const relativePath = path.relative(active.path, filePath);
    
    // Ler repo map do arquivo local diretamente
    const repoMapsDir = path.join(app.getPath('userData'), 'repo_maps');
    const localPath = path.join(repoMapsDir, `${active.id}.json`);
    
    let repoMap;
    try {
      const localData = await fs.readFile(localPath, 'utf-8');
      repoMap = JSON.parse(localData);
    } catch {
      return;
    }

    // Remover arquivo do repo map
    repoMap.files = (repoMap.files || []).filter(f => f.relativePath !== relativePath);
    await fs.writeFile(localPath, JSON.stringify(repoMap, null, 2), 'utf-8');
    console.log(`[Reindex] Arquivo removido do índice: ${relativePath}`);
  } catch (err) {
    console.log('[Reindex] Erro ao remover arquivo do índice:', err.message);
  }
}

// --- 3. CRIAR ARQUIVO (com gate de confirmação) ---
ipcMain.handle('system:createFile', async (event, filePath, content, overwrite = false) => {
  try {
    // Verifica se arquivo já existe (leitura — sem gate)
    let fileExists = false;
    try {
      await fs.access(filePath);
      fileExists = true;
    } catch {}

    if (fileExists && !overwrite) {
      await logOperation('CREATE_FILE', filePath, 'EXISTS');
      return { success: false, exists: true, error: 'Arquivo já existe. Envie overwrite=true para sobrescrever.' };
    }

    const resolved = path.resolve(filePath);

    // GATE DE CONFIRMAÇÃO — pausa até usuário aprovar
    await requestConfirmation({
      action: 'CREATE_FILE',
      filePath: resolved,
      content: content || '',
    });

    // Cria diretório pai se necessário
    const dir = path.dirname(resolved);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(resolved, content || '', 'utf-8');
    await logOperation('CREATE_FILE', resolved, 'APPROVED', overwrite ? '(sobrescrito)' : '(novo)');
    
    // Reindexar arquivo criado (em background)
    triggerFileReindex(resolved);
    
    return { success: true, data: resolved };
  } catch (error) {
    const errorMsg = error.message || String(error);
    if (!errorMsg.includes('expirada') && !errorMsg.includes('cancelada')) {
      await logOperation('CREATE_FILE', filePath, 'FAILED', errorMsg);
    }
    return { success: false, error: errorMsg };
  }
});

// --- 4. EDITAR ARQUIVO (com gate de confirmação + diff) ---
ipcMain.handle('system:editFile', async (event, filePath, oldStr, newStr) => {
  try {
    const resolved = path.resolve(filePath);

    // Lê conteúdo atual (leitura — sem gate)
    const currentContent = await fs.readFile(resolved, 'utf-8');

    if (!currentContent.includes(oldStr)) {
      await logOperation('EDIT_FILE', resolved, 'NOT_FOUND');
      return { success: false, error: 'Trecho antigo não encontrado no arquivo.' };
    }

    // Calcula conteúdo resultante (para o diff)
    const newContent = currentContent.split(oldStr).join(newStr);

    // GATE DE CONFIRMAÇÃO — pausa até usuário aprovar
    // O preview inclui diff real (oldContent → newContent)
    await requestConfirmation({
      action: 'EDIT_FILE',
      filePath: resolved,
      content: newContent,
      oldContent: currentContent,
    });

    // Só escreve SE aprovado
    await fs.writeFile(resolved, newContent, 'utf-8');
    const occurrences = currentContent.split(oldStr).length - 1;
    await logOperation('EDIT_FILE', resolved, 'APPROVED', `${occurrences} ocorrência(s) trocada(s)`);
    
    // Reindexar arquivo editado (em background)
    triggerFileReindex(resolved);
    
    return { success: true, data: { occurrences } };
  } catch (error) {
    const errorMsg = error.message || String(error);
    if (!errorMsg.includes('expirada') && !errorMsg.includes('cancelada')) {
      await logOperation('EDIT_FILE', filePath, 'FAILED', errorMsg);
    }
    return { success: false, error: errorMsg };
  }
});

// --- Salvar conteúdo completo de arquivo (usado pelo Monaco Editor / Ctrl+S do usuário) ---
// SEM gate de confirmação — é ação direta do usuário no editor.
// Validação de path e blocklist de sensíveis continuam ativas.
// Usa withWriteLock para serializar escritas no mesmo arquivo.
ipcMain.handle('system:writeFileContent', async (event, filePath, content) => {
  try {
    const resolved = path.resolve(filePath);

    // Blocklist: recusar escrita em arquivos sensíveis
    if (isSensitiveFile(resolved)) {
      await logOperation('WRITE_FILE', resolved, 'BLOCKED', 'Arquivo sensível');
      return { success: false, error: `Arquivo sensível bloqueado: ${path.basename(resolved)}` };
    }

    // Validação de path (deve estar dentro do projeto)
    const active = await readActiveProject();
    if (active && !isPathInsideProject(resolved, active.path)) {
      await logOperation('WRITE_FILE', resolved, 'BLOCKED', 'Fora do projeto');
      return { success: false, error: 'Arquivo fora do diretório do projeto' };
    }

    // Serializar escrita: aguardar escrita anterior no mesmo path
    await withWriteLock(resolved, async () => {
      // Garantir que o diretório pai existe
      const dir = path.dirname(resolved);
      await fs.mkdir(dir, { recursive: true });

      // Salvar em disco
      await fs.writeFile(resolved, content, 'utf-8');
    });

    // Log de auditoria (fonte confiável de tudo que mudou no projeto)
    await logOperation('SAVED_BY_USER', resolved, 'OK', `${content.length} bytes`);

    // Reindexar arquivo (em background)
    triggerFileReindex(resolved);

    return { success: true, data: resolved };
  } catch (error) {
    const errorMsg = error.message || String(error);
    await logOperation('SAVED_BY_USER', filePath, 'FAILED', errorMsg);
    return { success: false, error: errorMsg };
  }
});

// --- Resposta de confirmação do frontend ---
ipcMain.handle('confirm:response', async (event, { requestId, approved, alwaysAllow, scope }) => {
  const pending = pendingConfirmations.get(requestId);
  if (!pending) {
    return { success: false, error: 'Confirmação não encontrada ou expirada' };
  }

  clearTimeout(pending.timeout);
  pendingConfirmations.delete(requestId);

  if (approved) {
    // Se "Permitir sempre" foi marcado, salvar regra
    if (alwaysAllow && pending.projectId) {
      await savePermissionRule(pending.projectId, pending.action, scope || pending.filePath);
      await logOperation(pending.action, pending.filePath, 'ALWAYS_ALLOW', `Regra salva: ${scope || pending.filePath}`);
    }
    pending.resolve();
  } else {
    await logOperation(pending.action, pending.filePath, 'DENIED');
    pending.reject(new Error('Operação cancelada pelo usuário'));
  }

  return { success: true };
});

// --- Log de operações ---
ipcMain.handle('system:getOperationsLog', async (event, { limit = 50 } = {}) => {
  try {
    const content = await fs.readFile(LOG_PATH, 'utf-8').catch(() => '');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries = lines.slice(-limit).reverse().map(line => {
      // Formato: [timestamp | action | result | path | extra]
      const match = line.match(/^\[(.+?)\] (.+?) \| (.+?) \| (.+?)(?:\| (.+))?$/);
      if (!match) return null;
      return {
        timestamp: match[1],
        action: match[2],
        result: match[3],
        path: match[4].trim(),
        extra: match[5] ? match[5].trim() : ''
      };
    }).filter(Boolean);
    return { success: true, data: entries };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- Operações auxiliares ---
ipcMain.handle('system:readFile', async (event, filePath) => {
  try {
    // Blocklist: recusar leitura de arquivos sensíveis
    if (isSensitiveFile(filePath)) {
      await logOperation('READ_FILE', filePath, 'BLOCKED', 'Arquivo sensível');
      return { success: false, error: `Arquivo sensível bloqueado: ${path.basename(filePath)}` };
    }
    const content = await fs.readFile(filePath, 'utf-8');
    await logOperation('READ_FILE', filePath, 'OK');
    return { success: true, data: content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('system:deleteFile', async (event, filePath) => {
  try {
    const active = await readActiveProject();
    const resolved = path.resolve(filePath);

    // GATE DE CONFIRMAÇÃO — pausa até usuário aprovar
    await requestConfirmation({
      action: 'DELETE_FILE',
      filePath: resolved,
      content: `Deletar arquivo: ${resolved}`,
      projectId: active?.id,
      checkRule: true,
      scope: resolved
    });

    await fs.unlink(resolved);
    await logOperation('DELETE_FILE', resolved, 'APPROVED');
    
    // Remover do índice (em background)
    triggerFileRemove(resolved);
    
    return { success: true };
  } catch (error) {
    const errorMsg = error.message || String(error);
    if (!errorMsg.includes('expirada') && !errorMsg.includes('cancelada')) {
      await logOperation('DELETE_FILE', filePath, 'FAILED', errorMsg);
    }
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('system:deleteDir', async (event, dirPath) => {
  try {
    const active = await readActiveProject();
    const resolved = path.resolve(dirPath);

    // GATE DE CONFIRMAÇÃO — pausa até usuário aprovar
    await requestConfirmation({
      action: 'DELETE_DIR',
      filePath: resolved,
      content: `Deletar pasta: ${resolved}`,
      projectId: active?.id,
      checkRule: true,
      scope: resolved
    });

    await fs.rm(resolved, { recursive: true, force: true });
    await logOperation('DELETE_DIR', resolved, 'APPROVED');
    return { success: true };
  } catch (error) {
    const errorMsg = error.message || String(error);
    if (!errorMsg.includes('expirada') && !errorMsg.includes('cancelada')) {
      await logOperation('DELETE_DIR', dirPath, 'FAILED', errorMsg);
    }
    return { success: false, error: errorMsg };
  }
});

ipcMain.handle('system:listDir', async (event, dirPath) => {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    const result = await Promise.all(
      items.map(async (item) => {
        const fullPath = path.join(dirPath, item.name);
        try {
          const stats = await fs.stat(fullPath);
          return {
            name: item.name,
            isDirectory: item.isDirectory(),
            isFile: item.isFile(),
            size: stats.size,
            modified: stats.mtime.toISOString()
          };
        } catch {
          return { name: item.name, isDirectory: item.isDirectory(), isFile: item.isFile() };
        }
      })
    );
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('system:getUserInfo', async () => {
  return {
    success: true,
    data: {
      home: app.getPath('home'),
      desktop: app.getPath('desktop'),
      documents: app.getPath('documents'),
      downloads: app.getPath('downloads'),
      appData: app.getPath('appData'),
      temp: app.getPath('temp'),
      platform: process.platform,
      arch: process.arch
    }
  };
});

ipcMain.handle('system:openPath', async (event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- IPC: Knowledge Graph (port 8000) ---
const KG_BASE = 'http://localhost:8000';

async function kgFetch(endpoint, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${KG_BASE}${endpoint}`, opts);
  return res.json();
}

ipcMain.handle('knowledge:pipeline', async (event, { text, projectId, nodeType, metadata, fileContext }) => {
  try {
    const data = await kgFetch('/pipeline', 'POST', {
      text,
      project_id: projectId || 'default',
      node_type: nodeType || 'contexto_projeto',
      metadata: metadata || {},
      file_context: fileContext || null,
    });
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('knowledge:search', async (event, { text, projectId, topK, threshold }) => {
  try {
    const data = await kgFetch('/nodes/search', 'POST', {
      text,
      project_id: projectId || 'default',
      top_k: topK || 5,
      threshold: threshold || 0.75,
    });
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('knowledge:createNode', async (event, { content, nodeType, projectId, metadata }) => {
  try {
    const data = await kgFetch('/nodes', 'POST', {
      content,
      node_type: nodeType || 'contexto_projeto',
      project_id: projectId || 'default',
      metadata: metadata || {},
    });
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('knowledge:stats', async () => {
  try {
    const data = await kgFetch('/stats');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- Memórias ---
const MEMORY_DIR = path.join(app.getPath('userData'), 'memory');
const MEMORY_FILE = path.join(MEMORY_DIR, 'memories.json');
const MEMORY_SETTINGS_FILE = path.join(MEMORY_DIR, 'settings.json');

async function ensureMemoryDir() {
  try {
    await fs.access(MEMORY_DIR);
  } catch {
    await fs.mkdir(MEMORY_DIR, { recursive: true });
  }
}

async function readMemories() {
  try {
    const data = await fs.readFile(MEMORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeMemories(memories) {
  await ensureMemoryDir();
  await fs.writeFile(MEMORY_FILE, JSON.stringify(memories, null, 2), 'utf-8');
}

async function readMemorySettings() {
  try {
    const data = await fs.readFile(MEMORY_SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return { autoGenerate: true };
  }
}

async function writeMemorySettings(settings) {
  await ensureMemoryDir();
  await fs.writeFile(MEMORY_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
}

ipcMain.handle('memory:list', async () => {
  try {
    const memories = await readMemories();
    return { success: true, data: memories };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('memory:create', async (event, memory) => {
  try {
    const memories = await readMemories();
    const newMemory = {
      id: Date.now().toString(),
      category: memory.category || 'outros',
      title: memory.title,
      content: memory.content,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memories.push(newMemory);
    await writeMemories(memories);
    return { success: true, data: newMemory };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('memory:update', async (event, id, updates) => {
  try {
    const memories = await readMemories();
    const index = memories.findIndex(m => m.id === id);
    if (index === -1) return { success: false, error: 'Memória não encontrada' };
    memories[index] = { ...memories[index], ...updates, updatedAt: new Date().toISOString() };
    await writeMemories(memories);
    return { success: true, data: memories[index] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('memory:delete', async (event, id) => {
  try {
    const memories = await readMemories();
    const filtered = memories.filter(m => m.id !== id);
    await writeMemories(filtered);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('memory:getSettings', async () => {
  try {
    const settings = await readMemorySettings();
    return { success: true, data: settings };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('memory:saveSettings', async (event, settings) => {
  try {
    await writeMemorySettings(settings);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- Gerenciamento de Projetos ---
const PROJECTS_DIR = path.join(app.getPath('userData'), 'projects');
const PROJECTS_FILE = path.join(PROJECTS_DIR, 'projects.json');
const ACTIVE_PROJECT_FILE = path.join(PROJECTS_DIR, 'active.json');

// Pastas ignoradas no escaneamento
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', 'venv',
  '__pycache__', '.vscode', '.idea', '.cache', 'coverage',
  '.pytest_cache', '.mypy_cache', '.tox', 'eggs', '*.egg-info'
]);

async function ensureProjectsDir() {
  try {
    await fs.access(PROJECTS_DIR);
  } catch {
    await fs.mkdir(PROJECTS_DIR, { recursive: true });
  }
}

async function readProjects() {
  try {
    const data = await fs.readFile(PROJECTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeProjects(projects) {
  await ensureProjectsDir();
  await fs.writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
}

async function readActiveProject() {
  try {
    const data = await fs.readFile(ACTIVE_PROJECT_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function writeActiveProject(project) {
  await ensureProjectsDir();
  await fs.writeFile(ACTIVE_PROJECT_FILE, JSON.stringify(project, null, 2), 'utf-8');
}

/**
 * Valida se um path está dentro da raiz do projeto.
 * Usa fsSync.realpathSync para resolver symlinks antes de comparar.
 * Se o path não existir ainda, resolve o diretório PAI mais próximo
 * que existir (subindo a árvore até achar um diretório real) e valida
 * contra esse pai resolvido — protege contra criação via symlink.
 */
const fsSync = require('fs');

function isPathInsideProject(filePath, projectRoot) {
  if (!projectRoot) return false;

  // Resolver o root (seguindo symlinks)
  let resolvedRoot;
  try {
    resolvedRoot = fsSync.realpathSync(projectRoot);
  } catch {
    resolvedRoot = path.resolve(projectRoot);
  }

  // Tentar resolver o path inteiro (seguindo symlinks)
  let resolved;
  try {
    resolved = fsSync.realpathSync(filePath);
  } catch {
    // Arquivo não existe — subir a árvore até achar o diretório pai existente
    let current = path.resolve(filePath);
    let lastReal = null;

    while (current && current !== path.dirname(current)) {
      try {
        lastReal = fsSync.realpathSync(current);
        break; // Achou um diretório/file real
      } catch {
        current = path.dirname(current);
      }
    }

    if (lastReal) {
      // Reconstruir o caminho completo usando o pai real resolvido
      const absPath = path.resolve(filePath);
      const remaining = path.relative(current, absPath);
      resolved = path.join(lastReal, remaining);
    } else {
      // Nenhum pai existe — usar path.resolve como último recurso
      resolved = path.resolve(filePath);
    }
  }

  return resolved.startsWith(resolvedRoot + path.sep) || resolved === resolvedRoot;
}

/**
 * Resolve um caminho de forma segura, verificando que ele permanece dentro
 * do diretório permitido mesmo após resolução de symlinks e ../.
 * Retorna o path resolvido se seguro, ou null se for escapar do diretório.
 */
function resolveSafePath(baseDir, untrustedPath) {
  const resolved = path.resolve(baseDir, untrustedPath);
  const resolvedBase = path.resolve(baseDir);
  if (resolved === resolvedBase || resolved.startsWith(resolvedBase + path.sep)) {
    return resolved;
  }
  return null;
}

/**
 * Escaneia a estrutura de arquivos de um projeto.
 * Retorna uma lista de arquivos/pastas ignorando diretórios pesados.
 */
async function scanProjectStructure(dirPath, maxDepth = 3, currentDepth = 0) {
  if (currentDepth >= maxDepth) return ['...'];
  
  const items = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }
      
      if (entry.isDirectory()) {
        const subItems = await scanProjectStructure(
          path.join(dirPath, entry.name),
          maxDepth,
          currentDepth + 1
        );
        items.push({ name: entry.name + '/', children: subItems });
      } else {
        items.push({ name: entry.name });
      }
    }
  } catch (error) {
    // Se não conseguir ler, retorna vazio
  }
  
  return items;
}

/**
 * Formata a estrutura para texto legível.
 */
function formatStructure(items, indent = 0) {
  const lines = [];
  const prefix = '  '.repeat(indent);
  
  for (const item of items) {
    if (item.children) {
      lines.push(`${prefix}- ${item.name}`);
      lines.push(...formatStructure(item.children, indent + 1));
    } else {
      lines.push(`${prefix}- ${item.name}`);
    }
  }
  
  return lines;
}

// --- Handlers IPC de Projeto ---

// Listar projetos salvos
ipcMain.handle('project:list', async () => {
  try {
    const projects = await readProjects();
    return { success: true, data: projects };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Obter projeto ativo atual
ipcMain.handle('project:getActive', async () => {
  try {
    const active = await readActiveProject();
    return { success: true, data: active };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Selecionar projeto ativo
ipcMain.handle('project:select', async (event, projectId) => {
  try {
    if (projectId === null) {
      await writeActiveProject(null);
      return { success: true, data: null };
    }

    const projects = await readProjects();
    const project = projects.find(p => p.id === projectId);
    
    if (!project) {
      return { success: false, error: 'Projeto não encontrado' };
    }

    // Verifica se o path ainda existe
    try {
      await fs.access(project.path);
    } catch {
      return { success: false, error: 'Pasta do projeto não encontrada no disco' };
    }

    await writeActiveProject(project);
    return { success: true, data: project };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Adicionar projeto novo
ipcMain.handle('project:add', async (event, dirPath) => {
  try {
    // Se não foi fornecido path, abre o dialog nativo
    let selectedPath = dirPath;
    
    if (!selectedPath) {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Selecionar pasta do projeto'
      });
      
      if (result.canceled || !result.filePaths[0]) {
        return { success: false, canceled: true };
      }
      
      selectedPath = result.filePaths[0];
    }

    // Valida que o path existe e é acessível
    try {
      const stats = await fs.stat(selectedPath);
      if (!stats.isDirectory()) {
        return { success: false, error: 'O caminho selecionado não é uma pasta' };
      }
    } catch {
      return { success: false, error: 'Pasta não encontrada ou sem acesso' };
    }

    // Verifica se já existe um projeto com esse path
    const existingProjects = await readProjects();
    const existing = existingProjects.find(p => p.path === selectedPath);
    
    if (existing) {
      // Se já existe, apenas seleciona como ativo
      await writeActiveProject(existing);
      return { success: true, data: existing, alreadyExists: true };
    }

    // Escaneia a estrutura
    const structure = await scanProjectStructure(selectedPath);
    const hasContent = structure.length > 0;

    // Gera ID único
    const projectId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    
    // Nome do projeto = nome da pasta
    const folderName = path.basename(selectedPath);

    const newProject = {
      id: projectId,
      name: folderName,
      path: selectedPath,
      hasContent,
      structure: hasContent ? formatStructure(structure).join('\n') : null,
      createdAt: new Date().toISOString(),
      lastUsed: new Date().toISOString()
    };

    // Salva o projeto
    existingProjects.push(newProject);
    await writeProjects(existingProjects);

    // Se tem conteúdo, cria nó no knowledge graph
    if (hasContent) {
      try {
        await kgFetch('/nodes', 'POST', {
          content: `Estrutura do projeto "${folderName}":\n${newProject.structure}`,
          node_type: 'contexto_projeto',
          project_id: projectId,
          metadata: { type: 'project_structure', path: selectedPath }
        });
      } catch (kgError) {
        console.log('Knowledge graph indisponível para indexação:', kgError.message);
      }
    }

    // Indexar codebase completa em background (não bloqueia)
    if (hasContent) {
      console.log(`[Repo] Iniciando indexação em background para ${folderName}...`);
      // Dispara indexação em background (async, sem await)
      scanProject(selectedPath, () => {}).then(async (repoMap) => {
        try {
          // Salvar repo map localmente primeiro (para uso imediato)
          const repoMapsDir = path.join(app.getPath('userData'), 'repo_maps');
          await fs.mkdir(repoMapsDir, { recursive: true });
          const repoMapPath = path.join(repoMapsDir, `${projectId}.json`);
          await fs.writeFile(repoMapPath, JSON.stringify(repoMap, null, 2), 'utf-8');
          console.log(`[Repo] ✅ Repo map salvo localmente: ${repoMapPath}`);
          console.log(`[Repo] Total de arquivos indexados: ${repoMap.totalFiles}`);

          // Tentar enviar para Python (se disponível)
          try {
            await sendToIndexer(projectId, repoMap);
            console.log(`[Repo] Projeto ${folderName} indexado no knowledge graph: ${repoMap.totalFiles} arquivos`);
          } catch (kgErr) {
            console.log(`[Repo] Knowledge graph indisponível (funcionando sem embeddings): ${kgErr.message}`);
          }
        } catch (err) {
          console.error('[Repo] Erro ao salvar repo map:', err.message);
        }
      }).catch(err => {
        console.error('[Repo] Erro ao escanear projeto:', err.message);
      });
    } else {
      console.log(`[Repo] Projeto ${folderName} sem conteúdo para indexar`);
    }

    // Define como ativo
    await writeActiveProject(newProject);

    await logOperation('PROJECT_ADDED', selectedPath, 'OK', `hasContent=${hasContent}`);

    return { success: true, data: newProject };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Remover projeto
ipcMain.handle('project:remove', async (event, projectId) => {
  try {
    const projects = await readProjects();
    const filtered = projects.filter(p => p.id !== projectId);
    await writeProjects(filtered);

    // Se era o ativo, limpa
    const active = await readActiveProject();
    if (active?.id === projectId) {
      await writeActiveProject(null);
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- Gerenciamento de Regras de Permissão ("Permitir sempre") ---

// Listar regras de permissão
ipcMain.handle('permissions:list', async (event, projectId) => {
  try {
    const { rules } = await readPermissionRules();
    const filtered = projectId ? rules.filter(r => r.projectId === projectId) : rules;
    return { success: true, data: filtered };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Adicionar regra de permissão
ipcMain.handle('permissions:add', async (event, { projectId, action, scope }) => {
  try {
    await savePermissionRule(projectId, action, scope);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Remover regra de permissão
ipcMain.handle('permissions:remove', async (event, ruleId) => {
  try {
    const data = await readPermissionRules();
    data.rules = data.rules.filter(r => r.id !== ruleId);
    await writePermissionRules(data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Limpar todas as regras de um projeto
ipcMain.handle('permissions:clear', async (event, projectId) => {
  try {
    const data = await readPermissionRules();
    data.rules = data.rules.filter(r => r.projectId !== projectId);
    await writePermissionRules(data);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- Indexação de Codebase (Repo Map) ---
const { scanProject, scanSingleFile, sendToIndexer, sendFileToIndexer } = require('./repo_scanner');

// Indexar projeto completo
ipcMain.handle('repo:index', async (event, { projectId, projectPath, onProgress }) => {
  try {
    // Escanear projeto (delega AST para workers)
    const repoMap = await scanProject(projectPath, (progress) => {
      // Enviar progresso para o frontend
      if (mainWindow) {
        mainWindow.webContents.send('repo:indexProgress', { projectId, ...progress });
      }
    });

    // Enviar para Python indexar
    const result = await sendToIndexer(projectId, repoMap);

    await logOperation('REPO_INDEX', projectPath, 'OK', 
      `${repoMap.totalFiles} arquivos`);

    return { success: true, data: { repoMap, indexerResult: result } };
  } catch (error) {
    await logOperation('REPO_INDEX', projectPath, 'FAILED', error.message);
    return { success: false, error: error.message };
  }
});

// Obter repo map cacheado
ipcMain.handle('repo:getMap', async (event, projectId) => {
  try {
    console.log(`[Repo:getMap] Buscando repo map para projeto: ${projectId}`);
    
    // Primeiro: tentar ler do arquivo local
    const repoMapsDir = path.join(app.getPath('userData'), 'repo_maps');
    const localPath = path.join(repoMapsDir, `${projectId}.json`);
    
    try {
      const localData = await fs.readFile(localPath, 'utf-8');
      const repoMap = JSON.parse(localData);
      console.log(`[Repo:getMap] Repo map local encontrado: ${repoMap.files?.length || 0} arquivos`);
      return { success: true, data: repoMap };
    } catch (localErr) {
      console.log(`[Repo:getMap] Arquivo local não existe: ${localPath}`);
    }

    // Fallback: tentar Python backend
    const KG_BASE = 'http://localhost:8000';
    const response = await fetch(`${KG_BASE}/repo/map/${projectId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, error: 'Repo map não encontrado', notFound: true };
      }
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.log(`[Repo:getMap] Erro: ${error.message}`);
    return { success: false, error: error.message };
  }
});

// Reindexar arquivo individual (após create/edit)
ipcMain.handle('repo:reindexFile', async (event, { projectId, projectPath, filePath }) => {
  try {
    const fileData = await scanSingleFile(filePath, projectPath);
    
    if (!fileData.success) {
      throw new Error(fileData.error || 'Erro ao escanear arquivo');
    }

    // Atualizar repo map local
    try {
      const repoMapsDir = path.join(app.getPath('userData'), 'repo_maps');
      const localPath = path.join(repoMapsDir, `${projectId}.json`);
      
      let repoMap = { files: [] };
      try {
        const localData = await fs.readFile(localPath, 'utf-8');
        repoMap = JSON.parse(localData);
      } catch {}

      // Atualizar ou adicionar arquivo
      const relativePath = fileData.relativePath || path.relative(projectPath, filePath);
      const existingIndex = repoMap.files?.findIndex(f => f.relativePath === relativePath);
      
      const fileEntry = {
        path: fileData.path,
        relativePath,
        size: fileData.size,
        extension: fileData.extension,
        category: fileData.category,
        content: fileData.content,
        signatures: fileData.signatures
      };

      if (existingIndex >= 0) {
        repoMap.files[existingIndex] = fileEntry;
      } else {
        repoMap.files = repoMap.files || [];
        repoMap.files.push(fileEntry);
      }

      await fs.writeFile(localPath, JSON.stringify(repoMap, null, 2), 'utf-8');
    } catch (localErr) {
      console.log('[Repo] Erro ao atualizar repo map local:', localErr.message);
    }

    // Tentar enviar para Python (se disponível)
    try {
      await sendFileToIndexer(projectId, projectPath, fileData);
    } catch (kgErr) {
      // Python indisponível, ok
    }

    await logOperation('REPO_REINDEX', filePath, 'OK');

    return { success: true };
  } catch (error) {
    await logOperation('REPO_REINDEX', filePath, 'FAILED', error.message);
    return { success: false, error: error.message };
  }
});

// Remover arquivo do índice
ipcMain.handle('repo:removeFile', async (event, { projectId, filePath }) => {
  try {
    // Atualizar repo map local
    try {
      const repoMapsDir = path.join(app.getPath('userData'), 'repo_maps');
      const localPath = path.join(repoMapsDir, `${projectId}.json`);
      
      let repoMap = { files: [] };
      try {
        const localData = await fs.readFile(localPath, 'utf-8');
        repoMap = JSON.parse(localData);
      } catch {}

      // Remover arquivo
      repoMap.files = (repoMap.files || []).filter(f => f.relativePath !== filePath);
      await fs.writeFile(localPath, JSON.stringify(repoMap, null, 2), 'utf-8');
    } catch (localErr) {
      console.log('[Repo] Erro ao atualizar repo map local:', localErr.message);
    }

    // Tentar remover do Python (se disponível)
    try {
      const KG_BASE = 'http://localhost:8000';
      await fetch(`${KG_BASE}/repo/file`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: projectId, file_path: filePath })
      });
    } catch (kgErr) {
      // Python indisponível, ok
    }

    await logOperation('REPO_REMOVE', filePath, 'OK');

    return { success: true };
  } catch (error) {
    await logOperation('REPO_REMOVE', filePath, 'FAILED', error.message);
    return { success: false, error: error.message };
  }
});

// --- Lifecycle do app ---
app.whenReady().then(async () => {
  await startServer();
  createWindow();
});

// Fecha confirmações pendentes antes de encerrar
app.on('before-quit', async (event) => {
  if (pendingConfirmations.size > 0) {
    event.preventDefault();

    const cleanupPromises = [];
    for (const [requestId, { reject, timeout }] of pendingConfirmations) {
      clearTimeout(timeout);
      // Rejeitar a promise ORIGINAL que o agente está aguardando
      reject(new Error('App fechado — operação cancelada'));
      cleanupPromises.push(
        logOperation('CONFIRM_CANCELLED', requestId, 'CLOSED', 'App fechado')
      );
    }
    pendingConfirmations.clear();

    // Aguarda os logs resolverem antes de quit
    await Promise.allSettled(cleanupPromises);

    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (httpServer) httpServer.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
