// lib/db/schema.ts
// IndexedDB 对象仓库（object store）schema 定义与升级逻辑。
// 单源：DB 名、版本、各 store 的 name / keyPath / index。
// 设计约束（架构 §7）：DB 名 pomos_idb，version=1；store 含
// students / twin / mistakes / chat_history / knowledge_base / settings / meta。

export const DB_NAME = "pomos_idb";
export const DB_VERSION = 1;

export const STORE = {
  students: "students",
  twin: "twin",
  mistakes: "mistakes",
  chat_history: "chat_history",
  knowledge_base: "knowledge_base",
  settings: "settings",
  meta: "meta",
} as const;

export type StoreName = (typeof STORE)[keyof typeof STORE];

// 各 store 的 keyPath 与索引定义，供 onupgradeneeded 建表（幂等）。
export const STORE_DEFS: Array<{
  name: string;
  keyPath: string;
  indexes?: Array<{ name: string; keyPath: string; unique?: boolean }>;
}> = [
  { name: STORE.students, keyPath: "student_id" },
  { name: STORE.twin, keyPath: "student_id" },
  {
    name: STORE.mistakes,
    keyPath: "id",
    indexes: [{ name: "student_id", keyPath: "student_id" }],
  },
  { name: STORE.chat_history, keyPath: "student_id" },
  {
    name: STORE.knowledge_base,
    keyPath: "doc_id",
    indexes: [{ name: "student_id", keyPath: "student_id" }],
  },
  { name: STORE.settings, keyPath: "key" },
  { name: STORE.meta, keyPath: "key" },
];

// 在升级回调里按定义建表（已存在则跳过，可重复调用）。
export function createStores(db: IDBDatabase): void {
  for (const def of STORE_DEFS) {
    if (!db.objectStoreNames.contains(def.name)) {
      const store = db.createObjectStore(def.name, { keyPath: def.keyPath });
      for (const idx of def.indexes ?? []) {
        store.createIndex(idx.name, idx.keyPath, { unique: idx.unique ?? false });
      }
    }
  }
}
