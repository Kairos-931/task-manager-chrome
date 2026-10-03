import { getGoogleAccount } from './storage'

export type DraftMode = 'normal' | 'parent'
export interface TaskDraft {
  version: 1
  context: string
  updated: number
  mode: DraftMode
  taskId?: string
  taskUpdatedAt?: number
  pendingTaskId?: string
  fields: Record<string, string | boolean>
  children: Array<{ title: string; duration: string; dueDate: string }>
}

const PREFIX = 'tm_task_draft_v1:'
const entry = (): string => window.location.pathname.includes('popup') ? 'popup' : 'newtab'
export const draftContext = async (): Promise<string> => {
  const account = await getGoogleAccount()
  return `${entry()}:${account?.connected && account.sub ? account.sub : 'guest'}`
}

const storageGet = (key: string): Promise<TaskDraft | undefined> => new Promise((resolve, reject) => {
  chrome.storage.local.get([key], result => {
    if (chrome.runtime.lastError) reject(chrome.runtime.lastError)
    else resolve(result[key] as TaskDraft | undefined)
  })
})
const storageSet = (key: string, draft: TaskDraft): Promise<void> => new Promise((resolve, reject) => {
  chrome.storage.local.set({ [key]: draft }, () => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve())
})
const storageRemove = (key: string): Promise<void> => new Promise((resolve, reject) => {
  chrome.storage.local.remove(key, () => chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve())
})

export class TaskDraftStore {
  private queue: Promise<void> = Promise.resolve()
  private generation = 0
  private revision = 0
  readonly key: string
  constructor(readonly context: string, sessionId: string) {
    this.key = `${PREFIX}${context}:${sessionId}`
  }
  snapshot(): number { return this.generation }
  read(): Promise<TaskDraft | undefined> { return storageGet(this.key) }
  save(draft: TaskDraft, generation = this.generation): Promise<void> {
    if (generation !== this.generation) return Promise.resolve()
    const revision = ++this.revision
    const operation = this.queue.then(async () => {
      if (generation === this.generation && revision === this.revision) await storageSet(this.key, draft)
    })
    this.queue = operation.catch(() => undefined)
    return operation
  }
  clear(): Promise<void> {
    this.generation++
    this.revision++
    const operation = this.queue.then(() => storageRemove(this.key))
    this.queue = operation.catch(() => undefined)
    return operation
  }
}

export const draftSessionId = async (): Promise<string> => {
  if (entry() === 'popup') return 'active'
  return new Promise(resolve => {
    const tabs = chrome.tabs as typeof chrome.tabs & { getCurrent(callback: (tab?: { id?: number }) => void): void }
    tabs.getCurrent(tab => {
      if (tab?.id !== undefined) { resolve(`tab-${tab.id}`); return }
      try {
        const existing = sessionStorage.getItem('tm_task_draft_session')
        if (existing) { resolve(existing); return }
        const created = crypto.randomUUID()
        sessionStorage.setItem('tm_task_draft_session', created)
        resolve(created)
      } catch { resolve(crypto.randomUUID()) }
    })
  })
}

export const readLatestTaskDraft = async (context: string, sessionId: string): Promise<{ store: TaskDraftStore; draft?: TaskDraft }> => {
  const store = new TaskDraftStore(context, sessionId)
  const draft = await store.read()
  if (draft?.version !== 1 || draft.context !== context) return { store }
  return { store, draft }
}
