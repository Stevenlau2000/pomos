// lib/i18n.tsx
// 轻量前端国际化：界面语言（zh/en）状态提升 + 字典 + Provider/hook。
// 语言偏好存 localStorage；仅覆盖框架级文案（导航/顶栏/设置/视图标题），
// 视图内的中文竞赛示例内容保持原样（POMOS 本身是中文母语产品）。
"use client";

import * as React from "react";

export type Locale = "zh" | "en";

type Entry = { zh: string; en: string };

export const DICT: Record<string, Entry> = {
  // ---- 侧边栏导航 ----
  "nav.chat": { zh: "对话辅导", en: "Chat Mentor" },
  "nav.chatDesc": { zh: "Socratic 导师对话", en: "Socratic dialogue" },
  "nav.overview": { zh: "能力总览", en: "Overview" },
  "nav.overviewDesc": { zh: "PQ · 雷达 · 曲线", en: "PQ · Radar · Curve" },
  "nav.twin": { zh: "数字孪生", en: "Student Twin" },
  "nav.twinDesc": { zh: "九维学生画像", en: "9-dim profile" },
  "nav.graph": { zh: "知识图谱", en: "Knowledge Graph" },
  "nav.graphDesc": { zh: "六层物理图谱", en: "6-layer graph" },
  "nav.diagnosis": { zh: "认知诊断", en: "Diagnosis" },
  "nav.diagnosisDesc": { zh: "PCDF 八层", en: "PCDF 8 layers" },
  "nav.training": { zh: "竞赛训练", en: "Training" },
  "nav.trainingDesc": { zh: "AOCS · ALOE", en: "AOCS · ALOE" },
  "nav.mistakes": { zh: "错题本", en: "Mistakes" },
  "nav.mistakesDesc": { zh: "归因与复盘", en: "Attribution" },
  "nav.modules": { zh: "模块地图", en: "Modules" },
  "nav.modulesDesc": { zh: "16 模块 / 五层", en: "16 modules / 5 layers" },
  "nav.settings": { zh: "设置", en: "Settings" },

  // ---- 顶栏 ----
  "topbar.pq": { zh: "物理商", en: "PQ" },
  "topbar.mock": { zh: "离线 Mock 模式", en: "Offline Mock" },
  "topbar.live": { zh: "模型已接入", en: "LLM Connected" },

  // ---- 设置面板 ----
  "settings.title": { zh: "设置", en: "Settings" },
  "settings.close": { zh: "关闭", en: "Close" },
  "settings.tab.language": { zh: "语言", en: "Language" },
  "settings.tab.api": { zh: "API 配置", en: "API" },
  "settings.tab.student": { zh: "学生", en: "Student" },
  "settings.tab.about": { zh: "关于", en: "About" },

  "settings.language.ui": { zh: "界面语言", en: "Interface Language" },
  "settings.language.uiDesc": {
    zh: "切换工作台显示语言（中文 / English）。",
    en: "Switch the workspace display language.",
  },
  "settings.language.coach": { zh: "教练回复语言", en: "Coach Reply Language" },
  "settings.language.coachDesc": {
    zh: "AI 导师回复所使用的语言；保存后下一次对话生效。",
    en: "Language used by the AI mentor; applies on next reply.",
  },
  "settings.language.zh": { zh: "中文", en: "中文" },
  "settings.language.en": { zh: "English", en: "English" },
  "settings.save": { zh: "保存", en: "Save" },
  "settings.saving": { zh: "保存中…", en: "Saving…" },
  "settings.saved": { zh: "已保存 ✓", en: "Saved ✓" },

  "settings.api.provider": { zh: "模型供应商", en: "Provider" },
  "settings.api.providerAuto": { zh: "自动探测（按已填密钥）", en: "Auto-detect" },
  "settings.api.baseUrl": { zh: "Base URL（自定义端点）", en: "Base URL (custom)" },
  "settings.api.baseUrlHint": {
    zh: "仅当供应商选择「自定义」时填写，例如 https://your-endpoint/v1",
    en: "Only for custom provider, e.g. https://your-endpoint/v1",
  },
  "settings.api.key": { zh: "API Key", en: "API Key" },
  "settings.api.keyHint": {
    zh: "留空则保留当前已保存的密钥；填写即覆盖。",
    en: "Leave blank to keep the saved key; fill to overwrite.",
  },
  "settings.api.model": { zh: "模型名称", en: "Model" },
  "settings.api.modelHint": {
    zh: "留空使用供应商默认模型；自定义端点请填写模型 ID。",
    en: "Blank = provider default; custom needs a model id.",
  },
  "settings.api.temp": { zh: "采样温度", en: "Temperature" },
  "settings.api.maxTokens": { zh: "最大 Token 数", en: "Max Tokens" },
  "settings.api.savedHint": {
    zh: "已写入后端并持久化，刷新顶部状态徽标可见新供应商。",
    en: "Persisted to backend; the top badge now reflects the new provider.",
  },

  "settings.student.name": { zh: "学生姓名", en: "Student Name" },
  "settings.student.grade": { zh: "年级 / 方向", en: "Grade / Track" },
  "settings.student.savedHint": {
    zh: "已保存到本地，立即在顶栏生效。",
    en: "Saved locally; reflected on the top bar now.",
  },

  "settings.about.version": { zh: "前端版本", en: "Frontend" },
  "settings.about.backend": { zh: "后端版本", en: "Backend" },
  "settings.about.status": { zh: "当前模型状态", en: "Model Status" },
  "settings.about.statusMock": { zh: "离线 Mock（未配置密钥）", en: "Offline Mock" },
  "settings.about.statusLive": { zh: "已接入真实模型", en: "Live LLM" },
  "settings.about.clear": { zh: "清空本地数据", en: "Clear Local Data" },
  "settings.about.clearConfirm": {
    zh: "将清除本机的学生 ID、语言与画像缓存，确定继续？",
    en: "Clear local student id, language and profile cache?",
  },
  "settings.about.clearDone": { zh: "已清空本地数据 ✓", en: "Local data cleared ✓" },
  "settings.about.note": {
    zh: "POMOS · 物理竞赛导师 OS v6.0，由 WorkBuddy 驱动。",
    en: "POMOS · Physics Olympiad Mentor OS v6.0, powered by WorkBuddy.",
  },

  // ---- 视图标题 ----
  "views.chat.title": { zh: "对话辅导", en: "Chat Mentor" },
  "views.chat.sub": {
    zh: "Socratic 引导 · 先物理图像后公式 · 回复底部展示推理路径",
    en: "Socratic guidance · physics first · reasoning trace appended",
  },
  "views.overview.title": { zh: "能力总览", en: "Capability Overview" },
  "views.overview.sub": {
    zh: "HPCAS 物理商（PQ）· 六维能力",
    en: "HPCAS Physics Quotient · 6-dim ability",
  },
  "views.twin.title": { zh: "学生数字孪生", en: "Student Digital Twin" },
  "views.twin.sub": {
    zh: "CMOS 实时维护的九维画像",
    en: "9-dim profile maintained by CMOS",
  },
  "views.graph.title": { zh: "物理知识图谱", en: "Physics Knowledge Graph" },
  "views.graph.sub": { zh: "六层物理知识网络", en: "6-layer physics network" },
  "views.diagnosis.title": { zh: "认知诊断", en: "Cognitive Diagnosis" },
  "views.diagnosis.sub": {
    zh: "PCDF 八层 · 认知 Bug 清单",
    en: "PCDF 8 layers · cognitive bug list",
  },
  "views.training.title": { zh: "竞赛训练编排", en: "Training Orchestration" },
  "views.training.sub": {
    zh: "AOCS 周期训练 × ALOE 今日优先级",
    en: "AOCS cycle × ALOE daily priority",
  },
  "views.mistakes.title": { zh: "错题本", en: "Wrong-Question Bank" },
  "views.mistakes.sub": {
    zh: "诊断归因 · 复发追踪 · 巩固复盘",
    en: "Attribution · recurrence · review",
  },
  "views.modules.title": { zh: "POMOS 模块地图", en: "POMOS Module Map" },
  "views.modules.sub": {
    zh: "16 模块 / 五层 · 星型编排",
    en: "16 modules / 5 layers · star orchestration",
  },
};

interface I18nContextValue {
  lang: Locale;
  setLang: (l: Locale) => void;
  t: (key: string) => string;
}

const I18nContext = React.createContext<I18nContextValue>({
  lang: "zh",
  setLang: () => {},
  t: (k: string) => k,
});

const STORAGE_KEY = "pomos_lang";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = React.useState<Locale>(() => {
    if (typeof window === "undefined") return "zh";
    return (window.localStorage.getItem(STORAGE_KEY) as Locale) || "zh";
  });

  const setLang = React.useCallback((l: Locale) => {
    setLangState(l);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, l);
      document.documentElement.lang = l === "zh" ? "zh-CN" : "en";
    }
  }, []);

  const t = React.useCallback(
    (key: string) => {
      const entry = DICT[key];
      if (!entry) return key;
      return entry[lang] || entry.zh;
    },
    [lang],
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  return React.useContext(I18nContext);
}
