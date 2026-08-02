/**
 * repo_scanner.js — Scanner de árvore de diretórios + parsing AST via worker.
 * 
 * Responsabilidades:
 * 1. Escanear diretório recursivamente
 * 2. Respeitar .gitignore (lib `ignore`)
 * 3. Classificar arquivos (small/large/binary)
 * 4. Delegar parsing AST para worker threads
 * 5. Montar repo_map completo
 * 
 * O parsing pesado (AST) é delegado para worker_threads para não
 * bloquear o main process do Electron.
 */

const fs = require('fs');
const path = require('path');
const { Worker } = require('worker_threads');

// Diretórios sempre ignorados (mesmo sem .gitignore)
const ALWAYS_IGNORED = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.cache',
  'venv', '.venv', '__pycache__', '.pytest_cache', '.mypy_cache',
  '.tox', '.nyc_output', 'coverage', '.idea', '.vscode',
  'bower_components', 'jspm_packages', '.serverless',
  'tmp', 'temp', '.tmp'
]);

// Extensões binárias/não indexáveis
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
  '.mp3', '.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm',
  '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2',
  '.exe', '.dll', '.so', '.dylib', '.o', '.obj',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.sqlite', '.db', '.sqlite3'
]);

// Extensões de código para parsing AST
const CODE_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'
]);

// Extensões de configuração relevantes
const CONFIG_EXTENSIONS = new Set([
  '.json', '.yaml', '.yml', '.toml', '.ini', '.env'
]);

// --- Blocklist de arquivos sensíveis (nunca ler conteúdo nem enviar para embedding) ---
const SENSITIVE_FILE_PATTERNS = [
  /^\.env$/i, /^\.env\./i,
  /\.pem$/i, /\.key$/i, /\.p12$/i, /\.pfx$/i,
  /^id_rsa/i, /^id_ed25519/i, /^id_dsa/i, /^id_ecdsa/i,
  /credentials\.json$/i, /service.*account.*\.json$/i,
  /\.npmrc$/i, /\.pypirc$/i, /htpasswd/i,
  /\.secret$/i, /\.secrets$/i,
];

function isSensitiveFile(filePath) {
  const basename = path.basename(filePath);
  return SENSITIVE_FILE_PATTERNS.some(pattern => pattern.test(basename));
}

// Configuração de thresholds
const CONFIG = {
  SMALL_FILE_MAX_SIZE: 8 * 1024,      // 8KB
  SMALL_FILE_MAX_LINES: 200,
  LARGE_FILE_MAX_SIZE: 1024 * 1024,   // 1MB
  WORKER_BATCH_SIZE: 10,
  WORKER_POOL_SIZE: 2
};

/**
 * Carrega .gitignore e retorna função de filtro.
 * Usa a lib `ignore` para parsing correto.
 */
function loadGitignore(projectPath) {
  const ignore = require('ignore');
  const ig = ignore();
  
  const gitignorePath = path.join(projectPath, '.gitignore');
  
  try {
    const content = fs.readFileSync(gitignorePath, 'utf-8');
    ig.add(content);
  } catch (err) {
    // Sem .gitignore = aceita tudo (exceto ALWAYS_IGNORED)
  }
  
  return ig;
}

/**
 * Verifica se um arquivo deve ser ignorado.
 */
function shouldIgnore(filePath, relativePath, ignoreFilter) {
  const basename = path.basename(filePath);
  
  // Sempre ignorados
  if (ALWAYS_IGNORED.has(basename)) return true;
  
  // Começa com ponto (arquivos ocultos)
  if (basename.startsWith('.') && basename !== '.env') return true;
  
  // .gitignore
  if (ignoreFilter && ignoreFilter.ignores(relativePath)) return true;
  
  return false;
}

/**
 * Classifica um arquivo por tipo e tamanho.
 */
function classifyFile(filePath, stats) {
  const ext = path.extname(filePath).toLowerCase();
  
  // Binário
  if (BINARY_EXTENSIONS.has(ext)) {
    return 'binary';
  }
  
  // Código
  if (CODE_EXTENSIONS.has(ext)) {
    if (stats.size > CONFIG.LARGE_FILE_MAX_SIZE) {
      return 'large_code';
    }
    return 'code';
  }
  
  // Configuração
  if (CONFIG_EXTENSIONS.has(ext)) {
    return 'config';
  }
  
  // Lock files
  const baseName = path.basename(filePath);
  if (baseName.includes('lock') || baseName.includes('.min.')) {
    return 'lockfile';
  }
  
  // Outro
  return 'other';
}

/**
 * Conta linhas de um arquivo (de forma eficiente).
 */
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

/**
 * Escaneia recursivamente o diretório do projeto.
 * Retorna lista de arquivos com metadata.
 */
