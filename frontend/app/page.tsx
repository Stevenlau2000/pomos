// app/page.tsx
// POMOS 导师工作台：侧边栏导航 + 顶栏 + 多视图主区 + 设置面板。
"use client";

import * as React from "react";
import Sidebar, { type ViewKey } from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import ChatView from "@/components/views/ChatView";
import OverviewView from "@/components/views/OverviewView";
import TwinView from "@/components/views/TwinView";
import GraphView from "@/components/views/GraphView";
import DiagnosisView from "@/components/views/DiagnosisView";
import TrainingView from "@/components/views/TrainingView";
import MistakesView from "@/components/views/MistakesView";
import ModulesView from "@/components/views/ModulesView";
import SettingsPanel from "@/components/settings/SettingsPanel";
import type { ChatMessage } from "@/components/chat/MessageBubble";
import {
  getHealth,
  getChatHistory,
  getDashboard,
  streamChat,
  createStudent,
  deleteStudent,
  detectApiMode,
  type StudentUpdate,
} from "@/lib/api";
import { I18nProvider } from "@/lib/i18n";
import { SAMPLE_PQ, type KGNode } from "@/lib/pomosData";

const STORAGE_KEY = "pomos_student_id";
const STUDENT_KEY = "pomos_student";

function getStudentId(): string {
  if (typeof window === "undefined") return "local-guest";
  let id = window.localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = `stu_${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}

function loadStudent(): { name: string; grade: string } {
  if (typeof window !== "undefined") {
    const raw = window.localStorage.getItem(STUDENT_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw);
        return { name: p.name || "小宇", grade: p.grade || "高二 · 物理竞赛" };
      } catch {
        /* ignore */
      }
    }
  }
  return { name: "小宇", grade: "高二 · 物理竞赛" };
}

const INITIAL_MESSAGES: ChatMessage[] = [
  { role: "user", content: "导师你好，我想了解我的物理能力短板。" },
  {
    role: "mentor",
    content:
      "你好！我们先做一轮快速诊断。\n\n核心公式之一：单摆小角近似周期 $$T = 2\\pi\\sqrt{\\frac{L}{g}}$$。\n\n请告诉我你最近一次模考的力学得分。",
    moduleTrace: [
      { module: "assessment", action: "diagnose", ts: "" },
      { module: "knowledge_graph", action: "recall", ts: "" },
    ],
  },
];

type HealthState = { mock: boolean; provider?: string; model?: string; version?: string };

export default function WorkspacePage() {
  return (
    <I18nProvider>
      <WorkspaceInner />
    </I18nProvider>
  );
}

function WorkspaceInner() {
  const [view, setView] = React.useState<ViewKey>("overview");
  const [studentId, setStudentId] = React.useState<string>(() => getStudentId());
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [messages, setMessages] = React.useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [loading, setLoading] = React.useState(false);
  const [health, setHealth] = React.useState<HealthState>({ mock: true });
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  // 后端不可达时为 true（GitHub Pages 等纯静态托管场景），显示离线演示提示
  const [offline, setOffline] = React.useState(false);
  // 最近一次对话的评估结果（驱动顶栏真实 PQ 与对话区「本次评估」卡片）
  const [lastUpdate, setLastUpdate] = React.useState<StudentUpdate | null>(null);
  const [student, setStudent] = React.useState<{ name: string; grade: string }>(
    () => loadStudent(),
  );

  // 拉取后端健康状态，反映真实模型接入情况（多供应商）
  React.useEffect(() => {
    refreshHealth();
    // 探测后端可达性：失败则切换离线演示模式（浏览器内物理教练 + localStorage）
    detectApiMode()
      .then((m) => setOffline(m === "offline"))
      .catch(() => setOffline(true));
  }, []);

  // 加载该学生的历史对话（后端持久化），有记录则覆盖初始示例
  React.useEffect(() => {
    getChatHistory(studentId)
      .then((h) => {
        const msgs = h.messages || [];
        if (msgs.length > 0) {
          setMessages(
            msgs.map((m) => ({
              role: m.role === "assistant" ? "mentor" : "user",
              content: m.content,
            })),
          );
        }
      })
      .catch(() => {
        /* 后端不可达时保留初始示例对话 */
      });
  }, [studentId]);

  const refreshHealth = () => {
    getHealth()
      .then((h) =>
        setHealth({
          mock: !!h.mock_mode,
          provider: h.llm_provider,
          model: h.llm_model,
          version: h.version,
        }),
      )
      .catch(() => setHealth({ mock: true }));
  };

  const handleSend = async (text: string) => {
    const userMsg: ChatMessage = { role: "user", content: text };
    const placeholder: ChatMessage = { role: "mentor", content: "" };
    setMessages((prev) => [...prev, userMsg, placeholder]);
    setLoading(true);
    try {
      await streamChat(
        { student_id: studentId, message: text },
        {
          onDelta: (t) => {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, content: last.content + t };
              return copy;
            });
          },
          onMeta: (m) => {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, moduleTrace: m.module_trace };
              return copy;
            });
          },
          onAssessment: (u) => {
            setMessages((prev) => {
              const copy = [...prev];
              const last = copy[copy.length - 1];
              copy[copy.length - 1] = { ...last, assessment: u };
              return copy;
            });
            setLastUpdate(u);
          },
          onDone: () => {
            setRefreshKey((k) => k + 1); // 画像/评估已变动，刷新数据视图
          },
          onError: (detail) => {
            setMessages((prev) => {
              const copy = [...prev];
              copy[copy.length - 1] = {
                role: "mentor",
                content: `⚠️ 连接导师失败：${detail}。请确认后端 http://localhost:8000 已启动。`,
              };
              return copy;
            });
          },
        },
      );
    } catch (e) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "mentor",
          content: `⚠️ 连接导师失败：${String(e)}。请确认后端 http://localhost:8000 已启动。`,
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  };

  const handleStudentChange = (s: { name: string; grade: string }) => {
    setStudent(s);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STUDENT_KEY, JSON.stringify(s));
    }
  };

  // 切换到已存在的学生：更新 localStorage 并载入其最新 PQ
  const handleSelectStudent = (id: string) => {
    setStudentId(id);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    getDashboard(id)
      .then((d) =>
        setLastUpdate({
          pq: d.pq,
          mastery_delta: {},
          weak_concepts: d.weak_concepts,
          recommendations: d.recommendations,
        }),
      )
      .catch(() => setLastUpdate(null));
  };

  // 新建学生：创建后直接切换到该学生
  const handleCreateStudent = (name: string, grade: string) => {
    createStudent({ name, grade })
      .then((stu) => {
        setStudentId(stu.student_id);
        const payload = { name: stu.name, grade: grade || "" };
        setStudent(payload);
        if (typeof window !== "undefined") {
          window.localStorage.setItem(STORAGE_KEY, stu.student_id);
          window.localStorage.setItem(STUDENT_KEY, JSON.stringify(payload));
        }
        setLastUpdate({
          pq: 0,
          mastery_delta: {},
          weak_concepts: [],
          recommendations: [],
        });
      })
      .catch(() => {
        /* 忽略：后端不可达时由切换器提示 */
      });
  };

  // 删除学生：若删除的是当前学生，回退到一个新的本地会话
  const handleDeleteStudent = (id: string) => {
    deleteStudent(id)
      .then(() => {
        if (id === studentId) {
          const nid = `stu_${Math.random().toString(36).slice(2, 10)}`;
          const def = { name: "小宇", grade: "高二 · 物理竞赛" };
          setStudentId(nid);
          setStudent(def);
          setLastUpdate(null);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, nid);
            window.localStorage.setItem(STUDENT_KEY, JSON.stringify(def));
          }
        }
      })
      .catch(() => {
        /* 忽略 */
      });
  };

  // 知识图谱节点「生成针对性训练」：跳转到对话视图，把该板块交给导师（在线/离线）生成梯度训练
  const handleGenerateTraining = (node: KGNode) => {
    setView("chat");
    handleSend(
      `请基于我的知识图谱，针对「${node.name}」（${node.board} 板块）为我生成一套针对性训练计划：` +
        `先建立物理图像，再上公式，包含 3–5 道由浅入深的梯度题，并标注易错点。`,
    );
  };

  const renderView = () => {
    switch (view) {
      case "chat":
        return <ChatView messages={messages} loading={loading} onSend={handleSend} />;
      case "overview":
        return <OverviewView studentId={studentId} refreshKey={refreshKey} />;
      case "twin":
        return <TwinView studentId={studentId} refreshKey={refreshKey} />;
      case "graph":
        return (
          <GraphView
            studentId={studentId}
            refreshKey={refreshKey}
            onGenerateTraining={handleGenerateTraining}
          />
        );
      case "diagnosis":
        return (
          <DiagnosisView
            studentId={studentId}
            refreshKey={refreshKey}
            onMistakeAdded={() => setRefreshKey((k) => k + 1)}
          />
        );
      case "training":
        return <TrainingView studentId={studentId} refreshKey={refreshKey} />;
      case "mistakes":
        return <MistakesView studentId={studentId} refreshKey={refreshKey} />;
      case "modules":
        return <ModulesView />;
      default:
        return <OverviewView studentId={studentId} refreshKey={refreshKey} />;
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      {offline && (
        <div className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-[11px] leading-relaxed text-amber-800">
          离线演示模式：未检测到后端，当前由浏览器内「物理教练」驱动，学生 / 错题 / 对话均保存在本地浏览器。
          如需真实 AI 辅导，请将后端部署到可访问地址并设置 <code>NEXT_PUBLIC_API_BASE</code> 后重新部署。
        </div>
      )}
      <div className="flex flex-1 overflow-hidden">
      <Sidebar active={view} onSelect={setView} onOpenSettings={() => setSettingsOpen(true)} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          studentId={studentId}
          studentName={student.name}
          grade={student.grade}
          pq={lastUpdate?.pq ?? SAMPLE_PQ}
          mock={health.mock}
          provider={health.provider}
          model={health.model}
          onOpenSettings={() => setSettingsOpen(true)}
          onSelectStudent={handleSelectStudent}
          onCreateStudent={handleCreateStudent}
          onDeleteStudent={handleDeleteStudent}
        />
        <main className="flex-1 overflow-hidden">{renderView()}</main>
      </div>

      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        backendVersion={health.version || "-"}
        mockMode={health.mock}
        provider={health.provider}
        model={health.model}
        studentId={studentId}
        student={student}
        onStudentChange={handleStudentChange}
        onStudentIdChange={(id) => {
          setStudentId(id);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, id);
          }
        }}
        onSaved={refreshHealth}
      />
    </div>
  );
}
