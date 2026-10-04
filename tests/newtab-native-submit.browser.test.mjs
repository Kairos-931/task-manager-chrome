import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve, sep } from 'node:path'

const extensionPath = resolve(process.env.TASKMASTER_EXTENSION_DIR || process.cwd())
const manifest = JSON.parse(readFileSync(join(extensionPath, 'manifest.json'), 'utf8'))
const chromeCandidates = [
  process.env.CHROME_PATH,
  process.env.PROGRAMFILES && join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
  process.env['PROGRAMFILES(X86)'] && join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
].filter(Boolean)
const chromePath = chromeCandidates.find(candidate => existsSync(candidate))

assert.ok(existsSync(join(extensionPath, 'newtab', 'newtab.html')), `Not a built TaskMaster extension: ${extensionPath}`)
assert.ok(chromePath, 'Set CHROME_PATH to a Chrome executable to run this real-browser regression.')

const extensionHash = createHash('sha256').update(Buffer.from(manifest.key, 'base64')).digest()
const extensionId = [...extensionHash.subarray(0, 16)]
  .map(byte => String.fromCharCode(97 + (byte >> 4), 97 + (byte & 15)))
  .join('')
const profile = mkdtempSync(join(tmpdir(), 'taskmaster-73-browser-'))
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-sync',
  '--disable-component-update',
  '--disable-breakpad',
  '--disable-crash-reporter',
  '--enable-extensions',
  '--enable-automation',
  '--remote-debugging-port=0',
  '--remote-allow-origins=*',
  `--user-data-dir=${profile}`,
  `--disable-extensions-except=${extensionPath}`,
  `--load-extension=${extensionPath}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })

let chromeStderr = ''
chrome.stderr.on('data', chunk => { chromeStderr += chunk.toString() })
let browser
let page
let relay

function connectCdp(url) {
  const socket = new WebSocket(url)
  const pending = new Map()
  const events = []
  let nextId = 0
  const opened = new Promise((resolveOpen, rejectOpen) => {
    socket.addEventListener('open', resolveOpen, { once: true })
    socket.addEventListener('error', () => rejectOpen(new Error('Chrome DevTools connection failed')), { once: true })
  })

  socket.addEventListener('message', async event => {
    const raw = typeof event.data === 'string'
      ? event.data
      : Buffer.from(await event.data.arrayBuffer()).toString('utf8')
    const message = JSON.parse(raw)
    if (!message.id) {
      if (['Runtime.exceptionThrown', 'Log.entryAdded', 'Console.messageAdded', 'Target.targetCrashed'].includes(message.method)) events.push(message)
      return
    }
    const result = pending.get(message.id)
    if (!result) return
    pending.delete(message.id)
    if (message.error) result.reject(new Error(message.error.message))
    else result.resolve(message)
  })

  return {
    async call(method, params = {}) {
      await opened
      const id = ++nextId
      const response = new Promise((resolveResponse, rejectResponse) => {
        pending.set(id, { resolve: resolveResponse, reject: rejectResponse })
      })
      socket.send(JSON.stringify({ id, method, params }))
      return response
    },
    close() {
      if (socket.readyState === WebSocket.OPEN) socket.close()
    },
    events,
  }
}

async function waitFor(check, label, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs
  let lastError
  let lastValue
  while (Date.now() < deadline) {
    try {
      const value = await check()
      lastValue = value
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await new Promise(resolveWait => setTimeout(resolveWait, 200))
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}${lastValue === undefined ? '' : `; last=${JSON.stringify(lastValue)}`}`)
}

async function evaluate(expression) {
  return evaluateOn(page, expression)
}

async function evaluateOn(target, expression) {
  const response = await target.call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  })
  if (response.result.exceptionDetails) throw new Error(response.result.exceptionDetails.text)
  return response.result.result?.value
}

const mockGoogleSyncFetch = `(() => {
  if (window.__tm73SyncFetchInstalled) return
  window.__tm73SyncFetchInstalled = true
  window.__tm73SyncFetchCount = 0
  window.__tm73SyncFetchCompleted = 0
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || ''
    if (!url.includes('/api/account/sync/incremental')) return originalFetch(input, init)
    window.__tm73SyncFetchCount += 1
    const response = new Response(JSON.stringify({ changes: [], hasMore: false, cursor: 1000 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
    await new Promise(resolve => setTimeout(resolve, 30))
    window.__tm73SyncFetchCompleted += 1
    return response
  }
})()`

async function createExtensionPage(port, url) {
  const { result: { targetId } } = await browser.call('Target.createTarget', { url: 'about:blank' })
  let target
  await waitFor(async () => {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    target = targets.find(item => item.id === targetId && item.type === 'page')
    return target?.webSocketDebuggerUrl
  }, 'isolated extension message source')

  const client = connectCdp(target.webSocketDebuggerUrl)
  await client.call('Page.enable')
  await client.call('Runtime.enable')
  await client.call('Page.addScriptToEvaluateOnNewDocument', { source: mockGoogleSyncFetch })
  await client.call('Page.navigate', { url })
  await waitFor(() => evaluateOn(client, "!!document.querySelector('#addTaskBtn') && !!chrome.runtime?.id"), 'isolated extension message source startup')
  return client
}

