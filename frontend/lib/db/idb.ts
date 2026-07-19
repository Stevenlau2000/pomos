// lib/db/idb.ts
// IndexedDB 底层封装：类型安全的泛型 CRUD，事务安全。
// 仅暴露「按 store + key 读写」的最小原语；上层（studentStore）在此之上构建按生隔离语义。
// 设计约束（架构 §7）：DB 名 pomos_idb，version=1；store 定义在 schema.ts 单源。
import {
  DB_NAME,
  DB_VERSION,
  STORE_DEFS,
  type StoreName,
} from "./schema";

let dbPromise: Promise<IDBDatabase> | null = null;

/** 打开（或升级）数据库，结果缓存复用，避免重复握手。 */
export function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("当前环境不支持 IndexedDB"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const def of STORE_DEFS) {
        if (!db.objectStoreNames.contains(def.name)) {
          const store = db.createObjectStore(def.name, { keyPath: def.keyPath });
          for (const idx of def.indexes ?? []) {
            store.createIndex(idx.name, idx.keyPath, { unique: idx.unique ?? false });
          }
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB 打开失败"));
  });
  return dbPromise;
}

/** 读取单条记录（按主键）。 */
export async function idbGet<T>(store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  const db = await openDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
}

/** 写入（覆盖）单条记录。value 必须含 keyPath 字段。 */
export async function idbPut<T>(store: StoreName, value: T): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value as unknown as Record<string, unknown>);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 读取整个 store 的所有记录（用于 students 等小表）。 */
export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** 按二级索引查询（如 mistakes 按 student_id）。 */
export async function idbGetByIndex<T>(
  store: StoreName,
  index: string,
  value: IDBValidKey,
): Promise<T[]> {
  const db = await openDb();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const idx = tx.objectStore(store).index(index);
    const req = idx.getAll(value);
    req.onsuccess = () => resolve((req.result as T[]) ?? []);
    req.onerror = () => reject(req.error);
  });
}

/** 删除单条记录（按主键）。 */
export async function idbDelete(store: StoreName, key: IDBValidKey): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** 清空整个 store（用于批量重建 students 列表）。 */
export async function idbClear(store: StoreName): Promise<void> {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
