import { describe, it, expect, vi } from "vitest";
import { streamChat } from "@/lib/offlineApi";

// 可控制 explainChat 的返回值，用于验证失败降级路径。
vi.mock("@/lib/explain", async () => {
  const actual = await vi.importActual("@/lib/explain");
  return {
    ...(actual as object),
    explainChat: vi.fn(),
  };
});

import { explainChat } from "@/lib/explain";

const mockedExplainChat = vi.mocked(explainChat);

function makeHandlers() {
  return {
    onDelta: vi.fn(),
    onExplain: vi.fn(),
    onMeta: vi.fn(),
    onAssessment: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
  };
}

describe("streamChat explain 路径回归（斜抛）", () => {
  it("正常路径：斜抛运动为什么水平方向匀速 应触发 onExplain 结构化讲解", async () => {
    mockedExplainChat.mockReset();
    // 让 explainChat 走真实实现（恢复默认行为）
    mockedExplainChat.mockImplementation(
      async (input, handlers) => {
        const { generateExplain } = await import("@/lib/explain");
        const explain = await generateExplain(input.message, input.student_id);
        handlers.onExplain?.(explain);
        return explain;
      },
    );

    const h = makeHandlers();
    await streamChat({ student_id: "stu_repro_1", message: "斜抛运动为什么水平方向匀速" }, h);

    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onExplain).toHaveBeenCalled();
    const explain = h.onExplain.mock.calls[0][0];
    expect(explain.title).toBeTruthy();
    expect(explain.steps.length).toBe(6);
    const img = explain.steps.find((s: any) => s.phase === "图像分析");
    expect(img?.diagram?.kind).toBe("trajectory");
    expect(img?.animation?.type).toBe("projectile");
  });

  it("explainChat 返回 null 时：应降级到离线结构化讲解，仍触发 onExplain（不回落到通用离线教练）", async () => {
    mockedExplainChat.mockReset();
    mockedExplainChat.mockResolvedValue(null);

    const h = makeHandlers();
    await streamChat({ student_id: "stu_repro_2", message: "斜抛运动为什么水平方向匀速" }, h);

    expect(h.onError).not.toHaveBeenCalled();
    expect(h.onExplain).toHaveBeenCalled();
    const explain = h.onExplain.mock.calls[0][0];
    expect(explain.mode).toBe("offline");
    expect(explain.offline_fallback).toBe(true);
    expect(explain.steps.length).toBe(6);
  });
});
