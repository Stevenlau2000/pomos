// lib/studentStore.ts
// 学生隔离数据访问层（单边界）：所有按 student_id 读写 twin / history / mistakes /
// knowledge_base / settings 一律经此模块，禁止在 UI 层直接拼接 localStorage / IndexedDB key。
// 密钥以 AES-GCM 加密（设备密钥存 meta），绝不存明文 localStorage。
import { idbGet, idbPut, idbGetAll, idbDelete, idbGetByIndex, idbClear } from "./db/idb";
import { STORE } from "./db/schema";
import { seedTwin, mergeBaseline, type TwinDimension } from "./twinSchema";
import type { ChatMessage, Mistake, Student } from "./api";

// ================================================================ Twin
type TwinRecord = { student_id: string; twin: TwinDimension[] };

/** 读取某生九维孪生；若无记录则播种 0.5 基线并持久化（保证刷新不丢、各生独立）。 */
export async function loadTwin(studentId: string): Promise<TwinDimension[]> {
  const rec = await idbGet<TwinRecord>(STORE.twin, studentId);
  if (rec && Array.isArray(rec.twin)) return mergeBaseline(rec.twin);
  const seeded = seedTwin(studentId, studentId);
  await saveTwin(studentId, seeded);
  return seeded;
}

/** 写回某生九维孪生（自动补齐缺失维度）。 */
export async function saveTwin(studentId: string, twin: TwinDimension[]): Promise<void> {
  await idbPut<TwinRecord>(STORE.twin, { student_id: studentId, twin: mergeBaseline(twin) });
}

// ================================================================ Chat History
type HistoryRecord = { student_id: string; messages: ChatMessage[] };

export async function loadHistory(studentId: string): Promise<ChatMessage[]> {
  const rec = await idbGet<HistoryRecord>(STORE.chat_history, studentId);
  return rec?.messages ?? [];
}

export async function saveHistory(studentId: string, msgs: ChatMessage[]): Promise<void> {
  await idbPut<HistoryRecord>(STORE.chat_history, { student_id: studentId, messages: msgs.slice(-200) });
}

// ================================================================ Mistakes
export async function loadMistakes(studentId: string): Promise<Mistake[]> {
  return idbGetByIndex<Mistake>(STORE.mistakes, "student_id", studentId);
}

export async function saveMistake(m: Mistake): Promise<void> {
  await idbPut<Mistake>(STORE.mistakes, m);
}

export async function saveMistakes(list: Mistake[]): Promise<void> {
  for (const m of list) await idbPut<Mistake>(STORE.mistakes, m);
}

export async function deleteMistakeById(id: string): Promise<void> {
  await idbDelete(STORE.mistakes, id);
}

export async function deleteMistakesByStudent(studentId: string): Promise<void> {
  const list = await loadMistakes(studentId);
  for (const m of list) await idbDelete(STORE.mistakes, m.id);
}

// ================================================================ Students
export async function loadStudents(): Promise<Student[]> {
  return idbGetAll<Student>(STORE.students);
}

export async function saveStudents(list: Student[]): Promise<void> {
  await idbClear(STORE.students);
  for (const s of list) await idbPut<Student>(STORE.students, s);
}

export async function upsertStudent(s: Student): Promise<void> {
  const list = await loadStudents();
  const i = list.findIndex((x) => x.student_id === s.student_id);
  if (i >= 0) list[i] = s;
  else list.push(s);
  await saveStudents(list);
}

export async function removeStudent(studentId: string): Promise<void> {
  const list = await loadStudents();
  await saveStudents(list.filter((s) => s.student_id !== studentId));
}

// ================================================================ Settings（含加密 LLM key）
export interface SettingsRecord {
  key: "global";
  llm_provider: string;
  llm_base_url: string;
  llm_model: string;
  llm_temperature: number;
  llm_max_tokens: number;
  coach_language: string;
  encryptedLlmKey?: string; // AES-GCM base64，绝不存明文
}

function defaultSettings(): SettingsRecord {
  return {
    key: "global",
    llm_provider: "",
    llm_base_url: "",
    llm_model: "",
    llm_temperature: 0.7,
    llm_max_tokens: 1200,
    coach_language: "zh",
  };
}

export async function loadSettings(): Promise<SettingsRecord> {
  const rec = await idbGet<SettingsRecord>(STORE.settings, "global");
  return { ...defaultSettings(), ...(rec ?? {}) };
}

export async function saveSettings(patch: Partial<SettingsRecord>): Promise<void> {
  const cur = await loadSettings();
  await idbPut<SettingsRecord>(STORE.settings, { ...cur, ...patch, key: "global" });
}

// ================================================================ AES-GCM 加密（设备密钥存 meta）
function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function getDeviceKey(): Promise<CryptoKey> {
  const existing = await idbGet<{ key: string; raw: ArrayBuffer }>(STORE.meta, "deviceKey");
  if (existing && existing.raw) {
    return crypto.subtle.importKey("raw", existing.raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  }
  const k = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const raw = await crypto.subtle.exportKey("raw", k);
  await idbPut(STORE.meta, { key: "deviceKey", raw });
  return k;
}

export async function encryptString(plain: string): Promise<string> {
  const key = await getDeviceKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plain),
  );
  const out = new Uint8Array(iv.length + enc.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(enc), iv.length);
  return bytesToB64(out);
}

export async function decryptString(b64: string): Promise<string> {
  const bytes = b64ToBytes(b64);
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const key = await getDeviceKey();
  const dec = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
  return new TextDecoder().decode(dec);
}

/** 加密保存 LLM key（覆盖式）。 */
export async function saveLlmKeyEncrypted(plain: string): Promise<void> {
  const enc = await encryptString(plain);
  await saveSettings({ encryptedLlmKey: enc });
}

/** 读取解密后的明文 key（仅运行时内存用，不落 localStorage）。 */
export async function loadLlmKeyPlain(): Promise<string> {
  const s = await loadSettings();
  if (!s.encryptedLlmKey) return "";
  try {
    return await decryptString(s.encryptedLlmKey);
  } catch {
    return "";
  }
}

// ================================================================ 删除某生全部数据（级联清理）
export async function deleteStudentData(studentId: string): Promise<void> {
  await idbDelete(STORE.twin, studentId);
  await idbDelete(STORE.chat_history, studentId);
  await deleteMistakesByStudent(studentId);
  const docs = await idbGetByIndex<{ doc_id: string }>(STORE.knowledge_base, "student_id", studentId);
  for (const d of docs) await idbDelete(STORE.knowledge_base, d.doc_id);
  await removeStudent(studentId);
}
