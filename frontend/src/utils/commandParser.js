function extractLocationAndName(text, entityType) {
  const locationPatterns = [
    /(?:dentro\s+de|em|na\s+pasta|no|inside\s+of|in)\s+(?:uma?\s+)?(?:pasta\s+)?([^\s,]+)/i,
  ];
  
  let location = null;
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) {
      location = match[1];
      break;
    }
  }

  let name = null;
  const stopWords = '(?:\\s+e\\s+|\\s+dentro\\s+de\\s+|\\s+em\\s+|\\s+na\\s+pasta\\s+|\\s+no\\s+|\\s+com\\s+|\\s+para\\s+|\\s+substitu(?:indo|ir)\\s+|$)';
  
  const nameWithLocation = text.match(new RegExp(`(?:chamad[ao]|nomead[ao]|chamada?)\\s+["']?([^"']+?)["']?\\s+(?:dentro|em|na\\s+pasta|no)`, 'i'));
  if (nameWithLocation) {
    name = nameWithLocation[1].trim();
  } else {
    const nameOnly = text.match(new RegExp(`(?:crie?|criar|nova?)\\s+(?:uma?\\s+)?${entityType}\\s+(?:chamad[ao]\\s+)?["']?([^"']+?)["']?\\s*${stopWords}`, 'i'));
    if (nameOnly) {
      name = nameOnly[1].trim();
    }
  }

  return { location, name };
}

