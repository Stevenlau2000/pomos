// test/offlineApi.test.ts
// 离线 API 测试：回归 ②（streamChat 透传 signal 中止）与 ⑤（PQ 单源推导），
// 并直接单测 M2 加固后导出的边界函数 pqFromTwin / buildMockFromTwin / twinToMap。
//
// M2（技术债 ⑤ 收尾）已将 pqFromTwin / buildMockFromTwin / twinToMap 显式 export，
// 因此可在不修改工程师实现文件的前提下，直接构造 Record<string,number> / NineDim[] 验证：
// 空 twin / 含 NaN / 含非数值字符串 均不抛异常，且 PQ 落在 [0, 0.99]。
// 公共 API 同源 / 确定性回归用例保留在下方 describe 块中。
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

// ================================================================ M2 边界直接单测（pqFromTwin 等已导出）
// 九维 key（与 offlineApi.ts 引入的 NINE_DIMS 集合一致；pqFromTwin 按此顺序迭代）
const NINE_DIM_KEYS = [
  "concept",
  "modeling",
  "reasoning",
  "calculation",
  "experiment",
  "transfer",
  "meta",
  "competition",
  "growth",
] as const;

describe("pqFromTwin 边界（M2 加固直接单测）", () => {
  it("空 twin {} 不抛异常，返回 baseline 0.2 且落在 [0, 0.99]", () => {
    let threw = false;
    let pq = 0;
    try {
      pq = Offline.pqFromTwin({});
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(pq).toBeGreaterThanOrEqual(0);
    expect(pq).toBeLessThanOrEqual(0.99);
    // 9 维均缺省→按 0 计，mean = 0 → 0.2 + 0.8 * 0 = 0.2（baseline）
    expect(pq).toBeCloseTo(0.2, 6);
  });

  it("含 NaN 的 twin：不抛异常，NaN 维按 0 计入（与 0.2+0.8*mean 对齐）", () => {
    const twin: Record<string, number> = {
      concept: 0.5,
      modeling: 0.5,
      reasoning: 0.5,
      calculation: 0.5,
      experiment: 0.5,
      transfer: 0.5,
      meta: 0.5,
      competition: 0.5,
      growth: NaN,
    };
    let threw = false;
    let pq = 0;
    try {
      pq = Offline.pqFromTwin(twin);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    // NaN 维归 0：sum = 8 * 0.5 = 4，mean = 4 / 9
    const expected = 0.2 + 0.8 * (4 / 9);
    expect(pq).toBeCloseTo(Number(expected.toFixed(6)), 6);
    expect(pq).toBeGreaterThanOrEqual(0);
    expect(pq).toBeLessThanOrEqual(0.99);
  });

  it("含非数值字符串的 twin：不抛异常，字符串维 Number()=NaN → 归 0", () => {
    const twin = {
      concept: 0.5,
      modeling: 0.5,
      reasoning: 0.5,
      calculation: 0.5,
      experiment: 0.5,
      transfer: 0.5,
      meta: 0.5,
      competition: 0.5,
      growth: "abc",
    } as unknown as Record<string, number>;
    let threw = false;
    let pq = 0;
    try {
      pq = Offline.pqFromTwin(twin);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    // "abc" → Number("abc") = NaN → 归 0，与 NaN 维同处理
    const expected = 0.2 + 0.8 * (4 / 9);
    expect(pq).toBeCloseTo(Number(expected.toFixed(6)), 6);
  });

  it("确定性：同 twin 两次调用结果完全一致（deepEqual）", () => {
    const twin: Record<string, number> = {
      concept: 0.6,
      modeling: 0.7,
      reasoning: 0.5,
      calculation: 0.8,
      experiment: 0.4,
      transfer: 0.3,
      meta: 0.5,
      competition: 0.2,
      growth: 0.6,
    };
    expect(Offline.pqFromTwin(twin)).toBe(Offline.pqFromTwin(twin));
  });
});

describe("buildMockFromTwin 边界（M2 加固直接单测）", () => {
  const emptyTwin: Array<{ key: string; label: string; value: number; hint: string }> = [];

  it("空 twin [] 不抛异常，且返回含有限 pq 的对象", () => {
    let threw = false;
    let data: ReturnType<typeof Offline.buildMockFromTwin> | null = null;
    try {
      data = Offline.buildMockFromTwin("qa-bmt-empty", emptyTwin);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(data).not.toBeNull();
    expect(typeof data!.pq).toBe("number");
    expect(Number.isFinite(data!.pq)).toBe(true);
    expect(data!.pq).toBeGreaterThanOrEqual(0);
    expect(data!.pq).toBeLessThanOrEqual(0.99);
  });

  it("含 NaN 值的 twin 不抛异常，且 pq 仍为有限值（NaN 维被 pqFromTwin 归 0）", () => {
    const twin = NINE_DIM_KEYS.map((k) => ({
      key: k,
      label: k,
      value: k === "concept" ? NaN : 0.5,
      hint: "",
    }));
    let threw = false;
    let data: ReturnType<typeof Offline.buildMockFromTwin> | null = null;
    try {
      data = Offline.buildMockFromTwin("qa-bmt-nan", twin);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(data).not.toBeNull();
    expect(typeof data!.pq).toBe("number");
    expect(Number.isFinite(data!.pq)).toBe(true);
  });
});