try {
  const activePortPath = join(profile, 'DevToolsActivePort')
  await waitFor(() => {
    if (chrome.exitCode !== null) {
      throw new Error(`Chrome exited with ${chrome.exitCode}: ${chromeStderr.slice(-1500)}`)
    }
    return existsSync(activePortPath)
  }, 'Chrome remote-debugging endpoint')

  const [port] = readFileSync(activePortPath, 'utf8').trim().split(/\r?\n/)
  const browserInfo = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json()
  browser = connectCdp(browserInfo.webSocketDebuggerUrl)
  const { result: { targetId } } = await browser.call('Target.createTarget', {
    url: `chrome-extension://${extensionId}/newtab/newtab.html`,
  })

  let pageTarget
  await waitFor(async () => {
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    pageTarget = targets.find(target => target.id === targetId && target.type === 'page')
    return pageTarget?.webSocketDebuggerUrl
  }, 'TaskMaster extension page')

  page = connectCdp(pageTarget.webSocketDebuggerUrl)
  await page.call('Page.enable')
  await page.call('Runtime.enable')
  await page.call('Page.navigate', { url: `chrome-extension://${extensionId}/newtab/newtab.html` })

  let lastStartupState
  const startup = await waitFor(async () => {
    const state = await evaluate("({app:!!document.querySelector('#addTaskBtn'),form:!!document.querySelector('#taskForm'),extensionId:chrome.runtime&&chrome.runtime.id})")
    lastStartupState = state
    return state?.app && state?.form ? state : null
  }, 'TaskMaster app initialization', 5000).catch(error => {
    const targetContext = pageTarget && { url: pageTarget.url, title: pageTarget.title }
    const diagnostics = browser.call('Target.getTargets')
    const commandLine = browser.call('Browser.getBrowserCommandLine').catch(error => ({ error: error.message }))
    const managerTarget = browser.call('Target.createTarget', { url: 'chrome://extensions/' })
    const policyTarget = browser.call('Target.createTarget', { url: 'chrome://policy/' })
    const pageState = evaluate("({url:location.href,title:document.title,body:document.body?.innerText?.slice(0,400),scripts:[...document.scripts].map(script=>script.src),chromeType:typeof chrome,runtime:typeof chrome!=='undefined'&&typeof chrome.runtime})")
    return Promise.all([diagnostics, commandLine, managerTarget, policyTarget, pageState]).then(async ([targetInfo, commandInfo, managerInfo, policyInfo, documentInfo]) => {
      let managerPage
      await waitFor(async () => {
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
        managerPage = targets.find(target => target.id === managerInfo.result.targetId)
        return managerPage?.webSocketDebuggerUrl
      }, 'chrome extensions diagnostic page', 3000).catch(() => {})
      const manager = managerPage?.webSocketDebuggerUrl ? connectCdp(managerPage.webSocketDebuggerUrl) : null
      if (manager) {
        await manager.call('Page.enable')
        await manager.call('Runtime.enable')
      }
      let policyPage
      await waitFor(async () => {
        const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
        policyPage = targets.find(target => target.id === policyInfo.result.targetId)
        return policyPage?.webSocketDebuggerUrl
      }, 'chrome policy diagnostic page', 3000).catch(() => {})
      const policy = policyPage?.webSocketDebuggerUrl ? connectCdp(policyPage.webSocketDebuggerUrl) : null
      if (policy) {
        await policy.call('Page.enable')
        await policy.call('Runtime.enable')
      }
      const policyState = policy ? await policy.call('Runtime.evaluate', {
        expression: 'document.body?.innerText || ""',
        returnByValue: true,
      }).then(response => response.result.result?.value).catch(error => ({ error: error.message })) : null
      policy?.close()
      const extensionList = manager ? await manager.call('Runtime.evaluate', {
        expression: "(function(){const found=[];function scan(root){for(const el of root.querySelectorAll('*')){if(el.localName==='extensions-item')found.push({text:el.shadowRoot?.innerText,html:el.shadowRoot?.innerHTML?.slice(0,500)});if(el.shadowRoot)scan(el.shadowRoot)}}scan(document);return{body:document.body.innerText,items:found}})()",
        returnByValue: true,
      }).then(response => response.result.result?.value).catch(error => ({ error: error.message })) : null
      manager?.close()
      throw new Error(`${error.message}; page=${JSON.stringify(targetContext)}; state=${JSON.stringify(lastStartupState)}; document=${JSON.stringify(documentInfo)}; commandLine=${JSON.stringify(commandInfo)}; targets=${JSON.stringify(targetInfo.result.targetInfos)}; extensionList=${JSON.stringify(extensionList)}; policy=${JSON.stringify(policyState)}; chromeStderr=${chromeStderr.slice(-1200)}; cdpEvents=${JSON.stringify(page.events.slice(-8))}`)
    })
  })
  assert.equal(startup.extensionId, extensionId, 'Loaded the extension with the expected stable ID.')

  const initialTaskCount = await evaluate("new Promise(resolve=>chrome.storage.local.get(['tm_local_backup'],r=>resolve(r.tm_local_backup?JSON.parse(r.tm_local_backup).tasks.length:0)))")
  const opened = await evaluate("(function(){document.addEventListener('invalid',event=>{window.__invalid=(window.__invalid||[]).concat([{id:event.target.id,name:event.target.name,message:event.target.validationMessage}])},true);document.addEventListener('submit',()=>{window.__submitCount=(window.__submitCount||0)+1},true);document.querySelector('#addTaskBtn').click();const modal=document.querySelector('#taskModal');return{opened:!modal.classList.contains('hidden'),form:!!document.querySelector('#taskForm')}})()")
  assert.deepEqual(opened, { opened: true, form: true }, 'Add button opens the real task form and attaches its submit handler.')

  const blankFormValidity = await evaluate("document.querySelector('#taskForm').checkValidity()")
  const blankInvalidControls = await evaluate('window.__invalid||[]')
  const requiredControls = await evaluate("[...document.querySelectorAll('#taskForm :required')].map(el=>({id:el.id,name:el.name,disabled:el.disabled,visible:!!(el.getClientRects().length)}))")
  await evaluate("(function(){const title=document.querySelector('#taskForm [name=title]');title.value='tm73-browser-submit';title.dispatchEvent(new Event('input',{bubbles:true}))})()")
  const validFormState = await evaluate("(function(){const form=document.querySelector('#taskForm');return{valid:form.checkValidity(),noValidate:form.noValidate,invalid:[...form.querySelectorAll(':invalid')].map(el=>({id:el.id,name:el.name,required:el.required,disabled:el.disabled,message:el.validationMessage})),mode:document.querySelector('[data-task-mode].active')?.dataset.taskMode}})()")
  assert.equal(blankFormValidity, false, 'The browser natively rejects an empty required title.')
  assert.ok(blankInvalidControls.some(control => control.name === 'title'), 'Native invalid event identifies the required title.')
  assert.equal(validFormState.valid, true, `A title-only normal task must pass native form validation: ${JSON.stringify(validFormState.invalid)}`)

  await evaluate("document.querySelector('#taskSubmitBtn').click()")
  const persisted = await waitFor(async () => evaluate("new Promise(resolve=>chrome.storage.local.get(['tm_local_backup'],r=>{const data=r.tm_local_backup?JSON.parse(r.tm_local_backup):{tasks:[]};const matches=data.tasks.filter(task=>task.title==='tm73-browser-submit');resolve(matches.length?matches.map(task=>({id:task.id,title:task.title,noTimeLimit:task.noTimeLimit,dueDate:task.dueDate,duration:task.duration})):null)}))"), 'local persistence through browser-native submit', 12_000)
  const modalClosed = await waitFor(async () => evaluate("document.querySelector('#taskModal')?.classList.contains('hidden')"), 'modal closes after local save', 12_000)
  const finalState = await evaluate("({submitCount:window.__submitCount||0,modalHidden:document.querySelector('#taskModal')?.classList.contains('hidden'),feedback:document.querySelector('.toast-message')?.textContent||''})")

  assert.equal(persisted.length, 1, 'One title-only click persists exactly one task.')
  assert.equal(persisted[0].noTimeLimit, true, 'A task with no date enters the task pool.')
  assert.equal(persisted[0].dueDate, '', 'No plan date remains unset.')
  assert.equal(persisted[0].duration, 0, 'No estimate remains unset.')
  assert.equal(finalState.submitCount, 1, 'The real browser emitted one submit event.')
  assert.equal(modalClosed && finalState.modalHidden, true, 'Successful local save closes the modal.')
  assert.equal(finalState.feedback, '已添加到任务池', 'Success feedback appears after persistence.')
  assert.ok(initialTaskCount === 0, 'The isolated browser profile starts without production tasks.')

  const legacySeeded = await evaluate(`new Promise(resolve=>chrome.storage.local.get(['tm_local_backup'],result=>{
    const data=JSON.parse(result.tm_local_backup)
    const formatDate=date=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0')
    const today=formatDate(new Date())
    const yesterdayDate=new Date()
    yesterdayDate.setDate(yesterdayDate.getDate()-1)
    const yesterday=formatDate(yesterdayDate)
    const base=(id,extra={})=>({id,title:id,description:'',priority:'medium',category:'default-work',dueDate:today,duration:0,repeatType:'daily',repeatDays:[],repeatInterval:1,completed:false,completedDates:[],createdAt:1,updatedAt:1,noTimeLimit:false,...extra})
    const missing=base('tm73-legacy-missing',{repeatStartDate:yesterday})
    delete missing.repeatDays
    delete missing.completedDates
    const nullHistory=base('tm73-legacy-null',{repeatDays:null,completedDates:null})
    const wrongType=base('tm73-legacy-wrong-type',{repeatType:'none',repeatDays:'invalid',completedDates:'not-an-array',completed:true})
    const partial=base('tm73-legacy-partial',{repeatType:'weekly',repeatStartDate:today,repeatDays:[new Date().getDay(),8,'invalid'],completedDates:[yesterday,'not-a-date',null]})
    const valid=base('tm73-legacy-valid',{repeatStartDate:yesterday,completedDates:[yesterday]})
    const parent=base('tm73-legacy-parent',{isParent:true,repeatType:'none',dueDate:'',noTimeLimit:true,completedDates:undefined,repeatDays:undefined})
    const child=base('tm73-legacy-child',{parentId:parent.id,repeatType:'none',completedDates:undefined,repeatDays:undefined})
    const legacy=[missing,nullHistory,wrongType,partial,valid,parent,child]
    data.tasks.push(...legacy)
    chrome.storage.local.set({tm_local_backup:JSON.stringify(data)},()=>resolve({count:data.tasks.length,legacyIds:legacy.map(task=>task.id),today,yesterday}))
  }))`)
  assert.equal(legacySeeded.legacyIds.length, 7, 'Seven synthetic legacy tasks cover missing, null, wrong-type, partial, valid and parent-child history.')
  await page.call('Page.reload', { ignoreCache: true })
  await waitFor(async () => evaluate('!!document.querySelector("[data-task-id=tm73-legacy-missing]")'), 'legacy local task set loads into the real newtab')
  const beforeLegacySubmit = await evaluate("new Promise(resolve=>chrome.storage.local.get(['tm_local_backup'],r=>resolve(JSON.parse(r.tm_local_backup).tasks.length)))")
  assert.equal(beforeLegacySubmit, 8, 'The isolated local backup contains the first task and all seven synthetic legacy records.')

  const legacyForm = await evaluate("(function(){document.addEventListener('submit',()=>{window.__submitCount=(window.__submitCount||0)+1},true);document.querySelector('#addTaskBtn').click();const form=document.querySelector('#taskForm');const title=form.querySelector('[name=title]');title.value='tm73-legacy-compatible-submit';title.dispatchEvent(new Event('input',{bubbles:true}));return{opened:!document.querySelector('#taskModal').classList.contains('hidden'),valid:form.checkValidity()}})()")
  assert.deepEqual(legacyForm, { opened: true, valid: true }, 'The real form opens and accepts a title with legacy tasks loaded.')
  await evaluate("document.querySelector('#taskSubmitBtn').click()")
  const legacySave = await waitFor(async () => evaluate(`new Promise(resolve=>chrome.storage.local.get(['tm_local_backup'],r=>{
    const tasks=JSON.parse(r.tm_local_backup).tasks
    const byId=Object.fromEntries(tasks.map(task=>[task.id,task]))
    const newTasks=tasks.filter(task=>task.title==='tm73-legacy-compatible-submit')
    resolve(newTasks.length===1 && tasks.length===${beforeLegacySubmit + 1}
      ? {count:tasks.length,newCount:newTasks.length,missing:byId['tm73-legacy-missing'].completedDates,nullHistory:byId['tm73-legacy-null'].completedDates,wrongType:byId['tm73-legacy-wrong-type'].completedDates,wrongTypeCompleted:byId['tm73-legacy-wrong-type'].completed,partial:byId['tm73-legacy-partial'].completedDates,partialDays:byId['tm73-legacy-partial'].repeatDays,valid:byId['tm73-legacy-valid'].completedDates,parentChild:byId['tm73-legacy-child'].parentId,modalHidden:document.querySelector('#taskModal')?.classList.contains('hidden'),feedback:document.querySelector('.toast-message')?.textContent||''}
      : null)
  }))`), 'one new task persists with every legacy record', 12_000)
  assert.deepEqual(legacySave, {
    count: beforeLegacySubmit + 1,
    newCount: 1,
    missing: [],
    nullHistory: [],
    wrongType: [],
    wrongTypeCompleted: true,
    partial: [legacySeeded.yesterday],
    partialDays: [new Date().getDay()],
    valid: [legacySeeded.yesterday],
    parentChild: 'tm73-legacy-parent',
    modalHidden: true,
    feedback: '已添加到任务池',
  }, 'A real form save preserves legacy tasks, explicit history and parent-child links while normalizing optional fields.')

  // Reopen the long-lived newtab in a synthetic account context. The fake
  // session and fetch response stay entirely inside this isolated profile.
  await evaluate("new Promise(resolve=>chrome.storage.local.set({tm_google_account:{sub:'tm73-test-account',email:'tm73@example.invalid',connected:true},tm_google_session_token_v1:'tm73-isolated-session'},resolve))")
  await page.call('Page.addScriptToEvaluateOnNewDocument', { source: mockGoogleSyncFetch })
  await page.call('Page.reload', { ignoreCache: true })
  await waitFor(async () => evaluate("!!document.querySelector('#addTaskBtn') && !!document.querySelector('#taskForm') && chrome.runtime?.id === '" + extensionId + "'"), 'logged-in task form initialization')
  await waitFor(async () => evaluate('window.__tm73SyncFetchCount > 0 && window.__tm73SyncFetchCount === window.__tm73SyncFetchCompleted'), 'isolated account sync initialization')
  await evaluate("window.__tm73AccountUpdates=0;chrome.runtime.onMessage.addListener(message=>{if(message?.action==='googleAccountSyncUpdated')window.__tm73AccountUpdates++});document.addEventListener('submit',()=>{window.__submitCount=(window.__submitCount||0)+1},true)")
  relay = await createExtensionPage(port, `chrome-extension://${extensionId}/newtab/newtab.html?tm73-relay`)
  await waitFor(async () => evaluateOn(relay, 'window.__tm73SyncFetchCount > 0 && window.__tm73SyncFetchCount === window.__tm73SyncFetchCompleted'), 'isolated account relay initialization')

  // Repeated account update messages while the modal is closed cause whole
  // app renders; the next Add click must bind the freshly rendered form.
  await evaluateOn(relay, "new Promise(resolve=>chrome.runtime.sendMessage({action:'googleAccountSyncUpdated'},resolve))")
  await waitFor(async () => evaluate('window.__tm73AccountUpdates === 1'), 'first account refresh event')
  await evaluateOn(relay, "new Promise(resolve=>chrome.runtime.sendMessage({action:'googleAccountSyncUpdated'},resolve))")
  await waitFor(async () => evaluate('window.__tm73AccountUpdates === 2'), 'repeated account refresh event')
  await new Promise(resolve => setTimeout(resolve, 150))
  const accountRerender = await evaluate("({addButton:!!document.querySelector('#addTaskBtn'),modalHidden:document.querySelector('#taskModal')?.classList.contains('hidden')})")
  assert.equal(accountRerender.addButton, true, 'Repeated logged-in account refreshes leave a working Add button.')
  assert.equal(accountRerender.modalHidden, true, 'Remote account refreshes while idle keep the task modal closed.')

  const draftHook = await evaluate(`(() => {
    const area = chrome.storage.local
    const originalSet = area.set.bind(area)
    const originalRemove = area.remove.bind(area)
    window.__tm73OriginalSet = originalSet
    const wrapper = function(values, callback) {
      const keys = Object.keys(values || {})
      if (window.__tm73FailNextLocalSave && Object.hasOwn(values || {}, 'tm_local_backup')) {
        window.__tm73FailNextLocalSave = false
        throw new Error('isolated simulated local storage failure')
      }
      if (keys.some(key => key.startsWith('tm_task_draft_v1:newtab:tm73-test-account:'))) {
        window.__tm73DraftWriteStarted = true
        window.__tm73DraftWriteCount = (window.__tm73DraftWriteCount || 0) + 1
        window.__tm73DraftWritesPending = (window.__tm73DraftWritesPending || 0) + 1
        setTimeout(() => {
          window.__tm73DraftWritesPending -= 1
          originalSet(values, callback)
        }, 1000)
        return
      }
      return originalSet(values, callback)
    }
    const removeWrapper = function(keys, callback) {
      const list = Array.isArray(keys) ? keys : [keys]
      if (list.some(key => String(key).startsWith('tm_task_draft_v1:newtab:tm73-test-account:'))) {
        window.__tm73DraftRemoveStarted = true
        window.__tm73DraftRemovePending = (window.__tm73DraftRemovePending || 0) + 1
        setTimeout(() => {
          window.__tm73DraftRemovePending -= 1
          originalRemove(keys, callback)
        }, 1500)
        return
      }
      return originalRemove(keys, callback)
    }
    try { Object.defineProperty(area, 'set', { configurable: true, writable: true, value: wrapper }) }
    catch { area.set = wrapper }
    try { Object.defineProperty(area, 'remove', { configurable: true, writable: true, value: removeWrapper }) }
    catch { area.remove = removeWrapper }
    if (area.set !== wrapper || area.remove !== removeWrapper) return { installed: false }
    return { installed: true }
  })()`)
  assert.equal(draftHook.installed, true, 'The isolated browser can delay only its task-draft writes.')

  const openedAccountModal = await evaluate("(function(){document.querySelector('#addTaskBtn').click();const modal=document.querySelector('#taskModal');const form=document.querySelector('#taskForm');const title=form.querySelector('[name=title]');window.__tm73TrackedForm=form;window.__tm73TrackedTitle=title;window.__tm73OldSubmitButton=form.querySelector('#taskSubmitBtn');title.value='tm73-account-submit';title.dispatchEvent(new Event('input',{bubbles:true}));return{opened:!modal.classList.contains('hidden'),form:!!form}})()")
  assert.deepEqual(openedAccountModal, { opened: true, form: true }, 'Add works after repeated logged-in page rerenders.')
  await waitFor(async () => evaluate('window.__tm73DraftWriteStarted === true'), 'deferred authenticated draft write')
  const accountDraftKeys = await waitFor(async () => evaluate("new Promise(resolve=>chrome.storage.local.get(null,values=>{const keys=Object.keys(values).filter(key=>key.startsWith('tm_task_draft_v1:newtab:tm73-test-account:'));resolve(keys.length?keys:null)}))"), 'account-scoped draft key', 3000)
  assert.ok(accountDraftKeys.length > 0, 'The active Google account uses its own draft context.')

  // Apply two synthetic remote snapshots while the form and a draft write are
  // active, then dispatch the same extension message the background sends.
  await evaluate(`new Promise(resolve=>chrome.storage.local.get(['tm_local_backup'],result=>{
    const data=JSON.parse(result.tm_local_backup)
    data.tasks.push({...data.tasks[0],id:'tm73-remote-before-save',title:'tm73-remote-before-save',createdAt:Date.now(),updatedAt:Date.now()})
    chrome.storage.local.set({tm_local_backup:JSON.stringify(data)},()=>resolve(true))
  }))`)
  await evaluateOn(relay, "new Promise(resolve=>chrome.runtime.sendMessage({action:'googleAccountSyncUpdated'},resolve))")
  await waitFor(async () => evaluate('window.__tm73AccountUpdates === 3'), 'remote update while the editor is open')
  await new Promise(resolve => setTimeout(resolve, 180))
  const firstRemoteWhileEditing = await evaluate("({sameForm:window.__tm73TrackedForm===document.querySelector('#taskForm'),title:document.querySelector('#taskForm [name=title]')?.value,modalOpen:!document.querySelector('#taskModal')?.classList.contains('hidden')})")
  assert.deepEqual(firstRemoteWhileEditing, { sameForm: true, title: 'tm73-account-submit', modalOpen: true }, 'A remote refresh does not replace or clear an open, drafted form.')

  await evaluate("document.querySelector('#taskSubmitBtn').click()")
  const savingButton = await waitFor(async () => evaluate("(()=>{const button=document.querySelector('#taskSubmitBtn');return button?.textContent==='保存中…'?{label:button.textContent,disabled:button.disabled}:null})()"), 'saving state after the account preflight', 3000)
  assert.deepEqual(savingButton, { label: '保存中…', disabled: true }, 'The account submit path enters a disabled saving state.')
  assert.ok((await evaluate('window.__tm73DraftWritesPending || 0')) > 0, 'The submit remains blocked behind an asynchronous account-scoped draft write.')
  const fetchCountBeforeSavingRemote = await evaluate('window.__tm73SyncFetchCount')
  await evaluate(`new Promise(resolve=>chrome.storage.local.get(['tm_local_backup'],result=>{
    const data=JSON.parse(result.tm_local_backup)
    data.tasks.push({...data.tasks[0],id:'tm73-remote-during-save',title:'tm73-remote-during-save',createdAt:Date.now()+1,updatedAt:Date.now()+1})
    chrome.storage.local.set({tm_local_backup:JSON.stringify(data)},()=>resolve(true))
  }))`)
  await evaluateOn(relay, "new Promise(resolve=>chrome.runtime.sendMessage({action:'googleAccountSyncUpdated'},resolve))")
  await waitFor(async () => evaluate('window.__tm73AccountUpdates === 4'), 'second remote update during draft-backed submit')
  await waitFor(async () => evaluate('window.__tm73SyncFetchCount > ' + fetchCountBeforeSavingRemote), 'remote refresh sync request during submit', 5000)
  await new Promise(resolve => setTimeout(resolve, 150))
  const secondRemoteWhileSaving = await evaluate("({sameForm:window.__tm73TrackedForm===document.querySelector('#taskForm'),title:document.querySelector('#taskForm [name=title]')?.value,modalOpen:!document.querySelector('#taskModal')?.classList.contains('hidden'),label:document.querySelector('#taskSubmitBtn')?.textContent,draftWritesPending:window.__tm73DraftWritesPending||0,submitCount:window.__submitCount||0})")
  assert.equal(secondRemoteWhileSaving.sameForm, true, 'A remote update does not replace the submitted form.')
  assert.equal(secondRemoteWhileSaving.title, 'tm73-account-submit', 'A remote update preserves the submitted title.')
  assert.equal(secondRemoteWhileSaving.modalOpen, true, 'A remote update does not close the in-flight task modal.')
  assert.equal(secondRemoteWhileSaving.label, '保存中…', 'The submit remains visibly busy during the async draft write.')
  assert.ok(secondRemoteWhileSaving.draftWritesPending > 0, 'The remote refresh overlaps the pending draft write.')
  assert.equal(secondRemoteWhileSaving.submitCount, 1, 'A disabled second click does not start another submit.')
  await waitFor(async () => evaluate('window.__tm73SyncFetchCount === window.__tm73SyncFetchCompleted'), 'finish remote refresh before holding the task sync', 5000)
  await new Promise(resolve => setTimeout(resolve, 80))
  await evaluate("document.querySelector('#taskSubmitBtn').click()")
  assert.equal(await evaluate('window.__submitCount'), 1, 'A second click while the button is disabled does not enqueue another submit.')

  const persistedBeforeDraftCleanup = await waitFor(async () => evaluate(`new Promise(resolve=>chrome.storage.local.get(null,values=>{
    const data=JSON.parse(values.tm_local_backup)
    const matches=data.tasks.filter(task=>task.title==='tm73-account-submit')
    const key=Object.keys(values).find(key=>key.startsWith('tm_task_draft_v1:newtab:tm73-test-account:'))
    const staleDraft=key?values[key]:null
    resolve(matches.length===1 && window.__tm73DraftRemovePending > 0
      ? {matches:matches.length,remoteBefore:data.tasks.some(task=>task.id==='tm73-remote-before-save'),remoteDuring:data.tasks.some(task=>task.id==='tm73-remote-during-save'),modalHidden:document.querySelector('#taskModal')?.classList.contains('hidden'),pendingDraftTitle:staleDraft?.fields?.title,pendingTaskId:staleDraft?.pendingTaskId,taskId:matches[0].id}
      : null)
  }))`), 'local task persistence before delayed draft cleanup', 12_000)
  assert.deepEqual(persistedBeforeDraftCleanup, { matches: 1, remoteBefore: true, remoteDuring: true, modalHidden: true, pendingDraftTitle: 'tm73-account-submit', pendingTaskId: persistedBeforeDraftCleanup.taskId, taskId: persistedBeforeDraftCleanup.taskId }, 'The delayed draft is the submitted draft and points to the task already saved locally.')
  assert.equal(persistedBeforeDraftCleanup.pendingTaskId, persistedBeforeDraftCleanup.taskId, 'A leftover draft points at the task just committed, so initialization can suppress stale recovery.')
  const whileDraftCleanupPending = await evaluate("({oldFormDetached:!window.__tm73TrackedForm.isConnected,oldButtonDetached:!window.__tm73OldSubmitButton.isConnected,title:document.querySelector('#taskForm [name=title]')?.value,modalHidden:document.querySelector('#taskModal')?.classList.contains('hidden'),label:document.querySelector('#taskSubmitBtn')?.textContent,disabled:document.querySelector('#taskSubmitBtn')?.disabled,draftRemovePending:window.__tm73DraftRemovePending||0,feedback:document.querySelector('.toast-message')?.textContent||'',submitCount:window.__submitCount||0})")
  assert.equal(whileDraftCleanupPending.oldFormDetached, true, 'Success replaces the submitted form immediately.')
  assert.equal(whileDraftCleanupPending.oldButtonDetached, true)
  assert.equal(whileDraftCleanupPending.modalHidden, true, 'The modal closes while its draft is still being cleaned up.')
  assert.equal(whileDraftCleanupPending.label, '添加')
  assert.equal(whileDraftCleanupPending.disabled, false)
  assert.ok(whileDraftCleanupPending.draftRemovePending > 0)
  assert.equal(whileDraftCleanupPending.feedback, '已添加到任务池', 'Success feedback follows local persistence, not draft cleanup.')
  const accountSubmitFeedback = await evaluate("({submitCount:window.__submitCount||0,feedback:document.querySelector('.toast-message')?.textContent||'',modalHidden:document.querySelector('#taskModal')?.classList.contains('hidden')})")
  assert.equal(accountSubmitFeedback.submitCount, 1, 'One authenticated task submit event is emitted.')
  assert.equal(accountSubmitFeedback.feedback, '已添加到任务池')
  assert.equal(accountSubmitFeedback.modalHidden, true)
  await evaluate(`new Promise(resolve=>chrome.storage.local.get(['tm_local_backup'],result=>{
    const data=JSON.parse(result.tm_local_backup)
    data.tasks.push({...data.tasks[0],id:'tm73-remote-during-cleanup',title:'tm73-remote-during-cleanup',createdAt:Date.now()+2,updatedAt:Date.now()+2})
    chrome.storage.local.set({tm_local_backup:JSON.stringify(data)},()=>resolve(true))
  }))`)
  await evaluateOn(relay, "new Promise(resolve=>chrome.runtime.sendMessage({action:'googleAccountSyncUpdated'},resolve))")
  await waitFor(async () => evaluate('window.__tm73AccountUpdates === 5'), 'remote update while task is saved but draft cleanup is pending')
  await new Promise(resolve => setTimeout(resolve, 120))
  const remoteDuringCleanup = await evaluate("({oldFormDetached:!window.__tm73TrackedForm.isConnected,modalHidden:document.querySelector('#taskModal')?.classList.contains('hidden'),addButton:!!document.querySelector('#addTaskBtn'),title:document.querySelector('#taskForm [name=title]')?.value})")
  assert.deepEqual(remoteDuringCleanup, { oldFormDetached: true, modalHidden: true, addButton: true, title: '' }, 'A remote refresh while cleanup is pending keeps the next add form available.')
  await evaluate('window.__tm73OldSubmitButton.click()')
  assert.equal(await evaluate('window.__submitCount'), 1, 'Clicking the detached old button cannot create a duplicate.')
  const draftWritesBeforeReopen = await evaluate('window.__tm73DraftWriteCount || 0')
  const reopenedWhileCleanupPending = await evaluate("(function(){document.querySelector('#addTaskBtn').click();const form=document.querySelector('#taskForm');const title=form.querySelector('[name=title]');title.value='tm73-new-draft-after-cleanup';title.dispatchEvent(new Event('input',{bubbles:true}));return{modalOpen:!document.querySelector('#taskModal').classList.contains('hidden'),title:title.value,removePending:window.__tm73DraftRemovePending||0,draftWrites:window.__tm73DraftWriteCount||0,formIsNew:form!==window.__tm73TrackedForm}})()")
  assert.equal(reopenedWhileCleanupPending.modalOpen, true, 'The task form can reopen immediately during cleanup.')
  assert.equal(reopenedWhileCleanupPending.title, 'tm73-new-draft-after-cleanup')
  assert.equal(reopenedWhileCleanupPending.formIsNew, true)
  assert.ok(reopenedWhileCleanupPending.removePending > 0, 'The prior cleanup is still pending when the new form is opened.')
  assert.equal(reopenedWhileCleanupPending.draftWrites, draftWritesBeforeReopen, 'The new draft write waits behind the old clear in the captured store queue.')
  const reopenedDraftSaved = await waitFor(async () => evaluate(`new Promise(resolve=>chrome.storage.local.get(null,values=>{
    const data=JSON.parse(values.tm_local_backup)
    const key=Object.keys(values).find(key=>key.startsWith('tm_task_draft_v1:newtab:tm73-test-account:'))
    const draft=key?values[key]:null
    resolve(!window.__tm73DraftRemovePending && (window.__tm73DraftWritesPending||0)===0 && draft?.fields?.title==='tm73-new-draft-after-cleanup'
      ? {title:draft.fields.title,context:draft.context,hasOnlyOneSubmittedTask:data.tasks.filter(task=>task.title==='tm73-account-submit').length===1}
      : null)
  }))`), 'new form draft survives older delayed cleanup', 8000)
  assert.deepEqual(reopenedDraftSaved, { title: 'tm73-new-draft-after-cleanup', context: 'newtab:tm73-test-account', hasOnlyOneSubmittedTask: true }, 'A delayed clear of the submitted form cannot remove the new form draft or create a duplicate task.')
  const submittedWithRemoteUpdates = await waitFor(async () => evaluate(`new Promise(resolve=>chrome.storage.local.get(['tm_local_backup'],result=>{
    const data=JSON.parse(result.tm_local_backup)
    const matches=data.tasks.filter(task=>task.title==='tm73-account-submit')
    resolve(matches.length===1 && data.tasks.some(task=>task.id==='tm73-remote-during-cleanup') && !window.__tm73DraftRemovePending && document.querySelector('#taskModal')?.classList.contains('hidden')===false
      ? {matches:matches.length,remoteBefore:data.tasks.some(task=>task.id==='tm73-remote-before-save'),remoteDuring:data.tasks.some(task=>task.id==='tm73-remote-during-save'),remoteCleanup:true,newFormOpen:true}
      : null)
  }))`), 'delayed cleanup finishes without disturbing the new form', 12_000)
  assert.deepEqual(submittedWithRemoteUpdates, { matches: 1, remoteBefore: true, remoteDuring: true, remoteCleanup: true, newFormOpen: true }, 'The logged-in save remains single, retains remote updates, and leaves the newly opened form available.')
  await waitFor(async () => evaluate('window.__tm73SyncFetchCount === window.__tm73SyncFetchCompleted'), 'finish isolated asynchronous cloud sync')

  // A failed first write must retain the title, show a persistent inline error,
  // release the old submit lock, and allow a successful second attempt.
  const priorDraftWrites = await evaluate('window.__tm73DraftWriteCount || 0')
  const reopenForRetry = await evaluate("(function(){const form=document.querySelector('#taskForm');const title=form.querySelector('[name=title]');title.value='tm73-failure-retry';title.dispatchEvent(new Event('input',{bubbles:true}));return{modalOpen:!document.querySelector('#taskModal').classList.contains('hidden'),form:form!==window.__tm73TrackedForm}})()")
  assert.deepEqual(reopenForRetry, { modalOpen: true, form: true }, 'The reopened form remains available for the retry path.')
  await waitFor(async () => evaluate('(window.__tm73DraftWriteCount || 0) > ' + priorDraftWrites), 'retry form draft write')
  await evaluate('window.__tm73FailNextLocalSave=true;document.querySelector("#taskSubmitBtn").click()')
  const failedAttempt = await waitFor(async () => evaluate("(()=>{const error=document.querySelector('#taskSaveError')?.textContent||'';const button=document.querySelector('#taskSubmitBtn');return /本地保存失败/.test(error)&&button&&!button.disabled?{error,title:document.querySelector('#taskForm [name=title]')?.value,disabled:button.disabled,label:button.textContent}:null})()"), 'visible local storage failure', 5000)
  assert.match(failedAttempt.error, /本地保存失败/)
  assert.equal(failedAttempt.title, 'tm73-failure-retry', 'Failed save preserves the entered title.')
  assert.equal(failedAttempt.disabled, false, 'The failed submit releases its disabled state.')
  assert.equal(failedAttempt.label, '添加', 'The failed submit restores the retry label.')
  await evaluate("document.querySelector('#taskSubmitBtn').click()")
  const retried = await waitFor(async () => evaluate(`new Promise(resolve=>chrome.storage.local.get(['tm_local_backup'],result=>{
    const data=JSON.parse(result.tm_local_backup)
    const matches=data.tasks.filter(task=>task.title==='tm73-failure-retry')
    resolve(matches.length===1 && document.querySelector('#taskModal')?.classList.contains('hidden') ? matches.length : null)
  }))`), 'successful second submit after local failure', 12_000)
  assert.equal(retried, 1, 'The second submit persists one task and closes the modal.')

  const authenticatedFinal = await evaluate("({feedback:document.querySelector('.toast-message')?.textContent||'',modalHidden:document.querySelector('#taskModal')?.classList.contains('hidden'),draftWrites:window.__tm73DraftWriteCount||0,syncFetches:window.__tm73SyncFetchCount||0})")
  assert.equal(authenticatedFinal.feedback, '已添加到任务池')
  assert.equal(authenticatedFinal.modalHidden, true)

  const parentDraftWritesBefore = await evaluate('window.__tm73DraftWriteCount || 0')
  const parentForm = await evaluate("(function(){document.querySelector('#addTaskBtn').click();const form=document.querySelector('#taskForm');form.querySelector('[data-task-mode=parent]').click();form.querySelector('[name=title]').value='tm73-parent-delayed-cleanup';form.querySelector('[name=title]').dispatchEvent(new Event('input',{bubbles:true}));const rows=[...form.querySelectorAll('#newParentChildren .split-child-row')];rows.forEach((row,index)=>{const title=row.querySelector('.split-child-title');title.value='tm73-parent-child-'+(index+1);title.dispatchEvent(new Event('input',{bubbles:true}));const date=row.querySelector('.split-child-date');date.value='2099-01-0'+(8+index);date.dispatchEvent(new Event('input',{bubbles:true}))});return{modalOpen:!document.querySelector('#taskModal').classList.contains('hidden'),mode:form.querySelector('[data-task-mode].active')?.dataset.taskMode,title:form.querySelector('[name=title]').value,childCount:rows.length}})()")
  assert.deepEqual(parentForm, { modalOpen: true, mode: 'parent', title: 'tm73-parent-delayed-cleanup', childCount: 2 }, 'The parent-task form supports its normal save path.')
  await waitFor(async () => evaluate(`new Promise(resolve=>chrome.storage.local.get(null,values=>{
    const key=Object.keys(values).find(key=>key.startsWith('tm_task_draft_v1:newtab:tm73-test-account:'))
    resolve((window.__tm73DraftWriteCount||0)>${parentDraftWritesBefore} && (window.__tm73DraftWritesPending||0)===0 && values[key]?.fields?.title==='tm73-parent-delayed-cleanup')
  }))`), 'parent task draft saved in synthetic account', 8000)
  await evaluate("document.querySelector('#taskSubmitBtn').click()")
  const parentSavedBeforeCleanup = await waitFor(async () => evaluate(`new Promise(resolve=>chrome.storage.local.get(null,values=>{
    const data=JSON.parse(values.tm_local_backup)
    const parents=data.tasks.filter(task=>task.title==='tm73-parent-delayed-cleanup' && task.isParent)
    const children=parents.length===1?data.tasks.filter(task=>task.parentId===parents[0].id):[]
    const feedback=document.querySelector('.toast-message')?.textContent||''
    const modalHidden=document.querySelector('#taskModal')?.classList.contains('hidden')
    resolve(parents.length===1 && children.length===2 && window.__tm73DraftRemovePending>0 && modalHidden
      ? {parents:parents.length,children:children.length,modalHidden,feedback}
      : null)
  }))`), 'parent locally saved before delayed draft cleanup', 12_000)
  assert.deepEqual(parentSavedBeforeCleanup, { parents: 1, children: 2, modalHidden: true, feedback: '已创建大任务和 2 个子任务' }, 'Large-task creation also closes and reports local success before cleanup returns.')
  const parentCleanupComplete = await waitFor(async () => evaluate("(window.__tm73DraftRemovePending||0)===0 && document.querySelector('#taskModal')?.classList.contains('hidden')"), 'parent draft cleanup finishes after modal close', 8000)
  assert.equal(parentCleanupComplete, true)

  const staleDraftKey = accountDraftKeys[0]
  const staleDraftSeeded = await evaluate(`new Promise(resolve=>chrome.storage.local.get(['tm_local_backup'],result=>{
    const data=JSON.parse(result.tm_local_backup)
    const committed=data.tasks.find(task=>task.title==='tm73-account-submit')
    if(!committed){resolve(false);return}
    const draft={version:1,context:'newtab:tm73-test-account',updated:Date.now(),mode:'normal',pendingTaskId:committed.id,fields:{title:'tm73-stale-unsubmitted-duplicate'},children:[]}
    window.__tm73OriginalSet({[${JSON.stringify(staleDraftKey)}]:draft},()=>resolve(true))
  }))`)
  assert.equal(staleDraftSeeded, true, 'The test plants a stale pre-commit draft linked to a task already saved locally.')
  await page.call('Page.reload', { ignoreCache: true })
  await waitFor(async () => evaluate("!!document.querySelector('#addTaskBtn') && !!document.querySelector('#taskForm') && chrome.runtime?.id === '" + extensionId + "'"), 'stale draft reload initialization')
  const staleDraftRecovery = await waitFor(async () => evaluate(`new Promise(resolve=>chrome.storage.local.get(null,values=>{
    const data=JSON.parse(values.tm_local_backup)
    const draftPresent=Object.hasOwn(values,${JSON.stringify(staleDraftKey)})
    const title=document.querySelector('#taskForm [name=title]')?.value||''
    const modalHidden=document.querySelector('#taskModal')?.classList.contains('hidden')
    const matches=data.tasks.filter(task=>task.title==='tm73-account-submit').length
    resolve(!draftPresent && title==='' && modalHidden && matches===1 ? {draftPresent,title,modalHidden,matches} : null)
  }))`), 'committed stale draft is cleared and not restored after reload', 8_000)
  assert.deepEqual(staleDraftRecovery, { draftPresent: false, title: '', modalHidden: true, matches: 1 }, 'A leftover draft linked to an existing task is not restored as an unsubmitted task after reload.')

  console.log(JSON.stringify({
    browser: browserInfo.Browser,
    extensionVersion: manifest.version,
    initialTaskCount,
    blankFormValidity,
    blankInvalidControls,
    requiredControls,
    validFormState,
    persisted,
    legacySeeded,
    legacySave,
    finalState,
    accountDraftKeys,
    firstRemoteWhileEditing,
    secondRemoteWhileSaving,
    whileDraftCleanupPending,
    accountSubmitFeedback,
    remoteDuringCleanup,
    reopenedDraftSaved,
    savingButton,
    submittedWithRemoteUpdates,
    failedAttempt: { error: failedAttempt.error, title: failedAttempt.title, disabled: failedAttempt.disabled, label: failedAttempt.label },
    retried,
    authenticatedFinal,
    parentSavedBeforeCleanup,
    staleDraftRecovery,
  }, null, 2))
} finally {
  if (relay) relay.close()
  if (page) page.close()
  if (browser) {
    await browser.call('Browser.close').catch(() => {})
    browser.close()
  }
  if (chrome.exitCode === null) {
    await Promise.race([
      new Promise(resolveExit => chrome.once('exit', resolveExit)),
      new Promise(resolveTimeout => setTimeout(resolveTimeout, 3000)),
    ])
  }
  if (chrome.exitCode === null) {
    chrome.kill()
    await Promise.race([
      new Promise(resolveExit => chrome.once('exit', resolveExit)),
      new Promise(resolveTimeout => setTimeout(resolveTimeout, 3000)),
    ])
  }

  const tempRoot = resolve(tmpdir())
  const profilePath = resolve(profile)
  const tempPrefix = `${tempRoot}${sep}`
  if (profilePath.startsWith(tempPrefix) && basename(profilePath).startsWith('taskmaster-73-browser-') && chrome.exitCode !== null) {
    try { rmSync(profilePath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }) }
    catch (error) { console.error(`Could not clean isolated browser profile (${error.code || 'error'}): ${profilePath}`) }
  } else {
    console.error(`Retained isolated browser profile for cleanup: ${profilePath}`)
  }
}
