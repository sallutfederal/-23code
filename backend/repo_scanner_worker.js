/**
 * repo_scanner_worker.js — Worker thread para parsing AST de JS/TS.
 * 
 * Executa @babel/parser em background thread para não bloquear o
 * main process do Electron durante indexação de projetos grandes.
 * 
 * Recebe lotes de arquivos via postMessage, retorna assinaturas.
 */

const { parentPort } = require('worker_threads');
const fs = require('fs');
const path = require('path');

let parser = null;

/**
 * Carrega @babel/parser de forma lazy (só quando necessário).
 */
function getParser() {
  if (!parser) {
    try {
      parser = require('@babel/parser');
    } catch (err) {
      console.error('[@babel/parser] Não encontrado. Instale com: npm install @babel/parser');
      throw err;
    }
  }
  return parser;
}

/**
 * Extrai assinaturas de um arquivo JS/TS usando AST.
 * Retorna array de { name, type, line, params, exported }
 */
function extractSignatures(filePath, content) {
  const signatures = [];
  
  try {
    const babel = getParser();
    
    // Detecta se é TypeScript/JSX pelo conteúdo
    const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx');
    const isJSX = filePath.endsWith('.jsx') || filePath.endsWith('.tsx');
    
    const ast = babel.parse(content, {
      sourceType: 'module',
      plugins: [
        'jsx',
        isTS ? 'typescript' : null,
        'decorators-legacy',
        'classProperties',
        'classPrivateProperties',
        'classPrivateMethods',
        'exportDefaultFrom',
        'exportNamespaceFrom',
        'optionalChaining',
        'nullishCoalescingOperator',
        'dynamicImport',
        'optionalCatchBinding',
        'objectRestSpread',
        'numericSeparator',
        'bigInt',
      ].filter(Boolean)
    });

    const traverse = require('@babel/traverse').default || require('@babel/traverse');
    
    traverse(ast, {
      // Funções: function declarations e function expressions
      FunctionDeclaration(path) {
        const node = path.node;
        signatures.push({
          name: node.id?.name || 'anonymous',
          type: 'function',
          line: node.loc?.start.line || 0,
          params: (node.params || []).map(p => p.name || p.argument?.name || 'param'),
          exported: false
        });
      },
      
      // Arrow functions e funções anônimas atribuídas
      VariableDeclarator(path) {
        const init = path.node.init;
        const name = path.node.id?.name;
        if (!name) return;
        
        if (init?.type === 'ArrowFunctionExpression' || 
            init?.type === 'FunctionExpression') {
          signatures.push({
            name,
            type: 'function',
            line: path.node.loc?.start.line || 0,
            params: (init.params || []).map(p => p.name || p.argument?.name || 'param'),
            exported: false
          });
        }
      },
      
      // Classes
      ClassDeclaration(path) {
        const node = path.node;
        signatures.push({
          name: node.id?.name || 'AnonymousClass',
          type: 'class',
          line: node.loc?.start.line || 0,
          params: [],
          exported: false
        });
      },
      
      // Export named: export function foo() {}
      ExportNamedDeclaration(path) {
        const decl = path.node.declaration;
        if (!decl) return;
        
        if (decl.type === 'FunctionDeclaration') {
          const existing = signatures.find(
            s => s.name === decl.id?.name && s.line === decl.loc?.start.line
          );
          if (existing) {
            existing.exported = true;
          } else {
            signatures.push({
              name: decl.id?.name || 'anonymous',
              type: 'function',
              line: decl.loc?.start.line || 0,
              params: (decl.params || []).map(p => p.name || p.argument?.name || 'param'),
              exported: true
            });
          }
        } else if (decl.type === 'ClassDeclaration') {
          const existing = signatures.find(
            s => s.name === decl.id?.name && s.line === decl.loc?.start.line
          );
          if (existing) {
            existing.exported = true;
          } else {
            signatures.push({
              name: decl.id?.name || 'AnonymousClass',
              type: 'class',
              line: decl.loc?.start.line || 0,
              params: [],
              exported: true
            });
          }
        } else if (decl.type === 'VariableDeclaration') {
          // export const foo = () => {}
          for (const declarator of decl.declarators) {
            const init = declarator.init;
            const name = declarator.id?.name;
            if (!name) continue;
            
            if (init?.type === 'ArrowFunctionExpression' || 
                init?.type === 'FunctionExpression') {
              signatures.push({
                name,
                type: 'function',
                line: declarator.loc?.start.line || 0,
                params: (init.params || []).map(p => p.name || p.argument?.name || 'param'),
                exported: true
              });
            } else {
              signatures.push({
                name,
                type: 'variable',
                line: declarator.loc?.start.line || 0,
                params: [],
                exported: true
              });
            }
          }
        }
      },
      
      // Export default
      ExportDefaultDeclaration(path) {
        const decl = path.node.declaration;
        if (!decl) return;
        
        let name = 'default';
        let type = 'unknown';
        let line = decl.loc?.start.line || 0;
        
        if (decl.type === 'FunctionDeclaration' || 
            decl.type === 'FunctionExpression' ||
            decl.type === 'ArrowFunctionExpression') {
          name = decl.id?.name || 'default';
          type = 'function';
        } else if (decl.type === 'ClassDeclaration') {
          name = decl.id?.name || 'default';
          type = 'class';
        }
        
        signatures.push({
          name,
          type,
          line,
          params: [],
          exported: true
        });
      }
    });
    
  } catch (err) {
    // Se falhar o parsing, retorna array vazio (não trava)
    console.error(`[AST] Erro ao parsear ${filePath}:`, err.message);
  }
  
  return signatures;
}

/**
 * Processa um lote de arquivos.
 * Recebe: { files: [{ path, content }] }
 * Retorna: { results: [{ path, signatures }] }
 */
function processBatch(files) {
  const results = [];
  
  for (const file of files) {
    try {
      const content = fs.readFileSync(file.path, 'utf-8');
      const signatures = extractSignatures(file.path, content);
      results.push({
        path: file.path,
        signatures,
        success: true
      });
    } catch (err) {
      results.push({
        path: file.path,
        signatures: [],
        success: false,
        error: err.message
      });
    }
  }
  
  return results;
}

// Escuta mensagens do main thread
parentPort.on('message', (message) => {
  const { type, batchId, files } = message;
  
  if (type === 'parse') {
    try {
      const results = processBatch(files);
      parentPort.postMessage({
        type: 'result',
        batchId,
        results
      });
    } catch (err) {
      parentPort.postMessage({
        type: 'error',
        batchId,
        error: err.message
      });
    }
  } else if (type === 'terminate') {
    process.exit(0);
  }
});

// Sinaliza que está pronto
parentPort.postMessage({ type: 'ready' });
