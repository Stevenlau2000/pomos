"use client";
import * as React from "react";
import { getDashboard, type Dashboard } from "./api";

export interface UseDashboardResult {
  dash: Dashboard | null;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * 拉取学生仪表盘数据的视图 hook（总览/孪生/诊断/图谱共用）。
 * 统一取代各处重复的「getDashboard + useState + useEffect + AbortController」样板，
 * 消除多视图重复实现导致的不一致。
 *
 * @param studentId  学生标识
 * @param refreshKey 外部刷新信号（父组件自增即可触发重新拉取）；默认 0
 */
export function useDashboard(studentId: string, refreshKey = 0): UseDashboardResult {
  const [dash, setDash] = React.useState<Dashboard | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [nonce, setNonce] = React.useState(0);

  const refresh = React.useCallback(() => setNonce((n) => n + 1), []);

  React.useEffect(() => {
    let alive = true;
    const ctrl = new AbortController();
    setLoading(true);
    getDashboard(studentId)
      .then((d) => alive && (setDash(d), setError(null)))
      .catch((e) => alive && setError(e instanceof Error ? e : new Error(String(e))))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
      ctrl.abort();
    };
  }, [studentId, refreshKey, nonce]);

  return { dash, loading, error, refresh };
}
