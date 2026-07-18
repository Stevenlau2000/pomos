// lib/diag.ts
// 诊断分层状态元数据（健康 / 预警 / 风险）的单源定义。
// 从 DiagnosisView.tsx 的本地 statusMeta 迁移而来，供所有视图统一引用，避免映射漂移。

export interface DiagStatusMeta {
  label: string;
  color: string;
  desc: string;
}

/**
 * 把诊断分层状态（ok / warn / risk）映射为展示元数据。
 * 未知状态返回中性灰，保证调用方永不拿到 undefined。
 */
export function diagStatusMeta(tier: string): DiagStatusMeta {
  switch (tier) {
    case "ok":
      return { label: "健康", color: "#10b981", desc: "认知分层表现良好，无需特别干预" };
    case "warn":
      return { label: "预警", color: "#f59e0b", desc: "存在风险迹象，建议重点关注" };
    case "risk":
      return { label: "风险", color: "#ef4444", desc: "明显薄弱，需优先干预与训练" };
    default:
      return { label: "未知", color: "#94a3b8", desc: "状态未知" };
  }
}
