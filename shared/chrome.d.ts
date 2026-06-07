interface StorageChange {
  newValue?: any
  oldValue?: any
}

interface StorageArea {
  get(keys: string | string[] | null, callback: (result: Record<string, any>) => void): void
  set(items: Record<string, any>, callback?: () => void): void
  remove(keys: string | string[], callback?: () => void): void
}

interface ChromeAlarm {
  name: string
  scheduledTime: number
  periodInMinutes?: number
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
    onInstalled: {
      addListener(callback: (details: { reason: string; previousVersion?: string }) => void): void
    }
    onStartup: {
      addListener(callback: () => void): void
    }
  }
  tabs: {
    create(options: { url: string; active?: boolean }, callback?: (tab: any) => void): void
  }
  storage: {
    sync: StorageArea
    local: StorageArea
    onChanged: {
      addListener(callback: (changes: { [key: string]: StorageChange }, areaName: string) => void): void
    }
  }
  alarms: {
    create(name: string, alarmInfo: { when?: number; periodInMinutes?: number; delayInMinutes?: number }): void
    get(name: string, callback: (alarm: ChromeAlarm | undefined) => void): void
    onAlarm: {
      addListener(callback: (alarm: ChromeAlarm) => void): void
    }
  }
}