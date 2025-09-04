// Jotai atoms for session state management following Forest's patterns
import { atom } from 'jotai'
import { SessionVM } from '@agent-browser/schema'

// Current session state
export const currentSessionIdAtom = atom<string | null>(null)

// Session view models store
export const sessionViewModelsAtom = atom<Record<string, SessionVM>>({})

// Derived atom for current session VM
export const currentSessionVMAtom = atom(
  (get) => {
    const sessionId = get(currentSessionIdAtom)
    const viewModels = get(sessionViewModelsAtom)
    return sessionId ? viewModels[sessionId] : null
  }
)

// UI state atoms
export const isCreatingSessionAtom = atom<boolean>(false)
export const createSessionErrorAtom = atom<string | null>(null)

// WebSocket connection state
export const webSocketConnectedAtom = atom<boolean>(false)
export const webSocketErrorAtom = atom<string | null>(null)