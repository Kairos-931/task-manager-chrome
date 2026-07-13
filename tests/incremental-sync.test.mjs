import assert from 'node:assert/strict'
import worker from '../backend/index.js'

const createDb = (legacyData = null) => {
  const records = new Map()
  const changes = []
  return {
    records,
    prepare(sql) {
      let args = []
      return {
        bind(...values) {
          args = values
          return this
        },
        async first() {
          if (sql.includes('SELECT 1 FROM sync_records')) return records.size ? { ok: 1 } : null
          if (sql.includes('FROM sync_records WHERE record_key')) {
            const record = records.get(args[0])
            return record ? {
              record_type: record.type,
              record_id: record.id,
              payload: record.payload,
              deleted: record.deleted,
              updated_at: record.updatedAt,
              source_device: record.sourceDevice
            } : null
          }
          if (sql.includes("FROM user_data WHERE key = 'full_sync'")) {
            return legacyData
              ? { value: JSON.stringify(legacyData), updated_at: '2026-07-13T00:00:00.000Z' }
              : null
          }
          return null
        },
        async run() {
          if (sql.includes('INSERT INTO sync_records')) {
            const [key, type, id, payload, deleted, updatedAt, sourceDevice] = args
            records.set(key, { key, type, id, payload, deleted, updatedAt, sourceDevice })
            return { meta: {} }
          }
          if (sql.includes('INSERT INTO sync_changes')) {
            const [key, type, id, payload, deleted, updatedAt, sourceDevice] = args
            changes.push({
              revision: changes.length + 1,
              record_key: key,
              record_type: type,
              record_id: id,
              payload,
              deleted,
              updated_at: updatedAt,
              source_device: sourceDevice
            })
            return { meta: { last_row_id: changes.length } }
          }
          return { meta: {} }
        },
        async all() {
          if (sql.includes("FROM sync_records WHERE record_type = 'category'")) {
            return {
              results: [...records.values()]
                .filter(record => record.type === 'category' && !record.deleted)
                .map(record => ({ payload: record.payload }))
            }
          }
          const [cursor, limit] = args
          return { results: changes.filter(change => change.revision > cursor).slice(0, limit) }
        }
      }
    }
  }
}

const createTask = (id, updatedAt, title) => ({
  id,
  title,
  description: '',
  priority: 'medium',
  category: '',
  dueDate: '',
  duration: 60,
  repeatType: 'none',
  repeatDays: [],
  repeatInterval: 1,
  completed: false,
  completedDates: [],
  createdAt: updatedAt,
  updatedAt,
  noTimeLimit: false
})

const sync = async (db, body) => {
  const response = await worker.fetch(new Request('https://taskmaster.test/api/sync/incremental', {
    method: 'POST',
    headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }), { API_TOKEN: 'test-token', DB: db })
  assert.equal(response.status, 200)
  return response.json()
}

const db = createDb()
const firstDevice = await sync(db, {
  deviceId: 'device-a',
  cursor: 0,
  changes: [{ type: 'task', id: 'task-a', payload: createTask('task-a', 100, 'A'), deleted: false, updatedAt: 100 }]
})
const secondDevice = await sync(db, {
  deviceId: 'device-b',
  cursor: 0,
  changes: [{ type: 'task', id: 'task-b', payload: createTask('task-b', 101, 'B'), deleted: false, updatedAt: 101 }]
})
assert.equal(secondDevice.changes.filter(change => change.type === 'task').length, 2)

const conflictingDevicesDb = createDb()
await sync(conflictingDevicesDb, {
  deviceId: 'device-newer',
  cursor: 0,
  changes: [{ type: 'task', id: 'task-conflict', payload: createTask('task-conflict', 400, 'Newer version'), deleted: false, updatedAt: 400 }]
})
await sync(conflictingDevicesDb, {
  deviceId: 'device-older',
  cursor: 0,
  changes: [{ type: 'task', id: 'task-conflict', payload: createTask('task-conflict', 300, 'Older version'), deleted: false, updatedAt: 300 }]
})
assert.equal(JSON.parse(conflictingDevicesDb.records.get('task:task-conflict').payload).title, 'Newer version')

const deletion = await sync(db, {
  deviceId: 'device-a',
  cursor: firstDevice.cursor,
  changes: [{ type: 'task', id: 'task-a', payload: null, deleted: true, updatedAt: 200 }]
})
assert.ok(deletion.changes.some(change => change.id === 'task-a' && change.deleted))

const staleDevice = await sync(db, {
  deviceId: 'device-c',
  cursor: deletion.cursor,
  changes: [{ type: 'task', id: 'task-a', payload: createTask('task-a', 150, 'stale'), deleted: false, updatedAt: 150 }]
})
assert.equal(staleDevice.changes.filter(change => change.id === 'task-a').length, 0)
assert.equal(staleDevice.rejectedChanges[0].id, 'task-a')
assert.equal(staleDevice.rejectedChanges[0].deleted, true)
assert.equal(db.records.get('task:task-a').deleted, 1)

const legacyTask = createTask('legacy-task', 300, 'Legacy')
const legacyDb = createDb({ tasks: [legacyTask], categories: [] })
const migrated = await sync(legacyDb, { deviceId: 'device-new', cursor: 0, changes: [] })
assert.ok(migrated.changes.some(change => change.id === 'legacy-task' && !change.deleted))

