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

  // 1. Localizar pasta
  locateFolder: (folderName) => ipcRenderer.invoke('system:locateFolder', folderName),

  // 2. Criar pasta
  createDir: (dirPath) => ipcRenderer.invoke('system:createDir', dirPath),

  // 3. Criar arquivo
  createFile: (filePath, content, overwrite) => ipcRenderer.invoke('system:createFile', filePath, content, overwrite),

  // 4. Editar arquivo
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

  // Project API
  listProjects: () => ipcRenderer.invoke('project:list'),
  getActiveProject: () => ipcRenderer.invoke('project:getActive'),
  selectProject: (projectId) => ipcRenderer.invoke('project:select', projectId),
  addProject: (dirPath) => ipcRenderer.invoke('project:add', dirPath),
  removeProject: (projectId) => ipcRenderer.invoke('project:remove', projectId),

  // Knowledge Graph API
  knowledgePipeline: (data) => ipcRenderer.invoke('knowledge:pipeline', data),
  knowledgeSearch: (data) => ipcRenderer.invoke('knowledge:search', data),
  knowledgeCreateNode: (data) => ipcRenderer.invoke('knowledge:createNode', data),
  knowledgeStats: () => ipcRenderer.invoke('knowledge:stats'),

  // Repo Map API
  indexRepo: (projectId, projectPath) => ipcRenderer.invoke('repo:index', { projectId, projectPath }),
  getRepoMap: (projectId) => ipcRenderer.invoke('repo:getMap', projectId),
  reindexFile: (projectId, projectPath, filePath) => ipcRenderer.invoke('repo:reindexFile', { projectId, projectPath, filePath }),
  removeFileFromIndex: (projectId, filePath) => ipcRenderer.invoke('repo:removeFile', { projectId, filePath }),
  onRepoIndexProgress: (callback) => ipcRenderer.on('repo:indexProgress', (_, data) => callback(data)),
  removeRepoIndexListener: () => ipcRenderer.removeAllListeners('repo:indexProgress'),

  // Gate de Confirmação
  confirmResponse: (requestId, approved, alwaysAllow, scope) => ipcRenderer.invoke('confirm:response', { requestId, approved, alwaysAllow, scope }),
  getOperationsLog: (opts) => ipcRenderer.invoke('system:getOperationsLog', opts),

  // Eventos de confirmação (main → frontend)
  onConfirmRequest: (callback) => ipcRenderer.on('confirm:request', (_, data) => callback(data)),
  removeConfirmListener: () => ipcRenderer.removeAllListeners('confirm:request'),

  // Activity Trace (tool calls em tempo real)
  onToolStart: (callback) => ipcRenderer.on('agent:tool:start', (_, data) => callback(data)),
  removeToolStartListener: () => ipcRenderer.removeAllListeners('agent:tool:start'),
  onPhaseChange: (callback) => ipcRenderer.on('agent:phase_change', (_, data) => callback(data)),
  removePhaseChangeListener: () => ipcRenderer.removeAllListeners('agent:phase_change'),

  // Regras de Permissão ("Permitir sempre")
  listPermissionRules: (projectId) => ipcRenderer.invoke('permissions:list', projectId),
  addPermissionRule: (projectId, action, scope) => ipcRenderer.invoke('permissions:add', { projectId, action, scope }),
  removePermissionRule: (ruleId) => ipcRenderer.invoke('permissions:remove', ruleId),
  clearPermissionRules: (projectId) => ipcRenderer.invoke('permissions:clear', projectId),
});
