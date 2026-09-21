const DEFAULT_DB_NAME = 'qinghuabu.draw.fields'
const DEFAULT_STORE_NAME = 'records'

function getIndexedDB(options = {}) {
  return options.indexedDB || globalThis.indexedDB || null
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('IndexedDB 请求失败'))
  })
}

async function openDatabase(options = {}) {
  const indexedDB = getIndexedDB(options)
  if (!indexedDB) return null
  const dbName = options.dbName || DEFAULT_DB_NAME
  const storeName = options.storeName || DEFAULT_STORE_NAME
  const request = indexedDB.open(dbName, 1)
  request.onupgradeneeded = () => {
    const db = request.result
    if (!db.objectStoreNames.contains(storeName)) {
      db.createObjectStore(storeName)
    }
  }
  return requestToPromise(request)
}

async function runStoreOperation(method, key, value, options = {}) {
  const db = await openDatabase(options)
  if (!db) return null
  const storeName = options.storeName || DEFAULT_STORE_NAME
  const tx = db.transaction(storeName, method === 'get' ? 'readonly' : 'readwrite')
  const store = tx.objectStore(storeName)
  const record = method === 'get'
    ? await requestToPromise(store.get(key))
    : await requestToPromise(store.put(value, key))
  return record || null
}

export async function getQhIdbRecord(key, options = {}) {
  if (!String(key || '').trim()) throw new Error('IndexedDB key 不能为空')
  return runStoreOperation('get', key, null, options)
}

export async function putQhIdbRecord(key, value, options = {}) {
  if (!String(key || '').trim()) throw new Error('IndexedDB key 不能为空')
  const record = {
    key,
    value,
    updatedAt: options.now ? options.now() : new Date().toISOString(),
  }
  await runStoreOperation('put', key, record, options)
  return record
}