const fullSyncDb = {
  prepare(sql) {
    return {
      async first() {
        if (sql.includes('SELECT 1 FROM sync_records')) return null
        if (sql.includes("FROM user_data WHERE key = 'full_sync'")) {
          return {
            value: JSON.stringify({ tasks: [createTask('cloud-task', 1, 'Cloud task')] }),
            updated_at: '2026-07-13T00:00:00.000Z'
          }
        }
        return null
      }
    }
  }
}
const emptyOverwriteResponse = await worker.fetch(new Request('https://taskmaster.test/api/fullsync', {
  method: 'POST',
  headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: { tasks: [], categories: [] } })
}), { API_TOKEN: 'test-token', DB: fullSyncDb })
assert.equal(emptyOverwriteResponse.status, 409)
assert.equal((await emptyOverwriteResponse.json()).error, 'refused: empty overwrite')

const createdTaskDb = {
  values: [],
  prepare() {
    let args = []
    return {
      bind(...input) {
        args = input
        return this
      },
      async run() {
        createdTaskDb.values = args
        return { meta: {} }
      }
    }
  }
}
const createdTaskResponse = await worker.fetch(new Request('https://taskmaster.test/api/tasks', {
  method: 'POST',
  headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'Mobile complete', completed: true, duration: 30 })
}), { API_TOKEN: 'test-token', DB: createdTaskDb })
assert.equal(createdTaskResponse.status, 201)
assert.equal(createdTaskDb.values[8], 1)
assert.match(createdTaskDb.values[9], /^\d{4}-\d{2}-\d{2}T/)

const pendingTask = {
  id: 'mobile-once', title: 'Import once', description: '', priority: 'medium', category: '星标',
  due_date: '', duration: 60, no_time_limit: 0, completed: 0, completed_at: null,
  source: 'web', created_at: '2026-07-13T00:00:00.000Z'
}
const pendingDb = {
  synced: false,
  prepare(sql) {
    let ids = []
    return {
      bind(...input) {
        ids = input
        return this
      },
      async all() {
        return { results: pendingDb.synced ? [] : [pendingTask] }
      },
      async run() {
        if (sql.includes('UPDATE pending_tasks') && ids.includes('mobile-once')) pendingDb.synced = true
        return { meta: {} }
      }
    }
  }
}
const pendingRequest = () => new Request('https://taskmaster.test/api/tasks', {
  headers: { Authorization: 'Bearer test-token' }
})
assert.equal((await (await worker.fetch(pendingRequest(), { API_TOKEN: 'test-token', DB: pendingDb })).json()).tasks.length, 1)
const acknowledgeMobileTask = await worker.fetch(new Request('https://taskmaster.test/api/tasks/sync', {
  method: 'POST',
  headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
  body: JSON.stringify({ ids: ['mobile-once'] })
}), { API_TOKEN: 'test-token', DB: pendingDb })
assert.equal(acknowledgeMobileTask.status, 200)
assert.equal((await (await worker.fetch(pendingRequest(), { API_TOKEN: 'test-token', DB: pendingDb })).json()).tasks.length, 0)

const categoryResponse = await worker.fetch(new Request('https://taskmaster.test/api/categories', {
  headers: { Authorization: 'Bearer test-token' }
}), {
  API_TOKEN: 'test-token',
  DB: {
    prepare() {
      return { async first() { return null }, async all() { return { results: [] } } }
    }
  }
})
assert.equal(categoryResponse.status, 200)
const categoryData = await categoryResponse.json()
assert.ok(categoryData.categories.some(category => category.name === '星标'))
assert.deepEqual(categoryData.categories.slice(0, 4).map(category => category.id), [
  'default-starred', 'default-work', 'default-life', 'default-learning'
])

const categorySyncDb = createDb()
await sync(categorySyncDb, {
  deviceId: 'category-device',
  cursor: 0,
  changes: [{
    type: 'category', id: 'project-category', deleted: false, updatedAt: 500,
    payload: { id: 'project-category', name: '项目', color: '#123456', updatedAt: 500 }
  }]
})
const syncedCategoryResponse = await worker.fetch(new Request('https://taskmaster.test/api/categories', {
  headers: { Authorization: 'Bearer test-token' }
}), { API_TOKEN: 'test-token', DB: categorySyncDb })
const syncedCategoryData = await syncedCategoryResponse.json()
assert.ok(syncedCategoryData.categories.some(category => category.id === 'project-category'))

const legacyWriteResponse = await worker.fetch(new Request('https://taskmaster.test/api/fullsync', {
  method: 'POST',
  headers: { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: { tasks: [createTask('legacy-overwrite', 1, 'Old client')], categories: [] } })
}), { API_TOKEN: 'test-token', DB: categorySyncDb })
assert.equal(legacyWriteResponse.status, 409)
assert.equal((await legacyWriteResponse.json()).error, 'upgrade_required')

const backgroundSource = await import('node:fs/promises').then(fs => fs.readFile(new URL('../shared/background.ts', import.meta.url), 'utf8'))
assert.doesNotMatch(backgroundSource, /lt\.title === \(rt\.title as string\)/)
assert.match(backgroundSource, /localData\.tasks\.some\(local => local\.id === task\.id\)/)

console.log('Incremental sync tests passed')
