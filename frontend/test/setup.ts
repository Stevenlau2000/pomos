// test/setup.ts
// Vitest 在 Node 环境运行，原生无 IndexedDB。引入 fake-indexeddb/auto
// 为全局注入内存版 indexedDB，使离线 API（studentStore → idb → IndexedDB）
// 的单元/集成测试可在 Node 中正常读写（按 student_id 隔离逻辑得以验证）。
import "fake-indexeddb/auto";
