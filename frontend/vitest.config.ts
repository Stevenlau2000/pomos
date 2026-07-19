import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// 前端测试根目录（frontend/），用于解析 tsconfig 的 `@/*` 别名。
const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // 对应 tsconfig.json 的 "paths": { "@/*": ["./*"] }
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globals: false,
    // 在 Node 中注入内存版 IndexedDB（fake-indexeddb/auto），
    // 供 studentStore / offlineApi 的离线读写（按 student_id 隔离）测试使用。
    setupFiles: ["./test/setup.ts"],
  },
});
