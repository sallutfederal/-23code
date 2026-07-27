const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

let mainWindow;
let server;

// --- Logging ---
const LOG_PATH = path.join(app.getPath('userData'), 'operations.log');

async function logOperation(action, filePath, extra = '') {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${action} | ${filePath}${extra ? ' | ' + extra : ''}\n`;
  try {
    await fs.appendFile(LOG_PATH, line, 'utf-8');
  } catch {
    // Se o log falhar, não quebra a operação
  }
}

// --- Resolução de caminhos ---
// Mapeia nomes conhecidos do SO para os paths reais
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

  // Se é um nome conhecido do SO, usa app.getPath
  if (KNOWN_FOLDERS[lower]) {
    return KNOWN_FOLDERS[lower]();
  }

  // Se é caminho absoluto, usa direto
  if (path.isAbsolute(trimmed)) {
    return path.normalize(trimmed);
  }

  // Se é relativo, resolve a partir da home do usuário
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
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`Porta ${PORT} em uso, tentando ${PORT + 1}...`);
        server.listen(PORT + 1, () => {
          console.log(`API server: http://localhost:${PORT + 1}`);
          resolve();
        });
      }
    });
    
    server.listen(PORT, () => {
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

// --- 1. LOCALIZAR PASTA ---
ipcMain.handle('system:locateFolder', async (event, folderName) => {
  try {
    const resolved = resolveFolderPath(folderName);
    await logOperation('LOCATE_FOLDER', folderName, `→ ${resolved}`);
    return { success: true, data: resolved };
  } catch (error) {
    await logOperation('LOCATE_FOLDER_FAIL', folderName, error.message);
    return { success: false, error: error.message };
  }
});

// --- 2. CRIAR PASTA ---
ipcMain.handle('system:createDir', async (event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    await logOperation('CREATE_DIR', dirPath);
    return { success: true, data: dirPath };
  } catch (error) {
    await logOperation('CREATE_DIR_FAIL', dirPath, error.message);
    return { success: false, error: error.message };
  }
});

// --- 3. CRIAR ARQUIVO ---
// Se o arquivo já existe, retorna { exists: true } para o frontend decidir
ipcMain.handle('system:createFile', async (event, filePath, content, overwrite = false) => {
  try {
    // Verifica se arquivo já existe
    try {
      await fs.access(filePath);
      // Arquivo existe
      if (!overwrite) {
        await logOperation('CREATE_FILE_EXISTS', filePath);
        return { success: false, exists: true, error: 'Arquivo já existe. Envie overwrite=true para sobrescrever.' };
      }
    } catch {
      // fs.access lança erro se não existe — OK, vamos criar
    }

    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, content || '', 'utf-8');
    await logOperation('CREATE_FILE', filePath, overwrite ? '(sobrescrito)' : '(novo)');
    return { success: true, data: filePath };
  } catch (error) {
    await logOperation('CREATE_FILE_FAIL', filePath, error.message);
    return { success: false, error: error.message };
  }
});

// --- 4. EDITAR ARQUIVO (find-and-replace) ---
ipcMain.handle('system:editFile', async (event, filePath, oldStr, newStr) => {
  try {
    // Lê conteúdo atual
    const content = await fs.readFile(filePath, 'utf-8');

    // Verifica se o trecho antigo existe no arquivo
    if (!content.includes(oldStr)) {
      await logOperation('EDIT_FILE_NOT_FOUND', filePath, `oldStr não encontrado`);
      return { success: false, error: 'Trecho antigo não encontrado no arquivo.' };
    }

    // Faz a troca (todas as ocorrências)
    const updated = content.split(oldStr).join(newStr);
    await fs.writeFile(filePath, updated, 'utf-8');

    const occurrences = content.split(oldStr).length - 1;
    await logOperation('EDIT_FILE', filePath, `${occurrences} ocorrência(s) trocada(s)`);
    return { success: true, data: { occurrences } };
  } catch (error) {
    await logOperation('EDIT_FILE_FAIL', filePath, error.message);
    return { success: false, error: error.message };
  }
});

// --- Operações auxiliares (manter as existentes) ---
ipcMain.handle('system:readFile', async (event, filePath) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    await logOperation('READ_FILE', filePath);
    return { success: true, data: content };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('system:deleteFile', async (event, filePath) => {
  try {
    await fs.unlink(filePath);
    await logOperation('DELETE_FILE', filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('system:deleteDir', async (event, dirPath) => {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    await logOperation('DELETE_DIR', dirPath);
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

app.whenReady().then(async () => {
  await startServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (server) server.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
