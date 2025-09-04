// View Models for reactive UI updates following Forest's MVVM pattern
import { atom, PrimitiveAtom, WritableAtom, SetStateAction, Atom } from 'jotai'
import { SessionM, SessionStatus, ImplementationPlan, SearchPlan, ApiSpec, ToolSpec, ExecutionResult } from './models'

// SessionVM for reactive UI updates
export class SessionVM {
    sessionM: SessionM
    sessionId: string
    
    // Reactive atoms for UI binding - these will be created as derived atoms
    statusAtom: Atom<SessionStatus>
    requirementAtom: Atom<string>
    implementationPlanAtom: Atom<ImplementationPlan | null>
    searchPlanAtom: Atom<SearchPlan | null>
    apiSpecsAtom: Atom<ApiSpec[]>
    toolsAtom: Atom<ToolSpec[]>
    resultsAtom: Atom<ExecutionResult[]>
    
    // Progress tracking
    progressAtom: Atom<number>
    currentStepAtom: Atom<string>
    
    constructor(sessionM: SessionM, sessionId: string, sessionViewModelsAtom: WritableAtom<Record<string, SessionVM>, [SetStateAction<Record<string, SessionVM>>], void>) {
        this.sessionM = sessionM
        this.sessionId = sessionId
        
        // Create derived atoms that read from the sessionViewModelsAtom
        this.statusAtom = atom(
            (get) => {
                const viewModels = get(sessionViewModelsAtom)
                return viewModels[sessionId]?.sessionM.status ?? SessionStatus.PENDING
            }
        )
        
        this.requirementAtom = atom(
            (get) => {
                const viewModels = get(sessionViewModelsAtom)
                return viewModels[sessionId]?.sessionM.requirement ?? ''
            }
        )
        
        this.implementationPlanAtom = atom(
            (get) => {
                const viewModels = get(sessionViewModelsAtom)
                return viewModels[sessionId]?.sessionM.implementationPlan ?? null
            }
        )
        
        this.searchPlanAtom = atom(
            (get) => {
                const viewModels = get(sessionViewModelsAtom)
                return viewModels[sessionId]?.sessionM.searchPlan ?? null
            }
        )
        
        this.apiSpecsAtom = atom(
            (get) => {
                const viewModels = get(sessionViewModelsAtom)
                return viewModels[sessionId]?.sessionM.apiSpecs ?? []
            }
        )
        
        this.toolsAtom = atom(
            (get) => {
                const viewModels = get(sessionViewModelsAtom)
                return viewModels[sessionId]?.sessionM.tools ?? []
            }
        )
        
        this.resultsAtom = atom(
            (get) => {
                const viewModels = get(sessionViewModelsAtom)
                return viewModels[sessionId]?.sessionM.results ?? []
            }
        )
        
        this.progressAtom = atom(
            (get) => {
                const status = get(this.statusAtom)
                return this.calculateProgress(status)
            }
        )
        
        this.currentStepAtom = atom(
            (get) => {
                const status = get(this.statusAtom)
                return this.getStatusDescription(status)
            }
        )
    }
    
    // Real-time updates via WebSocket - these methods update the internal model only
    // The UI updates will be triggered by updating the sessionViewModelsAtom
    onStatusUpdate(status: SessionStatus) {
        this.sessionM.status = status
    }
    
    onImplementationPlanUpdate(plan: ImplementationPlan) {
        this.sessionM.implementationPlan = plan
    }
    
    onSearchPlanUpdate(plan: SearchPlan) {
        this.sessionM.searchPlan = plan
    }
    
    onApiSpecsUpdate(apiSpecs: ApiSpec[]) {
        this.sessionM.apiSpecs = apiSpecs
    }
    
    onToolsUpdate(tools: ToolSpec[]) {
        this.sessionM.tools = tools
    }
    
    onResultUpdate(result: ExecutionResult) {
        this.sessionM.results.push(result)
    }
    
    private calculateProgress(status: SessionStatus): number {
        switch (status) {
            case SessionStatus.PENDING:
                return 0
            case SessionStatus.PLANNING:
                return 20
            case SessionStatus.SEARCHING:
                return 40
            case SessionStatus.IMPLEMENTING:
                return 60
            case SessionStatus.EXECUTING:
                return 80
            case SessionStatus.COMPLETED:
                return 100
            case SessionStatus.FAILED:
                return 0
            default:
                return 0
        }
    }
    
    private getStatusDescription(status: SessionStatus): string {
        switch (status) {
            case SessionStatus.PENDING:
                return 'Waiting to start...'
            case SessionStatus.PLANNING:
                return 'Analyzing requirement and creating implementation plan...'
            case SessionStatus.SEARCHING:
                return 'Searching for API documentation...'
            case SessionStatus.IMPLEMENTING:
                return 'Implementing Python tools...'
            case SessionStatus.EXECUTING:
                return 'Executing tools...'
            case SessionStatus.COMPLETED:
                return 'Workflow completed successfully!'
            case SessionStatus.FAILED:
                return 'Workflow failed. Check error logs.'
            default:
                return 'Unknown status'
        }
    }
}