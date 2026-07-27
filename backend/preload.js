const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  
  // Chat
  sendMessage: (message, history, userContext, model) => ipcRenderer.invoke('chat:send', message, history, userContext, model),
  
  // Skills API
  listSkills: () => ipcRenderer.invoke('skills:list'),
  readSkill: (fileName) => ipcRenderer.invoke('skills:read', fileName),
  saveSkill: (fileName, content) => ipcRenderer.invoke('skills:save', fileName, content),
  deleteSkill: (fileName) => ipcRenderer.invoke('skills:delete', fileName),
  importSkills: () => ipcRenderer.invoke('skills:import'),
  
  // System Control API
  execute: (command, cwd) => ipcRenderer.invoke('system:execute', command, cwd),

  // 1. Localizar pasta - resolve nome/caminho para path real do SO
  locateFolder: (folderName) => ipcRenderer.invoke('system:locateFolder', folderName),

  // 2. Criar pasta - cria diretório recursivamente
  createDir: (dirPath) => ipcRenderer.invoke('system:createDir', dirPath),

  // 3. Criar arquivo - cria arquivo, retorna {exists:true} se já existir sem overwrite
  createFile: (filePath, content, overwrite) => ipcRenderer.invoke('system:createFile', filePath, content, overwrite),

  // 4. Editar arquivo - find-and-replace de oldStr por newStr (não sobrescreve inteiro)
  editFile: (filePath, oldStr, newStr) => ipcRenderer.invoke('system:editFile', filePath, oldStr, newStr),

  readFile: (filePath) => ipcRenderer.invoke('system:readFile', filePath),
  deleteFile: (filePath) => ipcRenderer.invoke('system:deleteFile', filePath),
  deleteDir: (dirPath) => ipcRenderer.invoke('system:deleteDir', dirPath),
  listDir: (dirPath) => ipcRenderer.invoke('system:listDir', dirPath),
  getUserInfo: () => ipcRenderer.invoke('system:getUserInfo'),
  openPath: (filePath) => ipcRenderer.invoke('system:openPath', filePath),

  // Memory API
  listMemories: () => ipcRenderer.invoke('memory:list'),
  createMemory: (memory) => ipcRenderer.invoke('memory:create', memory),
  updateMemory: (id, updates) => ipcRenderer.invoke('memory:update', id, updates),
  deleteMemory: (id) => ipcRenderer.invoke('memory:delete', id),
  getMemorySettings: () => ipcRenderer.invoke('memory:getSettings'),
  saveMemorySettings: (settings) => ipcRenderer.invoke('memory:saveSettings', settings),

  // Knowledge Graph API
  knowledgePipeline: (data) => ipcRenderer.invoke('knowledge:pipeline', data),
  knowledgeSearch: (data) => ipcRenderer.invoke('knowledge:search', data),
  knowledgeCreateNode: (data) => ipcRenderer.invoke('knowledge:createNode', data),
  knowledgeStats: () => ipcRenderer.invoke('knowledge:stats'),
});