async function scanDirectory(projectPath, ignoreFilter, onProgress) {
  const files = [];
  let processedCount = 0;
  
  async function walkDir(currentPath, relativePath = '') {
    let entries;
    try {
      entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    } catch (err) {
      console.error(`[Scanner] Erro ao ler ${currentPath}:`, err.message);
      return;
    }
    
    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const entryRelative = relativePath ? `${relativePath}/${entry.name}` : entry.name;
      
      // Ignorar
      if (shouldIgnore(fullPath, entryRelative, ignoreFilter)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        await walkDir(fullPath, entryRelative);
      } else if (entry.isFile()) {
        try {
          const stats = await fs.promises.stat(fullPath);
          const category = classifyFile(fullPath, stats);
          
          // Ler conteúdo apenas para arquivos de código pequenos NÃO sensíveis
          let content = null;
          if (category === 'code' && stats.size <= CONFIG.SMALL_FILE_MAX_SIZE) {
            if (isSensitiveFile(fullPath)) {
              // Arquivo sensível: listado na árvore mas conteúdo NUNCA lido
              content = null;
            } else {
              try {
                content = await fs.promises.readFile(fullPath, 'utf-8');
              } catch {
                // Arquivo não pode ser lido como texto
              }
            }
          }
          
          files.push({
            path: fullPath,
            relativePath: entryRelative,
            size: stats.size,
            extension: path.extname(entryRelative).toLowerCase(),
            category,
            content,
            signatures: [] // Preenchido pelo worker
          });
          
          processedCount++;
          if (onProgress && processedCount % 50 === 0) {
            onProgress(processedCount);
          }
        } catch (err) {
          // Pular arquivos com erro de acesso
        }
      }
    }
  }
  
  await walkDir(projectPath);
  return files;
}

/**
 * Cria pool de workers para parsing AST.
 */
function createWorkerPool(poolSize) {
  const workers = [];
  let readyCount = 0;
  let batchCounter = 0;
  const pendingBatches = new Map();
  
  for (let i = 0; i < poolSize; i++) {
    const worker = new Worker(path.join(__dirname, 'repo_scanner_worker.js'));
    
    worker.on('message', (msg) => {
      if (msg.type === 'ready') {
        readyCount++;
      } else if (msg.type === 'result' || msg.type === 'error') {
        const callback = pendingBatches.get(msg.batchId);
        if (callback) {
          pendingBatches.delete(msg.batchId);
          callback(msg);
        }
      }
    });
    
    worker.on('error', (err) => {
      console.error(`[Worker ${i}] Erro:`, err.message);
    });
    
    workers.push({ worker, busy: false });
  }
  
  return {
    /**
     * Processa um lote de arquivos.
     * Retorna Promise com resultados.
     */
    processBatch(files) {
      return new Promise((resolve) => {
        // Encontra worker livre
        const workerIndex = workers.findIndex(w => !w.busy);
        if (workerIndex === -1) {
          // Todos ocupados - fila simples
          setTimeout(() => this.processBatch(files).then(resolve), 10);
          return;
        }
        
        const { worker } = workers[workerIndex];
        workers[workerIndex].busy = true;
        
        const batchId = batchCounter++;
        pendingBatches.set(batchId, (msg) => {
          workers[workerIndex].busy = false;
          resolve(msg);
        });
        
        worker.postMessage({
          type: 'parse',
          batchId,
          files: files.map(f => ({ path: f.path }))
        });
      });
    },
    
    /**
     * Encerra todos os workers.
     */
    async terminate() {
      for (const { worker } of workers) {
        worker.postMessage({ type: 'terminate' });
      }
    }
  };
}

/**
 * Função principal: escaneia projeto e retorna repo_map.
 * 
 * @param {string} projectPath - Caminho raiz do projeto
 * @param {function} onProgress - Callback de progresso (opcional)
 * @returns {Promise<object>} Repo map completo
 */
