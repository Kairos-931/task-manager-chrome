// Background script for Chrome extension
import { createAutoBackup } from './storage'
import { TASKMASTER_API_BASE_URL } from './config'

const ALARM_NAME = 'tm_daily_backup'
const ALARM_PERIOD_MINUTES = 24 * 60 // once per day

// Register alarm on install / startup
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES })
  console.log('[TaskMaster BG] daily backup alarm registered')
  // Create initial backup
  triggerBackup()
})

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.get(ALARM_NAME, (alarm) => {
    if (!alarm) {
      chrome.alarms.create(ALARM_NAME, { periodInMinutes: ALARM_PERIOD_MINUTES })
    }
  })
})

// Handle alarm
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    triggerBackup()
  }
})

async function triggerBackup() {
  try {
    const result = await createAutoBackup()
    if (result.success) {
      console.log('[TaskMaster BG] auto backup completed')
    } else {
      console.error('[TaskMaster BG] auto backup failed:', result.error)
    }
  } catch (e) {
    console.error('[TaskMaster BG] backup error:', e)
  }
}

// Message handlers
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'openNewTab') {
    chrome.tabs.create({ url: chrome.runtime.getURL('newtab/newtab.html') })
    sendResponse({})
    return false
  }

  if (message.action === 'googleLogin') {
    authenticateWithGoogle().then(sendResponse).catch(error => {
      sendResponse({ error: error instanceof Error ? error.message : String(error) })
    })
    return true
  }

  // Unknown action — respond immediately to avoid port-closed error
  sendResponse({})
  return false
})

const randomBase64Url = (byteLength: number): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength))
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const base64Url = (bytes: Uint8Array): string => {
  let binary = ''
  bytes.forEach(byte => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const authenticateWithGoogle = async (): Promise<{ session?: unknown; error?: string }> => {
  const configResponse = await fetch(`${TASKMASTER_API_BASE_URL}/api/auth/config`, { cache: 'no-store' })
  const config = await configResponse.json().catch(() => ({})) as { clientId?: string; error?: string }
  if (!configResponse.ok || !config.clientId) {
    throw new Error(config.error || 'Google 登录暂不可用，请稍后重试')
  }

  const state = randomBase64Url(32)
  const nonce = randomBase64Url(32)
  const codeVerifier = randomBase64Url(48)
  const codeChallenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier))))
  const redirectUri = chrome.identity.getRedirectURL()
  const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authorizeUrl.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account'
  }).toString()

  const callbackUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: authorizeUrl.toString(), interactive: true }, responseUrl => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Google 授权未完成'))
        return
      }
      if (!responseUrl) {
        reject(new Error('Google 授权未返回结果'))
        return
      }
      resolve(responseUrl)
    })
  })

  const callback = new URL(callbackUrl)
  if (callback.origin !== new URL(redirectUri).origin || callback.pathname !== new URL(redirectUri).pathname) {
    throw new Error('Google 授权回调地址无效')
  }
  if (callback.searchParams.get('state') !== state) throw new Error('Google 授权校验失败，请重试')
  const providerError = callback.searchParams.get('error')
  if (providerError) throw new Error(providerError === 'access_denied' ? '已取消 Google 登录' : 'Google 授权失败')
  const code = callback.searchParams.get('code')
  if (!code) throw new Error('Google 授权未返回登录代码')

  const exchangeResponse = await fetch(`${TASKMASTER_API_BASE_URL}/api/auth/exchange`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, codeVerifier, redirectUri, nonce })
  })
  const exchangeResult = await exchangeResponse.json().catch(() => ({})) as { session?: unknown; error?: string }
  if (!exchangeResponse.ok || !exchangeResult.session) {
    throw new Error(exchangeResult.error || 'Google 登录失败，请重试')
  }
  return { session: exchangeResult.session }
}