const COMMAND_PATTERNS = {
  createDir: [
    /crie?\s+(?:uma?\s+)?(?:pasta|diret[oó]rio)\s+(?:chamada?\s+)?["']?([^"',]+)["']?/i,
    /crie?\s+(?:uma?\s+)?pasta\s+["']?([^"',]+)["']?/i,
    /mkdir\s+["']?([^"',]+)["']?/i,
    /nova\s+pasta\s+["']?([^"',]+)["']?/i,
    /criar\s+pasta\s+["']?([^"',]+)["']?/i,
    /criar\s+diret[oó]rio\s+["']?([^"',]+)["']?/i,
  ],
  createFile: [
    /crie?\s+(?:um\s+)?(?:arquivo|file)\s+["']?([^"',]+)["']?\s+com\s+(?:o\s+)?(?:conte[uú]do|texto)\s+["']([^"']+)["']/i,
    /crie?\s+(?:um\s+)?(?:arquivo|file)?\s*["']?([^\s"',]+\.[a-z0-9]+)["']?/i,
    /criar\s+(?:um\s+)?(?:arquivo|file)?\s*["']?([^\s"',]+\.[a-z0-9]+)["']?/i,
    /novo\s+(?:um\s+)?(?:arquivo|file)?\s*["']?([^\s"',]+\.[a-z0-9]+)["']?/i,
    /touch\s+["']?([^"',]+)["']?/i,
  ],
  readFile: [
    /leia?\s+(?:o\s+)?(?:arquivo|file)\s+["']?([^"']+)["']?/i,
    /abra\s+(?:o\s+)?(?:arquivo|file)\s+["']?([^"']+)["']?/i,
    /mostr(?:e|ar)\s+(?:o\s+)?(?:conte[uú]do\s+do\s+)?(?:arquivo|file)\s+["']?([^"']+)["']?/i,
    /cat\s+["']?([^"']+)["']?/i,
    /ler\s+arquivo\s+["']?([^"']+)["']?/i,
  ],
  editFile: [
    /edite?\s+(?:o\s+)?(?:arquivo|file)\s+["']?([^"']+)["']?\s+substitu(?:indo|ir)\s+["']([^"']+)["']\s+por\s+["']([^"']+)["']/i,
    /altere?\s+(?:o\s+)?(?:arquivo|file)\s+["']?([^"']+)["']?\s+substitu(?:indo|ir)\s+["']([^"']+)["']\s+por\s+["']([^"']+)["']/i,
    /edite?\s+(?:o\s+)?(?:arquivo|file)\s+["']?([^"']+)["']?\s+de\s+["']([^"']+)["']\s+para\s+["']([^"']+)["']/i,
    /mude\s+(?:o\s+)?(?:arquivo|file)\s+["']?([^"']+)["']?\s+de\s+["']([^"']+)["']\s+para\s+["']([^"']+)["']/i,
    /edite?\s+(?:o\s+)?(?:arquivo|file)\s+["']?([^"']+)["']?\s+com\s+["']([^"']+)["']/i,
    /altere?\s+(?:o\s+)?(?:arquivo|file)\s+["']?([^"']+)["']?\s+para\s+["']([^"']+)["']/i,
    /mude\s+(?:o\s+)?(?:arquivo|file)\s+["']?([^"']+)["']?\s+para\s+["']([^"']+)["']/i,
    /editar\s+arquivo\s+["']?([^"']+)["']?/i,
  ],
  deleteFile: [
    /exclu(?:a|ir)\s+(?:o\s+)?(?:arquivo|file)\s+["']?([^"']+)["']?/i,
    /remov(?:a|er)\s+(?:o\s+)?(?:arquivo|file)\s+["']?([^"']+)["']?/i,
    /delete\s+["']?([^"']+)["']?/i,
    /rm\s+["']?([^"']+)["']?/i,
  ],
  deleteDir: [
    /exclu(?:a|ir)\s+(?:a\s+)?(?:pasta|diret[oó]rio)\s+["']?([^"']+)["']?/i,
    /remov(?:a|er)\s+(?:a\s+)?(?:pasta|diret[oó]rio)\s+["']?([^"']+)["']?/i,
    /rm\s+-rf\s+["']?([^"']+)["']?/i,
  ],
  listDir: [
    /list(?:e|ar)\s+(?:o\s+)?(?:diret[oó]rio|pasta|arquivos)\s+["']?([^"']*)["']?/i,
    /most(?:r|re)\s+(?:o\s+)?(?:conte[uú]do\s+do\s+)?(?:diret[oó]rio|pasta)\s+["']?([^"']*)["']?/i,
    /ls\s+["']?([^"']*)["']?/i,
    /dir\s+["']?([^"']*)["']?/i,
    /quais\s+(?:s[aã]o\s+)?(?:os\s+)?arquivos\s+(?:em|na|no)\s+["']?([^"']+)["']?/i,
  ],
  execute: [
    /execute?\s+(?:o\s+)?(?:comando|command)\s+["']([^"']+)["']/i,
    /rode?\s+["']([^"']+)["']/i,
    /\srode\s+([^"']+)/i,
    /execute\s+([^"']+)/i,
    /\$\s+([^"']+)/i,
  ],
  openPath: [
    /abra\s+(?:a\s+)?(?:pasta|diret[oó]rio)\s+["']?([^"']+)["']?/i,
    /abra\s+["']?([^"']+)["']?/i,
    /abrir\s+["']?([^"']+)["']?/i,
  ],
  locateFolder: [
    /localiz(?:e|ar)\s+(?:a\s+)?(?:pasta|diret[oó]rio)\s+["']?([^"']+)["']?/i,
    /onde\s+(?:est[aá]|fica)\s+(?:a\s+)?(?:pasta|diret[oó]rio)\s+["']?([^"']+)["']?/i,
    /resolve(?:r)?\s+(?:o\s+)?(?:caminho|path)\s+(?:da\s+)?(?:pasta|diret[oó]rio)\s+["']?([^"']+)["']?/i,
  ],
};

function matchSingleCommand(text) {
  const trimmed = text.trim();
  for (const [action, patterns] of Object.entries(COMMAND_PATTERNS)) {
    for (const pattern of patterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const args = match.slice(1).map(arg => arg?.trim()).filter(Boolean);
        
        if (action === 'createFile' && args[0]) {
          const extMatch = args[0].match(/^([^\s]+\.[a-z0-9]+)/i);
          if (extMatch) {
            args[0] = extMatch[1];
          }
        }
        
        return { action, args };
      }
    }
  }
  return null;
}

// Divide mensagem composta: "criar pasta X e criar arquivo Y e ler arquivo Z"
function splitCompoundMessage(message) {
  const results = [];
  const words = message.split(/\s+/);
  let current = '';
  let i = 0;
  
  while (i < words.length) {
    const word = words[i].toLowerCase();
    
    // Palavras que iniciam novo comando
    const startsNewCommand = (
      (word === 'e' && i + 1 < words.length) ||
      word.startsWith('cri') ||
      word.startsWith('mkdir') ||
      word.startsWith('novo') ||
      word.startsWith('touch') ||
      word.startsWith('leia') ||
      word.startsWith('ler') ||
      word.startsWith('abra') ||
      word.startsWith('mostr') ||
      word.startsWith('cat') ||
      word.startsWith('edite') ||
      word.startsWith('altere') ||
      word.startsWith('mude') ||
      word.startsWith('exclu') ||
      word.startsWith('remov') ||
      word.startsWith('delete') ||
      word.startsWith('rm') ||
      word.startsWith('list') ||
      word.startsWith('localiz') ||
      word.startsWith('onde') ||
      word.startsWith('resolv') ||
      word.startsWith('execute') ||
      word.startsWith('rode')
    );
    
    if (word === 'e' && current.trim()) {
      results.push(current.trim());
      current = '';
      i++;
    } else if (startsNewCommand && current.trim() && i > 0) {
      // Verifica se a palavra atual + anterior formam "dentro de", "em", etc.
      const prev = words[i - 1]?.toLowerCase();
      const isLocationPhrase = ['dentro', 'em', 'na', 'no', 'inside', 'in'].includes(prev) ||
        (prev === 'de' && ['dentro'].includes(words[i - 2]?.toLowerCase()));
      
      if (isLocationPhrase) {
        current += ' ' + words[i];
        i++;
      } else {
        results.push(current.trim());
        current = words[i];
        i++;
      }
    } else {
      current += (current ? ' ' : '') + words[i];
      i++;
    }
  }
  
  if (current.trim()) {
    results.push(current.trim());
  }
  
  return results;
}

export async function parseCommand(message) {
  const single = matchSingleCommand(message);
  if (single) {
    await resolveLocation(single, message);
    return [single];
  }

  const parts = splitCompoundMessage(message);
  if (parts.length > 1) {
    const commands = [];
    for (const part of parts) {
      const cmd = matchSingleCommand(part);
      if (cmd) {
        await resolveLocation(cmd, part);
        commands.push(cmd);
      }
    }
    if (commands.length > 0) return commands;
  }

  return null;
}

async function resolveLocation(command, text) {
  const { action, args } = command;
  if (['createDir', 'createFile', 'deleteDir'].includes(action) && args.length > 0) {
    const entityType = action === 'createDir' || action === 'deleteDir' ? 'pasta' : 'arquivo';
    const { location, name } = extractLocationAndName(text, entityType);
    
    if (name) {
      args[0] = name;
    }
    
    if (location) {
      try {
        const resolved = await window.electronAPI.locateFolder(location);
        if (resolved.success) {
          args[0] = `${resolved.data}\\${args[0]}`;
        }
      } catch {
        // Se falhar, mantém o path original
      }
    }
  }
}

export async function executeCommand(command) {
  if (!window.electronAPI) {
    return { success: false, error: 'Electron API não disponível' };
  }

  const { action, args } = command;

  try {
    switch (action) {
      case 'createDir':
        await window.electronAPI.createDir(args[0]);
        return { success: true, message: `Pasta "${args[0]}" criada com sucesso!` };

      case 'createFile':
        await window.electronAPI.createFile(args[0], args[1] || '');
        return { success: true, message: `Arquivo "${args[0]}" criado com sucesso!` };

      case 'readFile': {
        const result = await window.electronAPI.readFile(args[0]);
        if (result.success) {
          return { success: true, message: `Conteúdo de "${args[0]}":\n\n${result.data}` };
        }
        return { success: false, error: result.error };
      }

      case 'editFile': {
        if (args.length >= 3) {
          const result = await window.electronAPI.editFile(args[0], args[1], args[2]);
          if (result.success) {
            return { success: true, message: `Arquivo "${args[0]}" editado com sucesso! (${result.data.occurrences} ocorrência(s) trocada(s))` };
          }
          return { success: false, error: result.error };
        }
        const result = await window.electronAPI.createFile(args[0], args[1] || '', true);
        if (result.success) {
          return { success: true, message: `Arquivo "${args[0]}" reescrito com sucesso!` };
        }
        return { success: false, error: result.error };
      }

      case 'deleteFile':
        await window.electronAPI.deleteFile(args[0]);
        return { success: true, message: `Arquivo "${args[0]}" excluído com sucesso!` };

      case 'deleteDir':
        await window.electronAPI.deleteDir(args[0]);
        return { success: true, message: `Pasta "${args[0]}" excluída com sucesso!` };

      case 'listDir': {
        const dirPath = args[0] || (await window.electronAPI.getUserInfo()).data.home;
        const result = await window.electronAPI.listDir(dirPath);
        if (result.success) {
          const items = result.data.map(item => {
            const type = item.isDirectory ? '📁' : '📄';
            const size = item.size ? ` (${formatSize(item.size)})` : '';
            return `${type} ${item.name}${size}`;
          }).join('\n');
          return { success: true, message: `Conteúdo de "${dirPath}":\n\n${items || 'Pasta vazia'}` };
        }
        return { success: false, error: result.error };
      }

      case 'execute': {
        const result = await window.electronAPI.execute(args[0]);
        if (result.success) {
          const output = result.data.stdout || result.data.stderr || 'Comando executado';
          return { success: true, message: `Resultado:\n\n${output}` };
        }
        return { success: false, error: result.error };
      }

      case 'openPath':
        await window.electronAPI.openPath(args[0]);
        return { success: true, message: `Abrindo "${args[0]}"...` };

      case 'locateFolder': {
        const result = await window.electronAPI.locateFolder(args[0]);
        if (result.success) {
          return { success: true, message: `Pasta "${args[0]}" resolvida para:\n${result.data}` };
        }
        return { success: false, error: result.error };
      }

      default:
        return { success: false, error: 'Comando não reconhecido' };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function formatSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function getCommandSuggestions() {
  return [
    { label: 'Localizar pasta', example: 'localizar pasta Downloads' },
    { label: 'Criar pasta', example: 'criar pasta Projetos' },
    { label: 'Criar pasta em local', example: 'dentro de Downloads criar pasta MeuProjeto' },
    { label: 'Criar arquivo', example: 'criar arquivo index.html' },
    { label: 'Criar pasta + arquivo', example: 'dentro de Downloads criar pasta MeuProjeto e criar arquivo index.html' },
    { label: 'Editar arquivo (find-replace)', example: "editar arquivo X substituindo 'old' por 'new'" },
    { label: 'Listar arquivos', example: 'listar arquivos' },
    { label: 'Ler arquivo', example: 'ler arquivo package.json' },
    { label: 'Executar comando', example: 'executar comando "npm install"' },
  ];
}
