import { useRef, useEffect, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { useCode } from '../../context/CodeContext'
import { useUser } from '../../context/UserContext'

/**
 * MonacoEditor — wrapper do Monaco Editor com integração ao CodeContext.
 *
 * Funcionalidades:
 * - Detecção automática de linguagem pela extensão
 * - Tema dark/light sincronizado com o app
 * - Ctrl+S / Cmd+S para salvar
 * - onChange atualiza o buffer de edição (dirty tracking)
 * - Cleanup ao desmontar
 */
export default function MonacoEditor({ tab }) {
  const editorRef = useRef(null)
  const { updateEditedContent, saveFile } = useCode()
  const { theme } = useUser()
  const isDark = theme === 'dark'

  // Salvar com Ctrl+S / Cmd+S
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault()
      if (tab?.path && tab?.dirty) {
        saveFile(tab.path)
      }
    }
  }, [tab?.path, tab?.dirty, saveFile])

  // Registrar listener de teclado no mount
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Callback quando o conteúdo muda no editor
  const handleChange = useCallback((value) => {
    if (tab?.path && value !== undefined) {
      updateEditedContent(tab.path, value)
    }
  }, [tab?.path, updateEditedContent])

  // Callback quando o editor é montado
  const handleEditorDidMount = useCallback((editor, monaco) => {
    editorRef.current = editor

    // Focar o editor automaticamente
    editor.focus()
  }, [])

  // Cleanup ao desmontar ou quando a tab muda
  useEffect(() => {
    return () => {
      if (editorRef.current) {
        // Monaco não precisa de dispose explícito quando o componente desmonta
        // mas limpamos a referência para evitar memory leaks
        editorRef.current = null
      }
    }
  }, [])

  if (!tab) return null

  // Conteúdo: usa editedContent se existir (buffer de edição), senão content (disco)
  const value = tab.editedContent ?? tab.content ?? ''

  return (
    <div className="h-full w-full">
      <Editor
        language={tab.language || 'plaintext'}
        theme={isDark ? 'vs-dark' : 'vs'}
        value={value}
        onChange={handleChange}
        onMount={handleEditorDidMount}
        loading={
          <div className="flex items-center justify-center h-full">
            <div className="thinking-dots">
              <div className="thinking-dot" style={{ animationDelay: '0s' }}/>
              <div className="thinking-dot" style={{ animationDelay: '0.2s' }}/>
              <div className="thinking-dot" style={{ animationDelay: '0.4s' }}/>
            </div>
          </div>
        }
        options={{
          // Configurações gerais
          fontSize: 13,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
          lineHeight: 20,
          padding: { top: 8 },

          // Scroll
          scrollBeyondLastLine: false,
          smoothScrolling: true,
          mouseWheelScrollSensitivity: 1,

          // Edição
          wordWrap: 'on',
          minimap: { enabled: false },
          renderLineHighlight: 'line',
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',

          // Indentação
          autoIndent: 'advanced',
          tabSize: 2,
          detectIndentation: true,

          // Autocomplete
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,

          // Undo/Redo
          undoRedoStackOverflow: 100,

          // Atalhos
          folding: true,
          glyphMargin: false,
          lineNumbersMinChars: 4,

          // Read-only se muito grande
          readOnly: tab.tooLarge,
        }}
      />
    </div>
  )
}
