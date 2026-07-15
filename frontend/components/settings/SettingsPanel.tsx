// components/settings/SettingsPanel.tsx
// 设置面板：抽屉式弹窗，含 语言 / API 配置 / 学生 / 关于 四个分区。
// - 界面语言：立即生效（localStorage）。
// - 教练语言 + API：保存到后端 /api/settings，真正切换模型并持久化到 runtime_settings.json。
// - 学生信息：存 localStorage，顶栏即时更新。
"use client";

import * as React from "react";
import {
  X,
  Settings as SettingsIcon,
  Globe,
  KeyRound,
  User,
  Info,
  Check,
} from "lucide-react";
import {
  getSettings,
  putSettings,
  testConnection,
  updateStudent,
  createStudent,
  getApiMode,
  type SettingsResponse,
} from "@/lib/api";
import { useI18n, type Locale } from "@/lib/i18n";

const PROVIDER_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "自动探测（按已填密钥）" },
  { value: "openai", label: "OpenAI" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "qwen", label: "通义千问 (Qwen)" },
  { value: "moonshot", label: "Kimi (Moonshot)" },
  { value: "zhipu", label: "智谱 GLM (Zhipu)" },
  { value: "gemini", label: "Gemini" },
  { value: "anthropic", label: "Claude (Anthropic)" },
  { value: "custom", label: "自定义 (OpenAI 兼容)" },
];

function keyFieldFor(provider: string): keyof SettingsResponse {
  switch (provider) {
    case "openai":
      return "openai_api_key";
    case "deepseek":
      return "deepseek_api_key";
    case "qwen":
      return "dashscope_api_key";
    case "moonshot":
      return "moonshot_api_key";
    case "zhipu":
      return "zhipu_api_key";
    case "gemini":
      return "gemini_api_key";
    case "anthropic":
      return "anthropic_api_key";
    case "custom":
      return "llm_api_key";
    default:
      return "llm_api_key";
  }
}

interface SettingsPanelProps {
  open: boolean;
  onClose: () => void;
  backendVersion: string;
  mockMode: boolean;
  provider?: string;
  model?: string;
  studentId: string;
  student: { name: string; grade: string };
  onStudentChange: (s: { name: string; grade: string }) => void;
  onStudentIdChange: (id: string) => void;
  onSaved: () => void;
}

type Tab = "language" | "api" | "student" | "about";

const inputCls =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-brand";

