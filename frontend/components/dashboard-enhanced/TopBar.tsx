"use client";

import React from "react";
import { Sun, Moon, Settings, ChevronDown, Atom, GraduationCap } from "lucide-react";
import { useTheme } from "./ThemeProvider";

const students = [
  { id: "1", name: "张明远", grade: "高三" },
  { id: "2", name: "李思涵", grade: "高二" },
  { id: "3", name: "王宇航", grade: "高三" },
];

export default function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const [studentOpen, setStudentOpen] = React.useState(false);
  const [currentStudent, setCurrentStudent] = React.useState(students[0]);
  const [lang, setLang] = React.useState<"zh" | "en">("zh");

  return (
    <header className="h-16 px-6 flex items-center justify-between border-b border-border bg-topbar sticky top-0 z-50 animate-fade-in" style={{ backdropFilter: "blur(12px)", backgroundColor: "hsl(var(--sidebar) / 0.8)" }}>
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <Atom className="w-5 h-5 text-cyan-500" />
        </div>
        <div className="flex flex-col">
          <span className="font-display font-bold text-h3 leading-tight text-foreground">
            POMOS
          </span>
          <span className="text-caption text-muted-foreground leading-tight">
            {lang === "zh" ? "物理竞赛导师系统" : "Physics Olympiad Mentor OS"}
          </span>
        </div>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2">
        {/* Student Switcher */}
        <div className="relative">
          <button
            onClick={() => setStudentOpen(!studentOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border hover:border-cyan-500/30 transition-all duration-200 ease-out-quart"
          >
            <GraduationCap className="w-4 h-4 text-cyan-500" />
            <span className="text-sm font-medium text-foreground">
              {currentStudent.name}
            </span>
            <span className="text-caption text-muted-foreground">
              {currentStudent.grade}
            </span>
            <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${studentOpen ? "rotate-180" : ""}`} />
          </button>

          {studentOpen && (
            <div className="absolute top-full right-0 mt-2 w-56 rounded-xl bg-card border border-border shadow-lg py-2 z-50 animate-scale-in origin-top-right">
              <div className="px-3 py-2 text-caption text-muted-foreground uppercase tracking-wider">
                {lang === "zh" ? "切换学生" : "Switch Student"}
              </div>
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setCurrentStudent(s);
                    setStudentOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-secondary/50 ${
                    s.id === currentStudent.id ? "text-cyan-500" : "text-foreground"
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    s.id === currentStudent.id ? "bg-cyan-500/10 text-cyan-500" : "bg-secondary text-muted-foreground"
                  }`}>
                    {s.name[0]}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium">{s.name}</div>
                    <div className="text-caption text-muted-foreground">{s.grade}</div>
                  </div>
                  {s.id === currentStudent.id && (
                    <div className="w-2 h-2 rounded-full bg-cyan-500" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Language Toggle */}
        <button
          onClick={() => setLang(lang === "zh" ? "en" : "zh")}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all duration-150"
          title={lang === "zh" ? "Switch to English" : "切换为中文"}
        >
          {lang === "zh" ? "中" : "EN"}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all duration-150"
          title={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* Settings */}
        <button className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-all duration-150">
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
