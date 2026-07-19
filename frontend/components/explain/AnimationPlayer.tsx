// components/explain/AnimationPlayer.tsx
// 原理动画引擎：策略注册表（animation.type → RAF 渲染器）+ requestAnimationFrame 驱动。
// 设计要点：
//  • 首帧保底：挂载即渲染 progress=0 第一帧，无需点击也有静态图。
//  • 默认不自动播放：尊重 prefers-reduced-motion（直接停首帧）。
//  • 播放 / 暂停 / 重置控制；spec 切换时自动停止旧循环并复位。
"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { AnimationType, AnimationProps, AnimationSpec } from "@/lib/explain/types";

const REGISTRY: Partial<Record<AnimationType, React.ComponentType<AnimationProps>>> = {
  projectile: dynamic(
    () => import("./animations/ProjectileAnim").then((m) => m.ProjectileAnim),
    { ssr: false },
  ),
  "uniform-motion": dynamic(
    () => import("./animations/UniformMotionAnim").then((m) => m.UniformMotionAnim),
    { ssr: false },
  ),
  wave: dynamic(() => import("./animations/WaveAnim").then((m) => m.WaveAnim), {
    ssr: false,
  }),
  "charge-in-field": dynamic(
    () => import("./animations/ChargeInFieldAnim").then((m) => m.ChargeInFieldAnim),
    { ssr: false },
  ),
  refraction: dynamic(
    () => import("./animations/RefractionAnim").then((m) => m.RefractionAnim),
    { ssr: false },
  ),
};

export const AnimationPlayer: React.FC<{ spec: AnimationSpec }> = ({ spec }) => {
  const Cmp = REGISTRY[spec.type];
  const [progress, setProgress] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const rafRef = React.useRef<number | null>(null);
  const startRef = React.useRef<number>(0);
  const reducedRef = React.useRef(false);

  const duration = spec.durationMs && spec.durationMs > 0 ? spec.durationMs : 2400;

  React.useEffect(() => {
    if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
      reducedRef.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
  }, []);

  const stop = React.useCallback(() => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setPlaying(false);
  }, []);

  const tick = React.useCallback(
    (t: number) => {
      if (!startRef.current) startRef.current = t;
      const elapsed = t - startRef.current;
      setProgress((elapsed % duration) / duration);
      rafRef.current = requestAnimationFrame(tick);
    },
    [duration],
  );

  const play = React.useCallback(() => {
    // 默认不自动播放：尊重 prefers-reduced-motion，仅渲染首帧保底
    if (reducedRef.current) {
      setProgress(0);
      return;
    }
    startRef.current = 0;
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  // 挂载 / spec 切换：首帧保底，停止旧动画
  React.useEffect(() => {
    stop();
    setProgress(0);
    return () => stop();
  }, [spec, stop]);

  return (
    <div className="my-3 rounded-md border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">{spec.caption ?? "原理动画"}</span>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={playing ? stop : play}
            className="rounded border border-border px-2 py-0.5 text-[10px] transition-colors hover:border-brand hover:text-brand"
          >
            {playing ? "暂停" : "播放"}
          </button>
          <button
            type="button"
            onClick={() => {
              stop();
              startRef.current = 0;
              setProgress(0);
            }}
            className="rounded border border-border px-2 py-0.5 text-[10px] transition-colors hover:border-brand hover:text-brand"
          >
            重置
          </button>
        </div>
      </div>
      <div className="mt-2">
        {Cmp ? (
          <Cmp spec={spec} progress={progress} />
        ) : (
          <div className="text-xs text-destructive">未知动画类型：{spec.type}</div>
        )}
      </div>
    </div>
  );
};