export default function SettingsPanel(props: SettingsPanelProps) {
  const { t, lang, setLang } = useI18n();
  const [tab, setTab] = React.useState<Tab>("language");

  // API 表单
  const [provider, setProvider] = React.useState("auto");
  const [baseUrl, setBaseUrl] = React.useState("");
  const [apiKey, setApiKey] = React.useState("");
  const [model, setModel] = React.useState("");
  const [temperature, setTemperature] = React.useState(0.7);
  const [maxTokens, setMaxTokens] = React.useState(1200);
  const [coachLang, setCoachLang] = React.useState<Locale>(lang);

  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");
  const [msgType, setMsgType] = React.useState<"ok" | "err" | "">("");

  // 学生
  const [name, setName] = React.useState(props.student.name);
  const [grade, setGrade] = React.useState(props.student.grade);
  const [studentMsg, setStudentMsg] = React.useState("");

  // 测试连接
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState("");
  const [testOk, setTestOk] = React.useState<boolean | null>(null);

  // 加载后端配置
  React.useEffect(() => {
    if (!props.open) return;
    setMsg("");
    setMsgType("");
    setStudentMsg("");
    setName(props.student.name);
    setGrade(props.student.grade);
    getSettings()
      .then((s) => {
        setProvider(s.llm_provider || "auto");
        setBaseUrl(s.llm_base_url || "");
        setModel(s.llm_model || "");
        if (typeof s.llm_temperature === "number") setTemperature(s.llm_temperature);
        if (typeof s.llm_max_tokens === "number") setMaxTokens(s.llm_max_tokens);
        setCoachLang(((s.coach_language as Locale) || "zh"));
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.open]);

  const flash = (type: "ok" | "err", text: string) => {
    setMsgType(type);
    setMsg(text);
    if (typeof window !== "undefined") {
      window.setTimeout(() => setMsg(""), 2800);
    }
  };

  const handleSaveApi = async () => {
    // 前端校验（与后端 validate_settings 规则一致），非法时就地拦截
    if (provider === "custom") {
      if (!baseUrl.trim()) {
        flash("err", "自定义供应商必须填写 base_url");
        return;
      }
      if (!apiKey || apiKey === "••••") {
        flash("err", "自定义供应商必须填写 api_key");
        return;
      }
    }
    if (baseUrl.trim() && !/^https?:\/\//.test(baseUrl.trim())) {
      flash("err", "base_url 必须为合法的 http(s) URL");
      return;
    }
    if (temperature < 0 || temperature > 2) {
      flash("err", "温度须在 0 ~ 2 之间");
      return;
    }
    if (maxTokens < 100 || maxTokens > 32000) {
      flash("err", "最大 token 须在 100 ~ 32000 之间");
      return;
    }

    setSaving(true);
    const kf = keyFieldFor(provider);
    const body: Partial<SettingsResponse> = {
      llm_provider: provider === "auto" ? "" : provider,
      llm_base_url: provider === "custom" ? baseUrl.trim() : "",
      llm_model: model.trim(),
      llm_temperature: temperature,
      llm_max_tokens: maxTokens,
      coach_language: coachLang,
    };
    if (apiKey && apiKey !== "••••") {
      (body as Record<string, unknown>)[kf] = apiKey.trim();
    }
    try {
      await putSettings(body);
      setApiKey("");
      props.onSaved();
      flash(
        "ok",
        getApiMode() === "offline"
          ? "已离线保存（本地），配置后端并重新部署后生效"
          : t("settings.api.savedHint"),
      );
    } catch (e) {
      flash("err", String(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLang = async () => {
    try {
      await putSettings({ coach_language: coachLang });
      props.onSaved();
      flash(
        "ok",
        getApiMode() === "offline"
          ? "已离线保存（本地），配置后端并重新部署后生效"
          : t("settings.saved"),
      );
    } catch (e) {
      flash("err", String(e));
    }
  };

  const handleSaveStudent = async () => {
    const payload = { name: name.trim() || "学员", grade: grade.trim() };
    props.onStudentChange(payload);
    try {
      await updateStudent(props.studentId, payload);
      setStudentMsg(getApiMode() === "offline" ? "已保存到本地" : "已保存到后端 ✓");
    } catch {
      // 本地随机 id 在后端不存在时，创建真实学生并把新 id 同步回工作台
      try {
        const stu = await createStudent(payload);
        props.onStudentIdChange(stu.student_id);
        setStudentMsg("已创建学生并保存到后端 ✓");
      } catch {
        setStudentMsg("仅保存到本地（后端不可达）");
      }
    }
    if (typeof window !== "undefined") {
      window.setTimeout(() => setStudentMsg(""), 2800);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult("");
    setTestOk(null);
    try {
      const r = await testConnection();
      setTestOk(r.ok);
      setTestResult(r.detail);
    } catch (e) {
      setTestOk(false);
      setTestResult(String(e));
    } finally {
      setTesting(false);
    }
  };

  const handleClear = () => {
    if (typeof window === "undefined") return;
    if (!window.confirm(t("settings.about.clearConfirm"))) return;
    window.localStorage.removeItem("pomos_student_id");
    window.localStorage.removeItem("pomos_lang");
    window.localStorage.removeItem("pomos_student");
    setLang("zh");
    setStudentMsg(t("settings.about.clearDone"));
  };

  if (!props.open) return null;

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "language", label: t("settings.tab.language"), icon: <Globe className="h-4 w-4" /> },
    { key: "api", label: t("settings.tab.api"), icon: <KeyRound className="h-4 w-4" /> },
    { key: "student", label: t("settings.tab.student"), icon: <User className="h-4 w-4" /> },
    { key: "about", label: t("settings.tab.about"), icon: <Info className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={props.onClose}
        aria-hidden
      />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col bg-background shadow-xl">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5 text-brand" />
            <div className="leading-tight">
              <div className="text-sm font-semibold">{t("settings.title")}</div>
              <div className="text-[11px] text-muted-foreground">POMOS</div>
            </div>
          </div>
          <button
            onClick={props.onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={t("settings.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* tabs */}
        <div className="flex border-b border-border px-2">
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={
                "flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-medium transition-colors " +
                (tab === tb.key
                  ? "border-b-2 border-brand text-brand"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              {tb.icon}
              {tb.label}
            </button>
          ))}
        </div>

        {/* content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {tab === "language" && (
            <>
              <Section title={t("settings.language.ui")} desc={t("settings.language.uiDesc")}>
                <div className="flex gap-2">
                  <LangBtn active={lang === "zh"} onClick={() => setLang("zh")}>
                    {t("settings.language.zh")}
                  </LangBtn>
                  <LangBtn active={lang === "en"} onClick={() => setLang("en")}>
                    {t("settings.language.en")}
                  </LangBtn>
                </div>
              </Section>
              <Section title={t("settings.language.coach")} desc={t("settings.language.coachDesc")}>
                <div className="flex gap-2">
                  <LangBtn active={coachLang === "zh"} onClick={() => setCoachLang("zh")}>
                    {t("settings.language.zh")}
                  </LangBtn>
                  <LangBtn active={coachLang === "en"} onClick={() => setCoachLang("en")}>
                    {t("settings.language.en")}
                  </LangBtn>
                </div>
                <button
                  onClick={handleSaveLang}
                  className="mt-1 w-full rounded-md bg-brand px-4 py-2 text-sm font-medium text-brand-foreground"
                >
                  {t("settings.save")}
                </button>
              </Section>
            </>
          )}

          {tab === "api" && (
            <>
              <Field label={t("settings.api.provider")}>
                <select value={provider} onChange={(e) => setProvider(e.target.value)} className={inputCls}>
                  {PROVIDER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </Field>

              {provider === "custom" && (
                <Field label={t("settings.api.baseUrl")} hint={t("settings.api.baseUrlHint")}>
                  <input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://your-endpoint/v1"
                    className={inputCls}
                  />
                </Field>
              )}

              <Field label={t("settings.api.key")} hint={t("settings.api.keyHint")}>
                <input
                  type={apiKey ? "password" : "text"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className={inputCls}
                />
              </Field>

              <Field label={t("settings.api.model")} hint={t("settings.api.modelHint")}>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="deepseek-chat / gpt-4o ..."
                  className={inputCls}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label={t("settings.api.temp")}>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    value={temperature}
                    onChange={(e) => setTemperature(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
                <Field label={t("settings.api.maxTokens")}>
                  <input
                    type="number"
                    step="100"
                    min="100"
                    value={maxTokens}
                    onChange={(e) => setMaxTokens(Number(e.target.value))}
                    className={inputCls}
                  />
                </Field>
              </div>

              <button
                onClick={handleSaveApi}
                disabled={saving}
                className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground disabled:opacity-60"
              >
                {saving ? t("settings.saving") : t("settings.save")}
              </button>

              <button
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full rounded-md border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-60"
              >
                {testing ? "测试中…" : "测试连接"}
              </button>
              {testResult && (
                <p
                  className={
                    "text-[11px] leading-relaxed " +
                    (testOk ? "text-success" : "text-destructive")
                  }
                >
                  {testOk ? "✓ " : "✗ "}
                  {testResult}
                </p>
              )}
            </>
          )}

          {tab === "student" && (
            <>
              <Field label={t("settings.student.name")}>
                <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
              </Field>
              <Field label={t("settings.student.grade")}>
                <input
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  placeholder="高二 · 物理竞赛"
                  className={inputCls}
                />
              </Field>
              <button
                onClick={handleSaveStudent}
                className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-brand-foreground"
              >
                {t("settings.save")}
              </button>
              {studentMsg && <p className="text-xs text-success">{studentMsg}</p>}
            </>
          )}

          {tab === "about" && (
            <>
              <div className="space-y-2 rounded-md border border-border p-4 text-sm">
                <Row k={t("settings.about.version")} v="v0.1.0" />
                <Row k={t("settings.about.backend")} v={props.backendVersion || "-"} />
                <Row
                  k={t("settings.about.status")}
                  v={props.mockMode ? t("settings.about.statusMock") : t("settings.about.statusLive")}
                />
              </div>
              <button
                onClick={handleClear}
                className="w-full rounded-md border border-destructive/40 px-4 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                {t("settings.about.clear")}
              </button>
              <p className="text-[11px] leading-relaxed text-muted-foreground">{t("settings.about.note")}</p>
            </>
          )}
        </div>

        {/* footer 提示 */}
        {msg && (
          <div
            className={
              "border-t px-5 py-2.5 text-xs " +
              (msgType === "ok" ? "text-success" : "text-destructive")
            }
          >
            {msgType === "ok" && <Check className="mr-1 inline h-3.5 w-3.5" />}
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-medium">{title}</div>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function LangBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors " +
        (active
          ? "border-brand bg-brand/10 text-brand"
          : "border-border text-muted-foreground hover:bg-accent")
      }
    >
      {children}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}
