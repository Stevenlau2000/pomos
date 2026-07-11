/** @type {import('next').NextConfig} */
// 静态导出配置：用于部署到 GitHub Pages 等纯静态托管。
//
// 关键约束：GitHub Pages 只能托管静态前端，FastAPI 后端无法部署上去。
// 因此前端默认走「离线演示模式」（见 lib/offlineApi.ts）——在浏览器内用
// 物理教练启发式 + localStorage 持久化，测试人员打开即用，无需后端。
//
// 若要连接真实后端：部署时设置环境变量 NEXT_PUBLIC_API_BASE 指向后端地址，
// 前端会自动切回在线模式（否则探测 /api/health 失败即回退离线）。
//
// basePath / assetPrefix 在 CI（GitHub Actions）中由 GITHUB_REPOSITORY 注入，
// 本地 dev / build 时该变量为空，basePath 为空，资源路径保持根路径。

const repo = (process.env.GITHUB_REPOSITORY?.split("/")[1] || "").toLowerCase();
const basePath = repo ? `/${repo}` : "";

const nextConfig = {
  // 静态导出：生成纯 HTML/JS/CSS 到 out/，可托管任意静态服务器
  output: "export",
  // 静态导出不支持图片优化 API，关闭以使用原生 <img>
  images: { unoptimized: true },
  // 项目页子路径（如 https://user.github.io/pomos/）
  basePath,
  assetPrefix: basePath,
  reactStrictMode: true,
};

export default nextConfig;
