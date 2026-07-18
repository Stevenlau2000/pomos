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
  },
});
