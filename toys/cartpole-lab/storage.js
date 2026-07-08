const DB_NAME = "cartpole-lab";
const DB_VERSION = 1;
const STORE = "policyCheckpoints";
const BEST_ID = "best";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });

  return dbPromise;
}

async function withStore(mode, callback) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    let request;

    try {
      request = callback(store);
    } catch (error) {
      reject(error);
      return;
    }

    if (!request) {
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
      return;
    }

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
}

export async function saveBestPolicyCheckpoint(payload, config) {
  if (!payload?.checkpointBytes) return false;

  const record = {
    id: BEST_ID,
    kind: "best",
    saved_at: payload.saved_at ?? new Date().toISOString(),
    metrics: payload.metrics ?? null,
    config,
    checkpointBytes: payload.checkpointBytes,
    bytes: payload.checkpointBytes.byteLength ?? payload.bytes ?? 0,
    checkpointFormat: "cartpole-lab.policy.bytes.v1",
    storage: "IndexedDB"
  };

  await withStore("readwrite", (store) => store.put(record));
  return true;
}

export async function loadBestPolicyCheckpoint() {
  return await withStore("readonly", (store) => store.get(BEST_ID)) ?? null;
}

export async function clearBestPolicyCheckpoint() {
  await withStore("readwrite", (store) => store.delete(BEST_ID));
  return true;
}
