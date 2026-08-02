import { useEffect } from 'react'
import { useCode } from '../context/CodeContext'

/**
 * Hook that listens for IPC file change events from the backend
 * and triggers the debounced notifyFileChanged/notifyFileDeleted in CodeContext.
 *
 * This connects the backend's agent file edits to the frontend's
 * real-time editor tab updates (with 400ms debounce grouping).
 */
export function useFileWatcher() {
  const { notifyFileChanged, notifyFileDeleted } = useCode()

  useEffect(() => {
    if (!window.electronAPI?.onFileChanged) return

    const handleFileChanged = (data) => {
      if (data?.path) {
        notifyFileChanged(data.path)
      }
    }

    const handleFileDeleted = (data) => {
      if (data?.path) {
        notifyFileDeleted(data.path)
      }
    }

    window.electronAPI.onFileChanged(handleFileChanged)
    window.electronAPI.onFileDeleted(handleFileDeleted)

    return () => {
      window.electronAPI.removeFileChangedListener()
      window.electronAPI.removeFileDeletedListener()
    }
  }, [notifyFileChanged, notifyFileDeleted])
}
