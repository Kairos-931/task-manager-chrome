// Chrome extension API type declarations
interface StorageChange {
  newValue?: any
  oldValue?: any
}

declare const chrome: {
  runtime: {
    lastError?: { message: string }
    id?: string
    getURL(path: string): string
    sendMessage(message: any, responseCallback?: (response: any) => void): void
    onMessage: {
      addListener(callback: (message: any, sender: any, sendResponse: (response?: any) => void) => void): void
    }
  }
  tabs: {
    create(options: { url: string; active?: boolean }, callback?: (tab: any) => void): void
  }
  storage: {
    sync: {
      get(keys: string | string[] | null, callback: (result: Record<string, string>) => void): void
      set(items: Record<string, string>, callback?: () => void): void
    }
    local: {
      get(keys: string | string[] | null, callback: (result: Record<string, string>) => void): void
      set(items: Record<string, string>, callback?: () => void): void
    }
    onChanged: {
      addListener(callback: (changes: { [key: string]: StorageChange }, areaName: string) => void): void
    }
  }
}