async function scanProject(projectPath, onProgress) {
  const startTime = Date.now();
  
  // 1. Carregar .gitignore
  const ignoreFilter = loadGitignore(projectPath);
  
  // 2. Escanear árvore de arquivos (rápido, fica no main)
  if (onProgress) onProgress({ stage: 'scanning', count: 0 });
  
  const files = await scanDirectory(projectPath, ignoreFilter, (count) => {
    if (onProgress) onProgress({ stage: 'scanning', count });
  });
  
  // 3. Separar arquivos que precisam de parsing AST
  const codeFiles = files.filter(f => 
    f.category === 'code' && 
    CODE_EXTENSIONS.has(f.extension) &&
    f.size <= CONFIG.LARGE_FILE_MAX_SIZE
  );
  
  // 4. Criar worker pool e processar parsing
  if (codeFiles.length > 0) {
    if (onProgress) onProgress({ stage: 'parsing', count: 0, total: codeFiles.length });
    
    const pool = createWorkerPool(CONFIG.WORKER_POOL_SIZE);
    
    try {
      // Processar em lotes
      for (let i = 0; i < codeFiles.length; i += CONFIG.WORKER_BATCH_SIZE) {
        const batch = codeFiles.slice(i, i + CONFIG.WORKER_BATCH_SIZE);
        const result = await pool.processBatch(batch);
        
        // Aplicar resultados
        if (result.results) {
          for (const fileResult of result.results) {
            const file = files.find(f => f.path === fileResult.path);
            if (file && fileResult.signatures) {
              file.signatures = fileResult.signatures;
            }
          }
        }
        
        if (onProgress) {
          onProgress({ 
            stage: 'parsing', 
            count: Math.min(i + CONFIG.WORKER_BATCH_SIZE, codeFiles.length), 
            total: codeFiles.length 
          });
        }
      }
    } finally {
      await pool.terminate();
    }
  }
  
  // 5. Montar repo map final
  const repoMap = {
    projectPath,
    scannedAt: new Date().toISOString(),
    totalFiles: files.length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
    files: files.map(f => ({
      path: f.path,
      relativePath: f.relativePath,
      size: f.size,
      extension: f.extension,
      category: f.category,
      // Só incluir conteúdo para arquivos pequenos de código
      content: f.category === 'code' && f.size <= CONFIG.SMALL_FILE_MAX_SIZE 
        ? f.content 
        : null,
      // Só incluir assinaturas para arquivos de código
      signatures: CODE_EXTENSIONS.has(f.extension) ? f.signatures : []
    }))
  };
  
  const elapsed = Date.now() - startTime;
  console.log(`[Scanner] ${files.length} arquivos em ${elapsed}ms`);
  
  return repoMap;
}

/**
 * Escaneia um único arquivo (para reindexação incremental).
 * Retorna objeto com metadata + assinaturas.
 */
async function scanSingleFile(filePath, projectPath) {
  try {
    const stats = await fs.promises.stat(filePath);
    const relativePath = path.relative(projectPath, filePath);
    const category = classifyFile(filePath, stats);
    const ext = path.extname(filePath).toLowerCase();
    
    let content = null;
    let signatures = [];
    
    if (category === 'code') {
      // Ler conteúdo
      try {
        content = await fs.promises.readFile(filePath, 'utf-8');
      } catch {
        // Não pôde ler
      }
      
      // Parsing AST via worker (para arquivos não muito grandes)
      if (stats.size <= CONFIG.LARGE_FILE_MAX_SIZE && content) {
        const pool = createWorkerPool(1);
        try {
          const result = await pool.processBatch([{ path: filePath }]);
          if (result.results?.[0]?.signatures) {
            signatures = result.results[0].signatures;
          }
        } finally {
          await pool.terminate();
        }
      }
    }
    
    return {
      path: filePath,
      relativePath,
      size: stats.size,
      extension: ext,
      category,
      content: category === 'code' && stats.size <= CONFIG.SMALL_FILE_MAX_SIZE 
        ? content 
        : null,
      signatures: CODE_EXTENSIONS.has(ext) ? signatures : [],
      success: true
    };
  } catch (err) {
    return {
      path: filePath,
      success: false,
      error: err.message
    };
  }
}

/**
 * Envia repo map para o Python backend indexar.
 * 
 * @param {string} projectId - ID do projeto
 * @param {object} repoMap - Repo map escaneado
 * @returns {Promise<object>} Resultado da indexação
 */
async function sendToIndexer(projectId, repoMap) {
  const KG_BASE = 'http://localhost:8000';
  
  try {
    const response = await fetch(`${KG_BASE}/repo/index`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        project_path: repoMap.projectPath,
        repo_map: repoMap
      })
    });
    
    if (!response.ok) {
      throw new Error(`Indexer returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error('[Scanner] Erro ao enviar para indexer:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Envia arquivo individual para reindexação incremental.
 */
async function sendFileToIndexer(projectId, projectPath, fileData) {
  const KG_BASE = 'http://localhost:8000';
  
  try {
    const response = await fetch(`${KG_BASE}/repo/reindex-file`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        project_path: projectPath,
        file: fileData
      })
    });
    
    if (!response.ok) {
      throw new Error(`Indexer returned ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (err) {
    console.error('[Scanner] Erro ao reindexar arquivo:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  scanProject,
  scanSingleFile,
  sendToIndexer,
  sendFileToIndexer,
  CONFIG
};
