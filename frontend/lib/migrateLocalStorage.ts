// lib/migrateLocalStorage.ts
// 一次性迁移：把旧版 offlineApi 写入 localStorage 的 pomos_offline_* 数据迁到 IndexedDB（按生隔离）。
// 成功后置 meta.migration_done；异常则置 meta.migration_failed（保留 localStorage 副本作兜底）。
// 仅在浏览器内有 localStorage 时执行；SSR / 无 window 时直接跳过。
import { idbGet, idbPut, idbGetAll, idbGetByIndex, idbClear } from "./db/idb";
import { STORE } from "./db/schema";
import { mergeBaseline, type TwinDimension } from "./twinSchema";
import type { ChatMessage, Mistake, Student } from "./api";

const OLD = {
  students: "pomos_offline_students",
  settings: "pomos_offline_settings",
  twin: (id: string) => `pomos_offline_twin_${id}`,
  mistakes: (id: string) => `pomos_offline_mistakes_${id}`,
  history: (id: string) => `pomos_offline_history_${id}`,
};

function lsGet(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsRemove(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

interface MigrateResult {
  migrated: boolean;
  reason: string;
}

/**
 * 执行迁移。force=true 时忽略 migration_done 标记强制重试。
 * 返回是否真正发生了迁移，便于页面决定是否提示。
 */
export async function migrateFromLocalStorage(force = false): Promise<MigrateResult> {
  // 无浏览器环境（SSR）直接跳过
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return { migrated: false, reason: "无浏览器环境，跳过迁移" };
  }

  const done = await idbGet<{ key: string; value: boolean }>(STORE.meta, "migration_done");
  if (done?.value && !force) {
    return { migrated: false, reason: "已迁移，跳过" };
  }

  try {
    let count = 0;

    // 1) students
    const studentsRaw = lsGet(OLD.students);
    if (studentsRaw) {
      try {
        const students = JSON.parse(studentsRaw) as Student[];
        if (Array.isArray(students) && students.length) {
          await idbClear(STORE.students);
          for (const s of students) await idbPut(STORE.students, s);
          count++;
        }
      } catch {
        /* ignore */
      }
      lsRemove(OLD.students);
    }

    // 2) settings（llm_* 明文配置迁移；密文 key 在后端不存在，这里仅迁移配置项）
    const settingsRaw = lsGet(OLD.settings);
    if (settingsRaw) {
      try {
        const s = JSON.parse(settingsRaw) as Record<string, unknown>;
        const target: Record<string, unknown> = {};
        for (const k of [
          "llm_provider",
          "llm_base_url",
          "llm_model",
          "llm_temperature",
          "llm_max_tokens",
          "coach_language",
        ]) {
          if (s[k] !== undefined) target[k] = s[k];
        }
        const cur = await idbGet<Record<string, unknown>>(STORE.settings, "global");
        await idbPut(STORE.settings, { key: "global", ...(cur ?? {}), ...target });
        count++;
      } catch {
        /* ignore */
      }
      lsRemove(OLD.settings);
    }

    // 3) 遍历所有旧 key，识别 twin / mistakes / history（按 id 后缀）
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) keys.push(k);
    }
    const ids = new Set<string>();
    for (const k of keys) {
      const m = k.match(/^pomos_offline_(twin|mistakes|history)_(.+)$/);
      if (m) ids.add(m[2]);
    }

    for (const id of ids) {
      // twin
      const twinRaw = lsGet(OLD.twin(id));
      if (twinRaw) {
        try {
          const twin = JSON.parse(twinRaw) as TwinDimension[];
          if (Array.isArray(twin)) {
            await idbPut(STORE.twin, { student_id: id, twin: mergeBaseline(twin) });
            count++;
          }
        } catch {
          /* ignore */
        }
        lsRemove(OLD.twin(id));
      }
      // mistakes
      const misRaw = lsGet(OLD.mistakes(id));
      if (misRaw) {
        try {
          const list = JSON.parse(misRaw) as Mistake[];
          if (Array.isArray(list)) {
            for (const m of list) await idbPut(STORE.mistakes, m);
            count++;
          }
        } catch {
          /* ignore */
        }
        lsRemove(OLD.mistakes(id));
      }
      // history
      const hisRaw = lsGet(OLD.history(id));
      if (hisRaw) {
        try {
          const msgs = JSON.parse(hisRaw) as ChatMessage[];
          if (Array.isArray(msgs)) {
            await idbPut(STORE.chat_history, { student_id: id, messages: msgs });
            count++;
          }
        } catch {
          /* ignore */
        }
        lsRemove(OLD.history(id));
      }
    }

    await idbPut(STORE.meta, { key: "migration_done", value: true });
    return { migrated: count > 0, reason: count > 0 ? `迁移 ${count} 类数据` : "无旧数据可迁移" };
  } catch (e) {
    await idbPut(STORE.meta, { key: "migration_failed", value: String(e) }).catch(() => undefined);
    return { migrated: false, reason: `迁移失败：${String(e)}` };
  }
}
