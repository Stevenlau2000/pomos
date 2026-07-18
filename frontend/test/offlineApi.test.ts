// test/offlineApi.test.ts
// 离线 API 集成测试：重点回归 ②（streamChat 透传 signal 中止）与 ⑤（PQ 单源推导）。
//
// 说明：pqFromTwin / buildMockFromTwin 为 offlineApi.ts 内部函数（未 export）。
// 受「不修改工程师实现文件」约束，本测试通过公共 API（getDashboard / buildStudentUpdate /
// streamChat）间接验证其确定性、范围与同源性质，未对源码做任何改动。
import { describe, it, expect, vi } from "vitest";
import * as Offline from "@/lib/offlineApi";

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, v));
}

describe("pqFromTwin（经公共 API 验证 ⑤ 单源推导）", () => {
  it("顶栏 PQ 与仪表盘 PQ 同源（buildStudentUpdate ≈ getDashboard）", async () => {
    const id = "qa-pq-src-1";
    const dash = await Offline.getDashboard(id);
    const upd = Offline.buildStudentUpdate(id);
    // 两者均来自 pqFromTwin(twinToMap(twin))，仅 buildStudentUpdate 多一次 toFixed(3) 取整
    expect(upd.pq).toBeCloseTo(dash.pq, 3);
  });

  it("PQ 落在 [0, 0.99] 且与 0.2 + 0.8*mean 手工计算一致", async () => {
    const id = "qa-pq-formula-1";
    const dash = await Offline.getDashboard(id);
    const mean =
      dash.twin.reduce((a, d) => a + d.value, 0) / (dash.twin.length || 1);
    const expected = clamp(0.2 + 0.8 * mean, 0, 0.99);
    expect(dash.pq).toBeGreaterThanOrEqual(0);
    expect(dash.pq).toBeLessThanOrEqual(0.99);
    expect(dash.pq).toBeCloseTo(Number(expected.toFixed(3)), 3);
  });
});

describe("buildMockFromTwin（经 getDashboard 验证确定性）", () => {
  it("同 studentId 两次调用结果完全一致（无随机抖动）", async () => {
    const id = "qa-deterministic-1";
    const a = await Offline.getDashboard(id);
    const b = await Offline.getDashboard(id);
    expect(b).toEqual(a);
  });

  it("growth_curve 末点 pq 与导出 pq 一致", async () => {
    const id = "qa-growth-1";
    const dash = await Offline.getDashboard(id);
    const last = dash.growth_curve[dash.growth_curve.length - 1];
    expect(last.pq).toBeCloseTo(dash.pq, 3);
  });
});

describe("streamChat 中止（回归 ② signal 透传）", () => {
  it("abort() 后调用 streamChat：onError 被调用且函数正常返回", async () => {
    const handlers = {
      onError: vi.fn(),
      onDelta: vi.fn(),
      onMeta: vi.fn(),
      onAssessment: vi.fn(),
      onDone: vi.fn(),
    };
    const ac = new AbortController();
    ac.abort(); // 调用前即中止
    const input = { message: "什么是动量守恒？", student_id: "qa-stream-abort" };
    await Offline.streamChat(input, handlers, ac.signal);
    expect(handlers.onError).toHaveBeenCalledWith("已取消生成");
    expect(handlers.onDelta).not.toHaveBeenCalled();
  });

  it("未中止时正常流式输出（onDelta 被调用、onError 不被调用）", async () => {
    const handlers = {
      onError: vi.fn(),
      onDelta: vi.fn(),
      onMeta: vi.fn(),
      onAssessment: vi.fn(),
      onDone: vi.fn(),
    };
    const input = { message: "请讲解一下机械能守恒", student_id: "qa-stream-ok" };
    await Offline.streamChat(input, handlers, undefined);
    expect(handlers.onDelta).toHaveBeenCalled();
    expect(handlers.onError).not.toHaveBeenCalled();
  });
});

describe("边界健壮性（公共 API 安全，代理验证 pqFromTwin 不抛异常）", () => {
  it("任意 studentId 调用 getDashboard 不抛异常、确定性且 PQ 在范围内", async () => {
    for (const id of ["", "guest", "local-guest", "qa-edge-1"]) {
      const a = await Offline.getDashboard(id);
      const b = await Offline.getDashboard(id);
      expect(b).toEqual(a); // 确定性
      expect(typeof a.pq).toBe("number");
      expect(Number.isNaN(a.pq)).toBe(false);
      expect(a.pq).toBeGreaterThanOrEqual(0);
      expect(a.pq).toBeLessThanOrEqual(0.99);
    }
  });
});
