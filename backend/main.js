const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const http = require('http');
const crypto = require('crypto');
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

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

// --- Logging ---
const LOG_PATH = path.join(app.getPath('userData'), 'operations.log');

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
function requestConfirmation({ action, filePath, content, oldContent, timeout = DEFAULT_CONFIRM_TIMEOUT_MS }) {
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
      timeout
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

ipcMain.handle('chat:send', async (event, message, history = [], userContext = {}, model = OPENROUTER_MODEL) => {
  try {
    let systemPrompt = 'Você é um assistente inteligente e prestativo. Responda em português brasileiro. Seja direto e útil.';
    
    if (userContext.name) {
      systemPrompt += ` O usuário se chama ${userContext.name}. Use esse nome nas respostas quando apropriado.`;
    }
    
    if (userContext.instructions) {
      systemPrompt += ` Instruções do usuário: ${userContext.instructions}`;
    }

    if (userContext.skillContent) {
      systemPrompt += `\n\n## Habilidade selecionada pelo usuário:\n\n${userContext.skillContent}\n\nUse esta habilidade para guiar sua resposta.`;
    }

    if (userContext.knowledgeContext) {
      systemPrompt += `\n\n## Contexto do grafo de conhecimento (memória de longo prazo):\n\n${userContext.knowledgeContext}\n\nUse essas informações para dar respostas mais fundamentadas e consistentes com decisões anteriores.`;
    }

    const skills = await loadAllSkills();
    if (skills.length > 0) {
      systemPrompt += '\n\n## Habilidades disponíveis:\n\n';
      skills.forEach((skillContent, i) => {
        systemPrompt += `### Habilidade ${i + 1}\n${skillContent}\n\n`;
      });
      systemPrompt += 'Use essas habilidades conforme apropriado para responder ao usuário.';
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
        'HTTP-Referer': 'https://localhost:3000',
        'X-Title': 'AI Assistant'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        max_tokens: 2048,
        temperature: 0.7
      })
    });

    const data = await response.json();
    
    if (data.error) {
      return { success: false, error: data.error.message || 'Erro na API' };
    }

    const reply = data.choices?.[0]?.message?.content || 'Sem resposta';
    return { success: true, data: { response: reply } };
  } catch (error) {
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
    const filePath = path.join(SKILLS_DIR, fileName);
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, data: content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('skills:save', async (event, fileName, content) => {
  await ensureSkillsDir();
  try {
    const filePath = path.join(SKILLS_DIR, fileName);
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('skills:delete', async (event, fileName) => {
  await ensureSkillsDir();
  try {
    const filePath = path.join(SKILLS_DIR, fileName);
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
      const destPath = path.join(SKILLS_DIR, fileName);
      await fs.writeFile(destPath, content, 'utf-8');
      imported.push(fileName);
    }
    
    return { success: true, data: imported };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// IPC - System Control
ipcMain.handle('system:execute', async (event, command, cwd) => {
  try {
    const options = {
      cwd: cwd || app.getPath('home'),
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10
    };
    const { stdout, stderr } = await execAsync(command, options);
    return { success: true, data: { stdout, stderr } };
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
    return { success: true, data: { occurrences } };
  } catch (error) {
    const errorMsg = error.message || String(error);
    if (!errorMsg.includes('expirada') && !errorMsg.includes('cancelada')) {
      await logOperation('EDIT_FILE', filePath, 'FAILED', errorMsg);
    }
    return { success: false, error: errorMsg };
  }
});

// --- Resposta de confirmação do frontend ---
ipcMain.handle('confirm:response', async (event, { requestId, approved }) => {
  const pending = pendingConfirmations.get(requestId);
  if (!pending) {
    return { success: false, error: 'Confirmação não encontrada ou expirada' };
  }

  clearTimeout(pending.timeout);
  pendingConfirmations.delete(requestId);

  if (approved) {
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
    const content = await fs.readFile(filePath, 'utf-8');
    await logOperation('READ_FILE', filePath, 'OK');
    return { success: true, data: content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('system:deleteFile', async (event, filePath) => {
  try {
    await fs.unlink(filePath);
    await logOperation('DELETE_FILE', filePath, 'OK');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('system:deleteDir', async (event, dirPath) => {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    await logOperation('DELETE_DIR', dirPath, 'OK');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
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

// --- Lifecycle do app ---
app.whenReady().then(async () => {
  await startServer();
  createWindow();
});

// Fecha confirmações pendentes antes de encerrar
app.on('before-quit', async (event) => {
  if (pendingConfirmations.size > 0) {
    event.preventDefault();

    const rejections = [];
    for (const [requestId, { reject, timeout }] of pendingConfirmations) {
      clearTimeout(timeout);
      rejections.push(
        (async () => {
          try {
            await Promise.reject(new Error('App fechado — operação cancelada'));
          } catch (e) {
            await logOperation('CONFIRM_CANCELLED', requestId, 'CLOSED', e.message);
          }
        })()
      );
    }
    pendingConfirmations.clear();

    // Aguarda todas as rejeições + logs resolverem antes de quit
    await Promise.allSettled(rejections);

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
