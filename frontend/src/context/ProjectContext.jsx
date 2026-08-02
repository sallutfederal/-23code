import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const ProjectContext = createContext()

/**
 * ProjectContext — Gerencia projetos vinculados à sessão.
 * 
 * Estados:
 * - projects: lista de projetos salvos
 * - activeProject: projeto atualmente selecionado (ou null)
 * - loading: true durante operações assíncronas (adição de projeto)
 * - repoMap: repo map do projeto ativo (para contexto do agente)
 * - indexingProgress: progresso da indexação inicial
 * 
 * Persistência: via IPC para projects.json no userData do Electron
 */
export function ProjectProvider({ children }) {
  const [projects, setProjects] = useState([])
  const [activeProject, setActiveProject] = useState(null)
  const [loading, setLoading] = useState(false)
  const [repoMap, setRepoMap] = useState(null)
  const [indexingProgress, setIndexingProgress] = useState(null)

  // Escuta progresso da indexação
  useEffect(() => {
    if (!window.electronAPI?.onRepoIndexProgress) return

    const handler = (data) => {
      setIndexingProgress(data)
    }

    window.electronAPI.onRepoIndexProgress(handler)

    return () => {
      window.electronAPI.removeRepoIndexListener()
    }
  }, [])

  // Carrega projetos salvos e o ativo ao montar
  useEffect(() => {
    const init = async () => {
      if (!window.electronAPI?.listProjects) return

      try {
        const result = await window.electronAPI.listProjects()
        if (result.success) {
          setProjects(result.data)
        }
      } catch (err) {
        console.error('Erro ao carregar projetos:', err)
      }

      try {
        const active = await window.electronAPI.getActiveProject()
        if (active.success && active.data) {
          setActiveProject(active.data)
          // Carregar repo map do projeto ativo
          loadRepoMap(active.data.id)
        }
      } catch (err) {
        console.error('Erro ao carregar projeto ativo:', err)
      }
    }

    init()
  }, [])

  /**
   * Carrega repo map de um projeto.
   * Tenta múltiplas vezes caso o arquivo ainda esteja sendo criado.
   */
  const loadRepoMap = useCallback(async (projectId, retries = 5, delay = 1000) => {
    if (!window.electronAPI?.getRepoMap) {
      console.log('[ProjectContext] getRepoMap API não disponível')
      setRepoMap(null)
      return
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[ProjectContext] Carregando repo map (tentativa ${attempt}/${retries}) para projeto:`, projectId)
        const result = await window.electronAPI.getRepoMap(projectId)
        
        if (result.success && result.data) {
          console.log('[ProjectContext] Repo map carregado:', result.data?.files?.length || 0, 'arquivos')
          setRepoMap(result.data)
          return // Sucesso, não precisa tentar mais
        }
        
        // Se não encontrou e ainda tem tentativas, esperar
        if (attempt < retries) {
          console.log(`[ProjectContext] Repo map não encontrado, aguardando ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      } catch (err) {
        console.error('Erro ao carregar repo map:', err)
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    // Todas as tentativas falharam
    console.log('[ProjectContext] Repo map não disponível após', retries, 'tentativas')
    setRepoMap(null)
  }, [])

  /**
   * Seleciona um projeto como ativo.
   * Salva no backend e atualiza o estado local.
   */
  const selectProject = useCallback(async (project) => {
    if (!window.electronAPI?.selectProject) return

    try {
      const result = await window.electronAPI.selectProject(project.id)
      if (result.success) {
        setActiveProject(project)
        // Carregar repo map do novo projeto
        await loadRepoMap(project.id)
      }
    } catch (err) {
      console.error('Erro ao selecionar projeto:', err)
    }
  }, [loadRepoMap])

  /**
   * Desvincula o projeto ativo da sessão.
   */
  const clearProject = useCallback(async () => {
    if (!window.electronAPI?.selectProject) return

    try {
      await window.electronAPI.selectProject(null)
      setActiveProject(null)
      setRepoMap(null)
    } catch (err) {
      console.error('Erro ao limpar projeto:', err)
    }
  }, [])

  /**
   * Dispara indexação completa do projeto.
   */
  const indexProject = useCallback(async (projectId, projectPath) => {
    if (!window.electronAPI?.indexRepo) return null

    setIndexingProgress({ stage: 'starting', count: 0 })
    
    try {
      const result = await window.electronAPI.indexRepo(projectId, projectPath)
      
      if (result.success) {
        // Recarregar repo map após indexação
        await loadRepoMap(projectId)
        setIndexingProgress(null)
        return result.data
      }
      
      throw new Error(result.error || 'Erro na indexação')
    } catch (err) {
      console.error('Erro ao indexar projeto:', err)
      setIndexingProgress(null)
      throw err
    }
  }, [loadRepoMap])

  /**
   * Adiciona um projeto novo a partir de um diretório.
   * 
   * Fluxo:
   * 1. Se dirPath fornecido, usa direto (chamado pelo frontend após dialog)
   * 2. Se não, abre o dialog nativo do SO
   * 3. Valida que o path existe e é acessível
   * 4. Escaneia estrutura se tiver conteúdo
   * 5. Salva registro no backend
   * 6. Dispara indexação em background
   * 7. Retorna o projeto criado
   */
  const addProject = useCallback(async (dirPath = null) => {
    if (!window.electronAPI?.addProject) return null

    setLoading(true)
    try {
      const result = await window.electronAPI.addProject(dirPath)
      
      if (result.success && result.data) {
        // Atualiza a lista de projetos
        setProjects(prev => {
          const exists = prev.some(p => p.id === result.data.id)
          if (exists) {
            return prev.map(p => p.id === result.data.id ? result.data : p)
          }
          return [...prev, result.data]
        })

        // Define como ativo
        setActiveProject(result.data)

        // Dispara indexação em background (não bloqueia)
        if (!result.alreadyExists) {
          indexProject(result.data.id, result.data.path)
            .then(() => {
              // Após indexação completa, carregar o repo map
              loadRepoMap(result.data.id)
            })
            .catch(err => {
              console.log('Indexação em background:', err.message)
              // Mesmo com erro, tentar carregar (pode ter parcial)
              setTimeout(() => loadRepoMap(result.data.id), 2000)
            })
        } else {
          // Se já existe, tenta carregar repo map
          await loadRepoMap(result.data.id)
        }

        return result.data
      }

      if (result.canceled) return null
      
      throw new Error(result.error || 'Erro ao adicionar projeto')
    } catch (err) {
      console.error('Erro ao adicionar projeto:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }, [indexProject, loadRepoMap])

  return (
    <ProjectContext.Provider value={{
      projects,
      activeProject,
      loading,
      repoMap,
      indexingProgress,
      selectProject,
      clearProject,
      addProject,
      indexProject,
      loadRepoMap
    }}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProject must be used within ProjectProvider')
  }
  return context
}
