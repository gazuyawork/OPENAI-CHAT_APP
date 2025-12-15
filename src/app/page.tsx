// src/app/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { clearLocalAuth, getLocalAuth } from "@/lib/localAuth";

type Role = "user" | "assistant";

type ChatItem = {
  id: string;
  role: Role;
  text: string;
  createdAt: number; // epoch ms
  threadId: string;
};

type ApiResponse = {
  text?: string;
  error?: string;
  mode?: "mock" | "openai";
};

type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  systemPrompt: string; // プロジェクト既定プロンプト
};

type Thread = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  projectId: string | null; // null=単発
};

const STORAGE_KEY_MESSAGES = "openai_chat_app_messages_v2";
const STORAGE_KEY_PROJECTS = "openai_chat_app_projects_v1";
const STORAGE_KEY_THREADS = "openai_chat_app_threads_v1";
const STORAGE_KEY_ACTIVE_THREAD = "openai_chat_app_active_thread_v1";
const MODE_KEY = "openai_chat_app_last_mode_v1";

// ✅ テーマ永続化
const THEME_KEY = "openai_chat_app_theme_v1";
type ThemeMode = "light" | "dark";

// ✅ 連打防止：送信後に一定時間だけ次の送信を禁止（ms）
const SEND_COOLDOWN_MS = 1200;

// ✅ Undo猶予時間（ms）
const UNDO_WINDOW_MS = 5000;

// ✅ サイドメニュー幅
const SIDE_WIDTH = 360;

// ✅ アイコン（依存なし：最小SVG）
function Icon({
  name,
  size = 18,
}: {
  name:
    | "search"
    | "copy"
    | "json"
    | "download"
    | "close"
    | "edit"
    | "trash"
    | "chevLeft"
    | "upload"
    | "logout"
    | "sun"
    | "moon";
  size?: number;
}) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      );
    case "copy":
      return (
        <svg {...common}>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case "json":
      return (
        <svg {...common}>
          <path d="M8 3H6a2 2 0 0 0-2 2v2" />
          <path d="M16 3h2a2 2 0 0 1 2 2v2" />
          <path d="M8 21H6a2 2 0 0 1-2-2v-2" />
          <path d="M16 21h2a2 2 0 0 0 2-2v-2" />
          <path d="M9 9l-2 3 2 3" />
          <path d="M15 9l2 3-2 3" />
        </svg>
      );
    case "download":
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 10l5 5 5-5" />
          <path d="M12 15V3" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </svg>
      );
    case "edit":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
          <path d="M10 11v6" />
          <path d="M14 11v6" />
        </svg>
      );
    case "chevLeft":
      return (
        <svg {...common}>
          <path d="M15 18l-6-6 6-6" />
        </svg>
      );
    case "upload":
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <path d="M7 9l5-5 5 5" />
          <path d="M12 4v12" />
        </svg>
      );
    case "logout":
      return (
        <svg {...common}>
          <path d="M10 17l1 1h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-1 1" />
          <path d="M15 12H3" />
          <path d="M6 9l-3 3 3 3" />
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.93 4.93l1.41 1.41" />
          <path d="M17.66 17.66l1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M4.93 19.07l1.41-1.41" />
          <path d="M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M21 12.8A8.5 8.5 0 0 1 11.2 3a6.5 6.5 0 1 0 9.8 9.8z" />
        </svg>
      );
    default:
      return null;
  }
}

function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatTime(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ✅ エクスポート用：日付（ファイル名用）
function formatDate(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ✅ エクスポート用：日時（ヘッダ用）
function formatDateTime(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function safeParseMode(raw: string | null): "mock" | "openai" | "unknown" {
  if (!raw) return "unknown";
  if (raw === "mock") return "mock";
  if (raw === "openai") return "openai";
  return "unknown";
}

function normalizeForSearch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function safeParseJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeThreads(maybe: unknown): Thread[] {
  if (!Array.isArray(maybe)) return [];
  const out: Thread[] = [];
  for (const it of maybe as any[]) {
    if (!it || typeof it !== "object") continue;
    const id = typeof it.id === "string" ? it.id : "";
    const name = typeof it.name === "string" ? it.name : "";
    const createdAt = typeof it.createdAt === "number" ? it.createdAt : 0;
    const updatedAt = typeof it.updatedAt === "number" ? it.updatedAt : createdAt;
    const projectId =
      it.projectId === null || typeof it.projectId === "string" ? it.projectId : null;

    if (!id || !name || !createdAt) continue;

    out.push({
      id,
      name,
      createdAt,
      updatedAt,
      projectId,
    });
  }
  return out;
}

function normalizeProjects(maybe: unknown): Project[] {
  if (!Array.isArray(maybe)) return [];
  const out: Project[] = [];
  for (const it of maybe as any[]) {
    if (!it || typeof it !== "object") continue;
    const id = typeof it.id === "string" ? it.id : "";
    const name = typeof it.name === "string" ? it.name : "";
    const createdAt = typeof it.createdAt === "number" ? it.createdAt : 0;
    const updatedAt = typeof it.updatedAt === "number" ? it.updatedAt : createdAt;
    const systemPrompt = typeof it.systemPrompt === "string" ? it.systemPrompt : "";
    if (!id || !name || !createdAt) continue;
    out.push({ id, name, createdAt, updatedAt, systemPrompt });
  }
  return out;
}

function normalizeMessages(maybe: unknown): ChatItem[] {
  if (!Array.isArray(maybe)) return [];
  const out: ChatItem[] = [];
  for (const it of maybe as any[]) {
    if (!it || typeof it !== "object") continue;
    const id = typeof it.id === "string" ? it.id : "";
    const role = it.role === "user" || it.role === "assistant" ? (it.role as Role) : null;
    const text = typeof it.text === "string" ? it.text : "";
    const createdAt = typeof it.createdAt === "number" ? it.createdAt : 0;
    const threadId = typeof it.threadId === "string" ? it.threadId : "";
    if (!id || !role || !createdAt || !threadId) continue;
    out.push({ id, role, text, createdAt, threadId });
  }
  return out;
}

function safeParseTheme(raw: string | null): ThemeMode {
  if (raw === "dark") return "dark";
  return "light";
}

export default function Home() {
  const [input, setInput] = useState("");
  const [allMessages, setAllMessages] = useState<ChatItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastMode, setLastMode] = useState<"mock" | "openai" | "unknown">("unknown");

  // ✅ ログインユーザー（ローカル）
  const [localUserName, setLocalUserName] = useState<string>("");

  // ✅ テーマ
  const [theme, setTheme] = useState<ThemeMode>("light");

  // ✅ クールダウン残り時間（ms）
  const [cooldownLeft, setCooldownLeft] = useState(0);

  // ✅ 二重送信防止（同期的ガード）
  const inFlightRef = useRef(false);

  // 入力欄
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ✅ JSONインポート（会話全体）
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const importTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ✅ 検索（開閉式・デフォルト閉）
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // ✅ Undo用（最後に消した「末尾ブロック（1or2件）」を保持）
  const [undoState, setUndoState] = useState<{
    items: ChatItem[];
    expiresAt: number;
  } | null>(null);

  const undoTimerRef = useRef<number | null>(null);

  // ✅ 自動スクロール用：末尾アンカー
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // ✅ 編集機能：編集中のID / 入力テキスト（userメッセージのみ）
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const editTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ✅ 編集保存時に「以降削除＋再生成」するためのフラグ（UI表示に利用）
  const [editingWillRegenerate, setEditingWillRegenerate] = useState(false);

  // ✅ サイドメニュー：デフォルト開（オーバーレイ無し）
  const [sideCollapsed, setSideCollapsed] = useState(false);

  // ✅ プロジェクト／スレッド操作UI用
  const [newProjectName, setNewProjectName] = useState("");
  const [newThreadName, setNewThreadName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);

  const [selectedProjectIdForNewThread, setSelectedProjectIdForNewThread] = useState<
    string | "none"
  >("none");

  // ✅ プロジェクトのプロンプト編集：モーダル完結（直接入力＋ファイル＋D&D）
  const [projectPromptModalOpen, setProjectPromptModalOpen] = useState(false);
  const [promptTargetProjectId, setPromptTargetProjectId] = useState<string | null>(null);
  const [projectPromptDraft, setProjectPromptDraft] = useState("");
  const [projectPromptDirty, setProjectPromptDirty] = useState(false);
  const [promptDragOver, setPromptDragOver] = useState(false);
  const promptFileInputRef = useRef<HTMLInputElement | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // =========================
  // ✅ ログインガード（未ログインなら/login）
  // =========================
  useEffect(() => {
    const a = getLocalAuth();
    if (!a?.isAuthed) {
      window.location.href = "/login";
      return;
    }
    setLocalUserName(a.username ?? "");
  }, []);

  function handleLogout() {
    const ok = confirm("ログアウトしますか？（ローカルのログイン状態を削除します）");
    if (!ok) return;

    clearLocalAuth();

    // 画面側の状態も念のため初期化（localStorageの会話データは残す）
    setError("");
    setInput("");
    setCooldownLeft(0);
    inFlightRef.current = false;
    setUndoState(null);
    setEditingId(null);
    setEditingText("");
    setEditingWillRegenerate(false);

    window.location.href = "/login";
  }

  // =========================
  // ✅ テーマ復元・永続化
  // =========================
  useEffect(() => {
    const restored = safeParseTheme(localStorage.getItem(THEME_KEY));
    setTheme(restored);
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  // =========================
  // ✅ 初回ロード：localStorageから復元
  // =========================
  useEffect(() => {
    const restoredMessagesRaw = safeParseJson<unknown>(
      localStorage.getItem(STORAGE_KEY_MESSAGES),
      []
    );
    const restoredProjectsRaw = safeParseJson<unknown>(
      localStorage.getItem(STORAGE_KEY_PROJECTS),
      []
    );
    const restoredThreadsRaw = safeParseJson<unknown>(
      localStorage.getItem(STORAGE_KEY_THREADS),
      []
    );

    const restoredActiveThread = localStorage.getItem(STORAGE_KEY_ACTIVE_THREAD) ?? "";
    const restoredMode = safeParseMode(localStorage.getItem(MODE_KEY));

    const restoredMessages = normalizeMessages(restoredMessagesRaw);
    const restoredProjects = normalizeProjects(restoredProjectsRaw);
    const restoredThreads = normalizeThreads(restoredThreadsRaw);

    setAllMessages(restoredMessages);
    setProjects(restoredProjects);
    setThreads(restoredThreads);
    setLastMode(restoredMode);

    // ✅ 初期スレッドが無い場合は単発スレッドを作る
    if (restoredThreads.length === 0) {
      const now = Date.now();
      const t: Thread = {
        id: uid(),
        name: "単発スレッド",
        createdAt: now,
        updatedAt: now,
        projectId: null,
      };
      setThreads([t]);
      setActiveThreadId(t.id);
      localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify([t]));
      localStorage.setItem(STORAGE_KEY_ACTIVE_THREAD, t.id);
      return;
    }

    // ✅ activeThreadの復元（存在しなければ先頭）
    const exists = restoredThreads.some((t) => t.id === restoredActiveThread);
    const firstId = restoredThreads[0]?.id ?? "";
    const active = exists ? restoredActiveThread : firstId;
    setActiveThreadId(active);
    localStorage.setItem(STORAGE_KEY_ACTIVE_THREAD, active);
  }, []);

  // =========================
  // ✅ 永続化
  // =========================
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(allMessages));
  }, [allMessages]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(threads));
  }, [threads]);

  useEffect(() => {
    if (activeThreadId) {
      localStorage.setItem(STORAGE_KEY_ACTIVE_THREAD, activeThreadId);
    }
  }, [activeThreadId]);

  useEffect(() => {
    localStorage.setItem(MODE_KEY, lastMode);
  }, [lastMode]);

  // =========================
  // ✅ クールダウンのカウントダウン
  // =========================
  useEffect(() => {
    if (cooldownLeft <= 0) return;

    const t = window.setInterval(() => {
      setCooldownLeft((prev) => Math.max(0, prev - 100));
    }, 100);

    return () => window.clearInterval(t);
  }, [cooldownLeft]);

  // ✅ 会話JSONインポートモーダルを開いたらフォーカス
  useEffect(() => {
    if (!importOpen) return;
    requestAnimationFrame(() => {
      importTextareaRef.current?.focus();
    });
  }, [importOpen]);

  // ✅ 検索を開いたらフォーカス
  useEffect(() => {
    if (!searchOpen) return;
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }, [searchOpen]);

  // ✅ Undo期限監視
  useEffect(() => {
    if (!undoState) return;

    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    const now = Date.now();
    const left = Math.max(0, undoState.expiresAt - now);

    undoTimerRef.current = window.setTimeout(() => {
      setUndoState(null);
      undoTimerRef.current = null;
    }, left);

    return () => {
      if (undoTimerRef.current !== null) {
        window.clearTimeout(undoTimerRef.current);
        undoTimerRef.current = null;
      }
    };
  }, [undoState]);

  // ✅ 編集開始時にフォーカス
  useEffect(() => {
    if (!editingId) return;
    requestAnimationFrame(() => {
      editTextareaRef.current?.focus();
      const el = editTextareaRef.current;
      if (el) {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
  }, [editingId]);

  // =========================
  // ✅ アクティブスレッド／プロジェクト同期
  // =========================
  const activeThread = useMemo(() => {
    return threads.find((t) => t.id === activeThreadId) ?? null;
  }, [threads, activeThreadId]);

  const activeProject = useMemo(() => {
    if (!activeThread?.projectId) return null;
    return projects.find((p) => p.id === activeThread.projectId) ?? null;
  }, [projects, activeThread]);

  // =========================
  // ✅ 表示対象（アクティブスレッド）
  // =========================
  const threadMessages = useMemo(() => {
    if (!activeThreadId) return [];
    return allMessages
      .filter((m) => m.threadId === activeThreadId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [allMessages, activeThreadId]);

  // =========================
  // ✅ 末尾削除：Q&Aをセットで消す
  // =========================
  const tailDeleteInfo = useMemo(() => {
    if (threadMessages.length === 0) return { anchorId: "", ids: [] as string[] };

    const last = threadMessages[threadMessages.length - 1];
    const prev = threadMessages.length >= 2 ? threadMessages[threadMessages.length - 2] : null;

    // 末尾が assistant で、その直前が user なら 2件まとめて削除
    if (last.role === "assistant" && prev && prev.role === "user") {
      return { anchorId: last.id, ids: [prev.id, last.id] };
    }

    // 末尾が user のみ（まだ回答が無い等）
    return { anchorId: last.id, ids: [last.id] };
  }, [threadMessages]);

  function isTailAnchor(id: string) {
    return tailDeleteInfo.anchorId === id;
  }

  // =========================
  // ✅ 常に最下部まで自動スクロール
  // =========================
  useEffect(() => {
    requestAnimationFrame(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
  }, [threadMessages.length, loading, activeThreadId, sideCollapsed]);

  // =========================
  // ✅ 送信可否
  // =========================
  const canSend = useMemo(() => {
    return !loading && cooldownLeft === 0 && input.trim().length > 0 && !editingId;
  }, [loading, cooldownLeft, input, editingId]);

  const cooldownLabel = useMemo(() => {
    if (cooldownLeft <= 0) return "";
    const sec = Math.ceil(cooldownLeft / 1000);
    return `${sec}s`;
  }, [cooldownLeft]);

  // =========================
  // ✅ 検索フィルタ（表示のみ）
  // =========================
  const normalizedQuery = useMemo(() => normalizeForSearch(search), [search]);

  const filteredMessages = useMemo(() => {
    if (!normalizedQuery) return threadMessages;

    return threadMessages.filter((m) => {
      const text = normalizeForSearch(m.text);
      const who = m.role === "user" ? "あなた" : "ai";
      return text.includes(normalizedQuery) || who.includes(normalizedQuery);
    });
  }, [threadMessages, normalizedQuery]);

  function clearSearch() {
    setSearch("");
    requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
  }

  // =========================
  // ✅ API呼び出し（system prompt 付き）
  // =========================
  function buildSystemPrompt(): string {
    // ✅ スレッド上書きは廃止。プロジェクト既定のみ。
    if (activeProject && (activeProject.systemPrompt ?? "").trim()) {
      return activeProject.systemPrompt.trim();
    }
    return "";
  }

  async function callChatApi(userText: string) {
    const systemPrompt = buildSystemPrompt();

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        input: userText,
        systemPrompt,
        threadId: activeThreadId,
        projectId: activeThread?.projectId ?? null,
      }),
    });

    const data = (await res.json()) as ApiResponse;

    if (!res.ok) {
      throw new Error(data.error ?? "エラーが発生しました。");
    }

    const mode: "mock" | "openai" | "unknown" =
      data.mode === "mock" ? "mock" : data.mode === "openai" ? "openai" : "unknown";

    return { text: data.text ?? "", mode };
  }

  async function handleSend() {
    if (inFlightRef.current) return;

    if (!activeThreadId) {
      setError("スレッドが選択されていません。");
      return;
    }

    // ✅ 編集中は送信しない
    if (editingId) {
      setError("編集中は送信できません。編集を保存/キャンセルしてください。");
      return;
    }

    setError("");

    const q = input.trim();
    if (!q) {
      setError("入力してください。");
      return;
    }

    inFlightRef.current = true;
    setCooldownLeft(SEND_COOLDOWN_MS);

    const now = Date.now();
    const userItem: ChatItem = {
      id: uid(),
      role: "user",
      text: q,
      createdAt: now,
      threadId: activeThreadId,
    };

    setAllMessages((prev) => [...prev, userItem]);
    setInput("");

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });

    // スレッド更新日時
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThreadId ? { ...t, updatedAt: Date.now() } : t))
    );

    setLoading(true);
    try {
      const { text, mode } = await callChatApi(q);
      setLastMode(mode);

      const assistantItem: ChatItem = {
        id: uid(),
        role: "assistant",
        text,
        createdAt: Date.now(),
        threadId: activeThreadId,
      };
      setAllMessages((prev) => [...prev, assistantItem]);

      setThreads((prev) =>
        prev.map((t) => (t.id === activeThreadId ? { ...t, updatedAt: Date.now() } : t))
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
      setLastMode("unknown");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }

  // =========================
  // ✅ クリア（このスレッドだけ / 全体）
  // =========================
  function clearCurrentThreadMessages() {
    if (!activeThreadId) return;

    setError("");
    setInput("");
    setCooldownLeft(0);
    inFlightRef.current = false;
    setUndoState(null);

    setEditingId(null);
    setEditingText("");
    setEditingWillRegenerate(false);

    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    setAllMessages((prev) => prev.filter((m) => m.threadId !== activeThreadId));

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function clearAllData() {
    setError("");
    setInput("");
    setLastMode("unknown");
    setCooldownLeft(0);
    inFlightRef.current = false;
    setSearch("");
    setUndoState(null);

    setEditingId(null);
    setEditingText("");
    setEditingWillRegenerate(false);

    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    const now = Date.now();
    const t: Thread = {
      id: uid(),
      name: "単発スレッド",
      createdAt: now,
      updatedAt: now,
      projectId: null,
    };

    setProjects([]);
    setThreads([t]);
    setActiveThreadId(t.id);
    setAllMessages([]);
    setSearchOpen(false);

    setCreatingProject(false);
    setCreatingThread(false);

    setNewProjectName("");
    setNewThreadName("");
    setSelectedProjectIdForNewThread("none");

    // プロンプトモーダル系
    setProjectPromptModalOpen(false);
    setPromptTargetProjectId(null);
    setProjectPromptDraft("");
    setProjectPromptDirty(false);

    localStorage.removeItem(STORAGE_KEY_MESSAGES);
    localStorage.removeItem(STORAGE_KEY_PROJECTS);
    localStorage.removeItem(STORAGE_KEY_THREADS);
    localStorage.setItem(STORAGE_KEY_ACTIVE_THREAD, t.id);
    localStorage.removeItem(MODE_KEY);

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  // =========================
  // ✅ テキストエリア送信
  // =========================
  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) handleSend();
    }
  }

  // =========================
  // ✅ 末尾削除（Q&A同時） + Undo
  // =========================
  function removeTailBlock() {
    if (!activeThreadId) return;

    const ids = tailDeleteInfo.ids;
    if (ids.length === 0) return;

    // 編集中の対象が含まれるなら編集解除
    if (editingId && ids.includes(editingId)) {
      setEditingId(null);
      setEditingText("");
      setEditingWillRegenerate(false);
    }

    setAllMessages((prev) => {
      const removedItems = prev.filter(
        (m) => m.threadId === activeThreadId && ids.includes(m.id)
      );
      if (removedItems.length === 0) return prev;

      setUndoState({
        items: removedItems,
        expiresAt: Date.now() + UNDO_WINDOW_MS,
      });

      return prev.filter((m) => !ids.includes(m.id));
    });
  }

  function undoRemove() {
    if (!undoState) return;
    const items = undoState.items;

    setAllMessages((prev) => {
      const exists = new Set(prev.map((m) => m.id));
      const nextAdd = items.filter((x) => !exists.has(x.id));
      return [...prev, ...nextAdd].sort((a, b) => a.createdAt - b.createdAt);
    });

    setUndoState(null);

    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
  }

  const undoLeftLabel = useMemo(() => {
    if (!undoState) return "";
    const left = Math.max(0, undoState.expiresAt - Date.now());
    const sec = Math.ceil(left / 1000);
    return `${sec}s`;
  }, [undoState, threadMessages.length, loading, activeThreadId]);

  // =========================
  // ✅ 編集（自分の投稿だけ）＋ 保存時に「以降削除＋再生成」
  // =========================
  function startEdit(id: string) {
    if (loading) return;
    if (!activeThreadId) return;

    const target = threadMessages.find((m) => m.id === id);
    if (!target) return;

    if (target.role !== "user") {
      setError("AIの回答は編集できません。");
      return;
    }

    setEditingId(id);
    setEditingText(target.text);
    setEditingWillRegenerate(false);
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingText("");
    setEditingWillRegenerate(false);
    setError("");
  }

  async function saveEditAndRegenerate() {
    if (!editingId) return;
    if (!activeThreadId) return;

    const idx = threadMessages.findIndex((m) => m.id === editingId);
    if (idx < 0) {
      cancelEdit();
      return;
    }

    const target = threadMessages[idx];
    if (target.role !== "user") {
      setError("AIの回答は編集できません。");
      cancelEdit();
      return;
    }

    const editedUser: ChatItem = {
      ...target,
      text: editingText,
    };

    // 編集したメッセージ以降を削除
    const kept = threadMessages.slice(0, idx);
    const trimmedThread = [...kept, editedUser];

    setEditingWillRegenerate(true);
    setError("");
    setUndoState(null);
    if (undoTimerRef.current !== null) {
      window.clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }

    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setLoading(true);
    setCooldownLeft(SEND_COOLDOWN_MS);

    // allMessages を置き換え（当該threadのみ差し替え）
    setAllMessages((prev) => {
      const others = prev.filter((m) => m.threadId !== activeThreadId);
      return [...others, ...trimmedThread].sort((a, b) => a.createdAt - b.createdAt);
    });

    try {
      const { text, mode } = await callChatApi(editedUser.text);
      setLastMode(mode);

      const assistantItem: ChatItem = {
        id: uid(),
        role: "assistant",
        text,
        createdAt: Date.now(),
        threadId: activeThreadId,
      };

      setAllMessages((prev) => [...prev, assistantItem]);

      setThreads((prev) =>
        prev.map((t) => (t.id === activeThreadId ? { ...t, updatedAt: Date.now() } : t))
      );

      setEditingId(null);
      setEditingText("");
      setEditingWillRegenerate(false);

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
      setLastMode("unknown");
      setEditingWillRegenerate(false);
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
      return;
    }
    const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
    const ok = isMac ? e.metaKey && e.key === "Enter" : e.ctrlKey && e.key === "Enter";
    if (ok) {
      e.preventDefault();
      saveEditAndRegenerate();
    }
  }

  // =========================
  // ✅ エクスポート
  // =========================
  function exportAsText(): string {
    const exportedAt = Date.now();
    const modeLabel = lastMode === "mock" ? "MOCK" : lastMode === "openai" ? "LIVE" : "UNKNOWN";

    const headerLines = [
      "=== Chat Export ===",
      `exportedAt: ${formatDateTime(exportedAt)}`,
      `mode: ${modeLabel}`,
      `thread: ${activeThread?.name ?? "unknown"}`,
      `messages: ${threadMessages.length}`,
      "===================",
      "",
    ];

    const body = threadMessages
      .map((m) => {
        const who = m.role === "user" ? "あなた" : "AI";
        const len = m.text.length;
        return `【${who} ${formatTime(m.createdAt)} / ${len} chars】\n${m.text}`;
      })
      .join("\n\n");

    return headerLines.join("\n") + body;
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(exportAsText());
      alert("テキストをコピーしました。");
    } catch {
      alert("コピーに失敗しました。ブラウザの権限設定をご確認ください。");
    }
  }

  async function copyJson() {
    try {
      const exportedAt = Date.now();
      const payload = {
        exportedAt,
        exportedAtText: formatDateTime(exportedAt),
        mode: lastMode,
        activeThreadId,
        projects,
        threads,
        messages: allMessages,
      };
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      alert("JSONをコピーしました。");
    } catch {
      alert("コピーに失敗しました。ブラウザの権限設定をご確認ください。");
    }
  }

  function downloadText() {
    try {
      const blob = new Blob([exportAsText()], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat_${formatDate(Date.now())}_${lastMode}_${activeThread?.name ?? "thread"}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("ダウンロードに失敗しました。");
    }
  }

  // =========================
  // ✅ 会話JSONインポート
  // =========================
  function openImportModal() {
    setImportText("");
    setImportOpen(true);
  }

  function closeImportModal() {
    setImportOpen(false);
    setImportText("");
  }

  function commitImport() {
    if (!importText.trim()) {
      alert("JSONを貼り付けてください。");
      return;
    }

    try {
      const v = JSON.parse(importText) as unknown;

      // 新形式想定：{ projects, threads, messages, activeThreadId, mode }
      if (typeof v === "object" && v !== null) {
        const obj = v as any;

        const nextProjects = normalizeProjects(obj.projects);
        const nextThreads = normalizeThreads(obj.threads);
        const nextMessages = normalizeMessages(obj.messages);
        const nextMode = safeParseMode(typeof obj.mode === "string" ? obj.mode : null);
        const nextActive = typeof obj.activeThreadId === "string" ? obj.activeThreadId : "";

        if (nextThreads.length === 0) {
          alert("threads が空です。取り込みできません。");
          return;
        }

        const activeExists = nextThreads.some((t) => t.id === nextActive);
        const active = activeExists ? nextActive : nextThreads[0].id;

        setProjects(nextProjects);
        setThreads(nextThreads);
        setAllMessages(nextMessages);
        setActiveThreadId(active);
        setLastMode(nextMode);

        setError("");
        setCooldownLeft(0);
        inFlightRef.current = false;
        setUndoState(null);

        if (undoTimerRef.current !== null) {
          window.clearTimeout(undoTimerRef.current);
          undoTimerRef.current = null;
        }

        setEditingId(null);
        setEditingText("");
        setEditingWillRegenerate(false);

        // プロンプトモーダル系
        setProjectPromptModalOpen(false);
        setPromptTargetProjectId(null);
        setProjectPromptDraft("");
        setProjectPromptDirty(false);

        localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(nextProjects));
        localStorage.setItem(STORAGE_KEY_THREADS, JSON.stringify(nextThreads));
        localStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(nextMessages));
        localStorage.setItem(STORAGE_KEY_ACTIVE_THREAD, active);
        localStorage.setItem(MODE_KEY, nextMode);

        setImportOpen(false);
        setImportText("");
        setSearch("");
        setSearchOpen(false);

        requestAnimationFrame(() => {
          textareaRef.current?.focus();
        });

        alert("データをインポートしました。");
        return;
      }

      // 旧形式：messages 配列のみ
      if (Array.isArray(v)) {
        const now = Date.now();
        const t: Thread = {
          id: uid(),
          name: "インポートスレッド",
          createdAt: now,
          updatedAt: now,
          projectId: null,
        };

        const msgsRaw = v as any[];
        const msgs: ChatItem[] = [];
        for (const it of msgsRaw) {
          if (
            typeof it === "object" &&
            it !== null &&
            typeof it.id === "string" &&
            (it.role === "user" || it.role === "assistant") &&
            typeof it.text === "string" &&
            typeof it.createdAt === "number"
          ) {
            msgs.push({
              id: it.id,
              role: it.role,
              text: it.text,
              createdAt: it.createdAt,
              threadId: t.id,
            });
          }
        }

        setThreads((prev) => [t, ...prev]);
        setActiveThreadId(t.id);
        setAllMessages((prev) => [...msgs, ...prev]);
        setLastMode("unknown");
        setError("");
        setSearch("");
        setSearchOpen(false);

        alert("旧形式を取り込みました（単一スレッドとして追加）。");
        return;
      }

      alert("JSONの形式が不正です。");
    } catch {
      alert("JSONの形式が不正です。");
    }
  }

  function handleImportKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
    const ok = isMac ? e.metaKey && e.key === "Enter" : e.ctrlKey && e.key === "Enter";
    if (ok) {
      e.preventDefault();
      commitImport();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      closeImportModal();
    }
  }

  function onOverlayClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) {
      closeImportModal();
    }
  }

  // =========================
  // ✅ サイドメニュー：プロジェクト／スレッドCRUD
  // =========================
  function createProject() {
    const name = newProjectName.trim();
    if (!name) {
      setError("プロジェクト名を入力してください。");
      return;
    }
    const now = Date.now();
    const p: Project = {
      id: uid(),
      name,
      createdAt: now,
      updatedAt: now,
      systemPrompt: "",
    };
    setProjects((prev) => [p, ...prev]);
    setNewProjectName("");
    setCreatingProject(false);
    setError("");

    // 追加直後にプロンプト編集（モーダル）を開く
    openProjectPromptModal(p.id);
  }

  function renameProject(projectId: string, nextName: string) {
    const name = nextName.trim();
    if (!name) return;
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, name, updatedAt: Date.now() } : p))
    );
  }

  function deleteProject(projectId: string) {
    // プロジェクト削除：紐付くスレッドは projectId を null に戻す（データ保持）
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    setThreads((prev) =>
      prev.map((t) =>
        t.projectId === projectId ? { ...t, projectId: null, updatedAt: Date.now() } : t
      )
    );

    if (promptTargetProjectId === projectId) {
      closeProjectPromptModal();
    }
  }

  function createThread() {
    const name = newThreadName.trim() || "新規スレッド";
    const projectId = selectedProjectIdForNewThread === "none" ? null : selectedProjectIdForNewThread;

    const now = Date.now();
    const t: Thread = {
      id: uid(),
      name,
      createdAt: now,
      updatedAt: now,
      projectId,
    };

    setThreads((prev) => [t, ...prev]);
    setActiveThreadId(t.id);

    setNewThreadName("");
    setSelectedProjectIdForNewThread("none");
    setCreatingThread(false);
    setError("");

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  function renameThread(threadId: string, nextName: string) {
    const name = nextName.trim();
    if (!name) return;
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, name, updatedAt: Date.now() } : t))
    );
  }

  function deleteThread(threadId: string) {
    // スレッド削除：メッセージも削除
    setThreads((prev) => prev.filter((t) => t.id !== threadId));
    setAllMessages((prev) => prev.filter((m) => m.threadId !== threadId));

    // アクティブが消えたら別に切替
    if (activeThreadId === threadId) {
      const rest = threads.filter((t) => t.id !== threadId);
      const next = rest[0]?.id ?? "";
      if (next) setActiveThreadId(next);
    }
  }

  function selectThread(threadId: string) {
    if (loading) return;
    setActiveThreadId(threadId);
    setError("");
    setSearch("");
    setSearchOpen(false);
    cancelEdit();

    requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }

  // =========================
  // ✅ プロジェクトプロンプト：モーダル（直接入力＋ファイル＋D&D）
  // =========================
  function openProjectPromptModal(projectId: string) {
    const p = projects.find((x) => x.id === projectId) ?? null;
    if (!p) return;

    setPromptTargetProjectId(projectId);
    setProjectPromptDraft(p.systemPrompt ?? "");
    setProjectPromptDirty(false);
    setPromptDragOver(false);
    setProjectPromptModalOpen(true);

    requestAnimationFrame(() => {
      promptTextareaRef.current?.focus();
    });
  }

  function closeProjectPromptModal() {
    setProjectPromptModalOpen(false);
    setPromptTargetProjectId(null);
    setProjectPromptDraft("");
    setProjectPromptDirty(false);
    setPromptDragOver(false);
  }

  function saveProjectPrompt(projectId: string) {
    const next = projectPromptDraft;

    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, systemPrompt: next, updatedAt: Date.now() } : p))
    );

    setProjectPromptDirty(false);
    closeProjectPromptModal();
  }

  async function readPromptFileAsText(file: File): Promise<string> {
    // テキストとして読む（UTF-8想定）
    return await file.text();
  }

  async function importPromptFile(file: File) {
    try {
      const text = await readPromptFileAsText(file);

      // ✅ 併用：既存内容があれば末尾に追記（改行を適切に）
      setProjectPromptDraft((prev) => {
        const a = prev ?? "";
        const b = text ?? "";
        if (!a.trim()) return b;
        if (!b.trim()) return a;
        return `${a.replace(/\s+$/g, "")}\n\n${b.replace(/^\s+/g, "")}`;
      });

      setProjectPromptDirty(true);

      requestAnimationFrame(() => {
        promptTextareaRef.current?.focus();
      });
    } catch {
      alert("ファイルの読み込みに失敗しました。");
    }
  }

  function onPromptDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setPromptDragOver(true);
  }

  function onPromptDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setPromptDragOver(false);
  }

  async function onPromptDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setPromptDragOver(false);

    const f = e.dataTransfer?.files?.[0];
    if (!f) return;
    await importPromptFile(f);
  }

  function handlePromptModalKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      closeProjectPromptModal();
      return;
    }
    const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
    const ok = isMac ? e.metaKey && e.key === "Enter" : e.ctrlKey && e.key === "Enter";
    if (ok && promptTargetProjectId) {
      e.preventDefault();
      saveProjectPrompt(promptTargetProjectId);
    }
  }

  // =========================
  // ✅ スレッドリスト表示用（更新日時降順）
  // =========================
  const threadsSorted = useMemo(() => {
    return [...threads].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [threads]);

  const projectsSorted = useMemo(() => {
    return [...projects].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projects]);

  // =========================
  // ✅ 表示上の質問区切り強化：ユーザー投稿の直前に区切り線
  // =========================
  function shouldShowDivider(index: number, msgs: ChatItem[]) {
    if (index === 0) return false;
    const cur = msgs[index];
    const prev = msgs[index - 1];
    if (cur.role === "user" && prev.role === "assistant") return true;
    if (cur.role === "user" && prev.role === "user") return true;
    return false;
  }

  // =========================
  // ✅ UI用：適用中のプロンプト表示
  // =========================
  const systemPromptApplied = useMemo(() => {
    return buildSystemPrompt();
  }, [activeProject?.systemPrompt, activeThreadId, projects]);

  // =========================
  // ✅ 右上ボタン：崩れ防止（アイコン＋ラベル、狭い場合ラベル非表示）
  // =========================
  function TopActionButton(props: {
    onClick: () => void;
    disabled?: boolean;
    title: string;
    icon: React.ReactNode;
    label: string;
    variant?: "ghost" | "solid";
  }) {
    const { onClick, disabled, title, icon, label, variant = "ghost" } = props;
    return (
      <button
        onClick={onClick}
        disabled={!!disabled}
        className={`topBtn ${variant === "solid" ? "topBtnSolid" : ""}`}
        title={title}
        aria-label={title}
        type="button"
      >
        <span className="topBtnIcon" aria-hidden="true">
          {icon}
        </span>
        <span className="topBtnLabel">{label}</span>
      </button>
    );
  }

  // =========================
  // ✅ レイアウト：サイド除いた中央表示
  // =========================
  const sideWidth = sideCollapsed ? 0 : SIDE_WIDTH;

  const modeText = lastMode === "mock" ? "MOCK" : lastMode === "openai" ? "LIVE" : "MODE: ?";
  const modeClass =
    lastMode === "mock" ? "modeMock" : lastMode === "openai" ? "modeLive" : "modeUnknown";

  const themeIcon = theme === "dark" ? <Icon name="sun" size={18} /> : <Icon name="moon" size={18} />;
  const themeLabel = theme === "dark" ? "ライト" : "ダーク";
  const themeTitle = theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え";

  return (
    <div data-theme={theme} style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <style jsx>{`
        :global(:root) {
          --bg: #f5f7fb;
          --panel: #ffffff;
          --panelAlpha: rgba(255, 255, 255, 0.9);
          --panelAlpha2: rgba(255, 255, 255, 0.92);
          --panel2: #f8fafc;
          --panel3: #f1f5f9;
          --border: #d6dbe3;
          --border2: #e7ebf0;
          --text: #0f172a;
          --muted: #64748b;

          --primary: #2563eb;
          --primary2: #1d4ed8;
          --primarySoft: #eff6ff;
          --primaryBorder: #bfdbfe;

          --successSoft: #ecfdf5;
          --successBorder: #a7f3d0;
          --successText: #065f46;

          --warnSoft: #fff7ed;
          --warnBorder: #fed7aa;
          --warnText: #9a3412;

          --dangerSoft: #fef2f2;
          --dangerBorder: #fecaca;
          --dangerText: #b91c1c;

          --shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
          --shadow2: 0 6px 18px rgba(15, 23, 42, 0.06);

          --ring: 0 0 0 3px rgba(37, 99, 235, 0.18);

          /* 吹き出し系 */
          --msgUserBg: #f0f7ff;
          --msgUserBorder: #cfe3ff;
          --msgAiBg: var(--panel2);
          --msgAiBorder: var(--border2);
          --msgText: var(--text);
          --msgSubText: var(--muted);

          --divider: var(--border2);

          --dropBg: var(--panel2);
          --dropBorder: #cbd5e1;
          --dropActiveBg: #eef6ff;
          --dropActiveBorder: #93c5fd;

          --modalOverlay: rgba(2, 6, 23, 0.45);
        }

        /* ✅ ダークテーマ（data-themeで切替） */
        :global([data-theme="dark"]) {
          --bg: #0b1220;
          --panel: #0f172a;
          --panelAlpha: rgba(15, 23, 42, 0.88);
          --panelAlpha2: rgba(15, 23, 42, 0.9);
          --panel2: #111c33;
          --panel3: #0b1426;
          --border: #22314f;
          --border2: #1c2a46;
          --text: #e5e7eb;
          --muted: #94a3b8;

          --primary: #60a5fa;
          --primary2: #93c5fd;
          --primarySoft: rgba(96, 165, 250, 0.14);
          --primaryBorder: rgba(96, 165, 250, 0.35);

          --successSoft: rgba(16, 185, 129, 0.14);
          --successBorder: rgba(16, 185, 129, 0.35);
          --successText: #6ee7b7;

          --warnSoft: rgba(251, 146, 60, 0.14);
          --warnBorder: rgba(251, 146, 60, 0.35);
          --warnText: #fdba74;

          --dangerSoft: rgba(239, 68, 68, 0.14);
          --dangerBorder: rgba(239, 68, 68, 0.35);
          --dangerText: #fca5a5;

          --shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
          --shadow2: 0 6px 18px rgba(0, 0, 0, 0.25);

          --ring: 0 0 0 3px rgba(96, 165, 250, 0.22);

          --msgUserBg: rgba(96, 165, 250, 0.14);
          --msgUserBorder: rgba(96, 165, 250, 0.35);
          --msgAiBg: var(--panel2);
          --msgAiBorder: var(--border2);
          --msgText: var(--text);
          --msgSubText: var(--muted);

          --divider: var(--border2);

          --dropBg: var(--panel2);
          --dropBorder: var(--border2);
          --dropActiveBg: rgba(96, 165, 250, 0.12);
          --dropActiveBorder: rgba(96, 165, 250, 0.35);

          --modalOverlay: rgba(0, 0, 0, 0.6);
        }

        :global(body) {
          margin: 0;
          color: var(--text);
          background: var(--bg);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial,
            "Apple Color Emoji", "Segoe UI Emoji";
        }

        .appRoot {
          display: flex;
          min-height: 100vh;
          width: 100%;
          background: var(--bg);
        }

        .side {
          width: ${sideWidth}px;
          flex: 0 0 ${sideWidth}px;
          border-right: ${sideCollapsed ? "none" : "1px solid var(--border2)"};
          background: var(--panel);
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
          transition: width 180ms ease, flex-basis 180ms ease;
          z-index: 20;
          box-shadow: ${sideCollapsed ? "none" : "0 0 0 rgba(0,0,0,0)"};
        }

        .sideInner {
          height: 100%;
          padding: 12px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* ✅ 3分割（3:3:1） */
        .sideSplit {
          flex: 1 1 auto;
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .sideAreaTop {
          flex: 3 3 0;
          min-height: 0;
          overflow: auto;
        }

        .sideAreaMid {
          flex: 3 3 0;
          min-height: 0;
          overflow: auto;
        }

        .sideAreaBot {
          flex: 1 1 0;
          min-height: 0;
          overflow: auto;
        }

        .main {
          flex: 1 1 auto;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        .mainHeader {
          position: sticky;
          top: 0;
          z-index: 10;
          background: var(--panelAlpha);
          border-bottom: 1px solid var(--border2);
          backdrop-filter: blur(10px);
        }

        .mainHeaderRow {
          max-width: 1100px;
          margin: 0 auto;
          padding: 14px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .title {
          font-size: 18px;
          font-weight: 900;
          margin: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          letter-spacing: 0.2px;
        }

        .modePill {
          font-size: 12px;
          padding: 5px 10px;
          border: 1px solid var(--border);
          border-radius: 999px;
          white-space: nowrap;
          flex: 0 0 auto;
          font-weight: 800;
        }

        .modeMock {
          background: var(--primarySoft);
          border-color: var(--primaryBorder);
          color: var(--primary2);
        }
        .modeLive {
          background: var(--successSoft);
          border-color: var(--successBorder);
          color: var(--successText);
        }
        .modeUnknown {
          background: var(--panel2);
          border-color: var(--border);
          color: var(--text);
          opacity: 0.9;
        }

        .topActions {
          margin-left: auto;
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: nowrap;
          min-width: 0;
        }

        .topBtn {
          height: 38px;
          padding: 0 10px;
          border-radius: 12px;
          border: 1px solid var(--border);
          background: var(--panel);
          cursor: pointer;

          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          white-space: nowrap;
          flex: 0 0 auto;

          box-shadow: 0 0 0 rgba(0, 0, 0, 0);
          transition: background 120ms ease, border-color 120ms ease, transform 60ms ease, box-shadow 120ms ease;
          color: var(--text);
        }

        .topBtn:hover:not(:disabled) {
          background: var(--panel2);
          border-color: color-mix(in oklab, var(--border) 60%, var(--text) 10%);
        }

        .topBtn:active:not(:disabled) {
          transform: translateY(1px);
        }

        .topBtn:focus-visible {
          outline: none;
          box-shadow: var(--ring);
          border-color: var(--primaryBorder);
        }

        .topBtn:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .topBtnSolid {
          background: var(--primarySoft);
          border-color: var(--primaryBorder);
          font-weight: 900;
        }
        .topBtnSolid:hover:not(:disabled) {
          background: color-mix(in oklab, var(--primarySoft) 75%, var(--panel) 25%);
          border-color: var(--primaryBorder);
        }

        .topBtnIcon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 18px;
          height: 18px;
          flex: 0 0 18px;
        }

        .topBtnIcon :global(svg) {
          display: block;
        }

        .topBtnLabel {
          display: inline-flex;
          align-items: center;
          line-height: 1;
          font-size: 13px;
          font-weight: 800;
          color: var(--text);
        }

        @media (max-width: 720px) {
          .title {
            font-size: 16px;
          }
        }

        @media (max-width: 560px) {
          .topBtnLabel {
            display: none;
          }
          .topBtn {
            padding: 0 10px;
          }
        }

        .contentWrap {
          flex: 1 1 auto;
          display: flex;
          justify-content: center;
          padding: 16px 16px 110px 16px;
        }

        .contentInner {
          width: 100%;
          max-width: 900px;
        }

        .card {
          border: 1px solid var(--border2);
          border-radius: 16px;
          padding: 14px;
          min-height: 320px;
          background: var(--panel);
          box-shadow: var(--shadow2);
        }

        .pillSection {
          border: 1px solid var(--border2);
          border-radius: 16px;
          padding: 12px;
          background: var(--panel);
          box-shadow: var(--shadow2);
        }

        .sectionHeader {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }

        .sectionTitle {
          font-weight: 900;
          font-size: 13px;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 8px;
          letter-spacing: 0.2px;
        }

        .sectionNote {
          font-size: 11px;
          color: var(--muted);
          line-height: 1.4;
        }

        .miniBtn {
          width: 34px;
          height: 34px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--panel);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
          color: var(--text);
        }

        .miniBtn:hover:not(:disabled) {
          background: var(--panel2);
          border-color: color-mix(in oklab, var(--border) 60%, var(--text) 10%);
        }

        .miniBtn:focus-visible {
          outline: none;
          box-shadow: var(--ring);
          border-color: var(--primaryBorder);
        }

        .miniBtn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .msgHeadBtn {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          border: 1px solid var(--border);
          background: var(--panel);
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
          color: var(--text);
        }

        .msgHeadBtn:hover:not(:disabled) {
          background: var(--panel2);
          border-color: color-mix(in oklab, var(--border) 60%, var(--text) 10%);
        }

        .msgHeadBtn:focus-visible {
          outline: none;
          box-shadow: var(--ring);
          border-color: var(--primaryBorder);
        }

        .msgHeadBtn:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .inputBar {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 30;
          background: var(--panelAlpha2);
          border-top: 1px solid var(--border2);
          backdrop-filter: blur(10px);
        }

        .inputInner {
          max-width: 900px;
          margin: 0 auto;
          padding: 10px 16px;
          display: flex;
          gap: 8px;
          align-items: flex-end;
        }

        .modalOverlay {
          position: fixed;
          inset: 0;
          background: var(--modalOverlay);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 9999;
        }

        .modalBox {
          width: min(860px, 100%);
          background: var(--panel);
          border-radius: 14px;
          border: 1px solid var(--border2);
          box-shadow: var(--shadow);
          padding: 16px;
          color: var(--text);
        }

        .dropZone {
          border: 1px dashed var(--dropBorder);
          border-radius: 14px;
          padding: 12px;
          background: var(--dropBg);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .dropZoneActive {
          border-color: var(--dropActiveBorder);
          background: var(--dropActiveBg);
        }

        .dropText {
          font-size: 12px;
          color: var(--text);
          opacity: 0.9;
          line-height: 1.5;
        }
      `}</style>

      <div className="appRoot">
        {/* ===== サイドメニュー（デフォルト表示 / 折りたたみ可能） ===== */}
        <aside className="side" aria-hidden={sideCollapsed}>
          {!sideCollapsed && (
            <div className="sideInner">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "6px 6px 12px 6px",
                  borderBottom: "1px solid var(--border2)",
                  marginBottom: 12,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 16, color: "var(--text)" }}>メニュー</div>

                {/* ログインユーザー表示（ローカル） */}
                <div
                  style={{
                    marginLeft: 8,
                    fontSize: 12,
                    color: "var(--muted)",
                    fontWeight: 800,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 160,
                  }}
                  title={localUserName ? `ログイン中: ${localUserName}` : "ログイン中"}
                >
                  {localUserName ? `ログイン中: ${localUserName}` : "ログイン中"}
                </div>

                {/* ✅ テーマ切替（サイド内） */}
                <button
                  onClick={toggleTheme}
                  className="miniBtn"
                  title={themeTitle}
                  aria-label={themeTitle}
                >
                  {theme === "dark" ? <Icon name="sun" size={16} /> : <Icon name="moon" size={16} />}
                </button>

                <button
                  onClick={() => setSideCollapsed(true)}
                  className="miniBtn"
                  title="サイドメニューを折りたたむ"
                  aria-label="サイドメニューを折りたたむ"
                  style={{ marginLeft: "auto" }}
                >
                  <Icon name="chevLeft" size={18} />
                </button>
              </div>

              {/* ✅ 3分割（上=スレッド / 中=プロジェクト / 下=データ操作） */}
              <div className="sideSplit">
                {/* ===== 上：スレッド（3） ===== */}
                <div className="sideAreaTop">
                  {/* スレッド */}
                  <div className="pillSection">
                    <div className="sectionHeader">
                      <div>
                        <div className="sectionTitle">スレッド</div>
                        <div className="sectionNote">
                          会話の単位です。必要ならプロジェクト（プロンプト）に紐付けできます。
                        </div>
                      </div>
                    </div>

                    {!creatingThread ? (
                      <button
                        onClick={() => setCreatingThread(true)}
                        style={{
                          width: "100%",
                          height: 40,
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          background: "var(--panel)",
                          cursor: "pointer",
                          fontWeight: 800,
                          color: "var(--text)",
                        }}
                      >
                        + 新規スレッド
                      </button>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <input
                          value={newThreadName}
                          onChange={(e) => setNewThreadName(e.target.value)}
                          placeholder="スレッド名（未入力なら新規スレッド）"
                          style={{
                            height: 40,
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            padding: "0 10px",
                            background: "var(--panel)",
                            color: "var(--text)",
                          }}
                        />
                        <select
                          value={selectedProjectIdForNewThread}
                          onChange={(e) => setSelectedProjectIdForNewThread(e.target.value as any)}
                          style={{
                            height: 40,
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            padding: "0 10px",
                            background: "var(--panel)",
                            color: "var(--text)",
                          }}
                          title="紐付けるプロジェクト（任意）"
                        >
                          <option value="none">プロジェクトなし（単発）</option>
                          {projectsSorted.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => {
                              setCreatingThread(false);
                              setNewThreadName("");
                              setSelectedProjectIdForNewThread("none");
                            }}
                            style={{
                              flex: 1,
                              height: 40,
                              borderRadius: 12,
                              border: "1px solid var(--border)",
                              background: "var(--panel)",
                              cursor: "pointer",
                              fontWeight: 700,
                              color: "var(--text)",
                            }}
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={createThread}
                            style={{
                              flex: 1,
                              height: 40,
                              borderRadius: 12,
                              border: "1px solid var(--primaryBorder)",
                              background: "var(--primarySoft)",
                              cursor: "pointer",
                              fontWeight: 900,
                              color: "var(--primary2)",
                            }}
                          >
                            作成
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      {threadsSorted.map((t) => {
                        const isActive = t.id === activeThreadId;
                        const p = t.projectId ? projects.find((x) => x.id === t.projectId) : null;
                        return (
                          <div
                            key={t.id}
                            style={{
                              border: isActive
                                ? "1px solid var(--primaryBorder)"
                                : "1px solid var(--border2)",
                              background: isActive ? "var(--primarySoft)" : "var(--panel)",
                              borderRadius: 14,
                              padding: 10,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <button
                                onClick={() => selectThread(t.id)}
                                style={{
                                  flex: 1,
                                  textAlign: "left",
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  padding: 0,
                                  minWidth: 0,
                                  color: "var(--text)",
                                }}
                                title="このスレッドを開く"
                              >
                                <div
                                  style={{
                                    fontWeight: 900,
                                    fontSize: 14,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    color: "var(--text)",
                                  }}
                                >
                                  {t.name}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "var(--muted)",
                                    marginTop: 2,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {p ? `Project: ${p.name}` : "単発"} / {formatTime(t.updatedAt)}
                                </div>
                              </button>

                              <button
                                onClick={() => {
                                  const nextName = prompt("スレッド名を入力してください", t.name);
                                  if (nextName !== null) renameThread(t.id, nextName);
                                }}
                                className="miniBtn"
                                title="スレッド名を変更"
                                aria-label="スレッド名を変更"
                              >
                                <Icon name="edit" size={16} />
                              </button>

                              <button
                                onClick={() => {
                                  const ok = confirm(
                                    "このスレッドを削除しますか？（メッセージも削除されます）"
                                  );
                                  if (ok) deleteThread(t.id);
                                }}
                                className="miniBtn"
                                title="スレッドを削除"
                                aria-label="スレッドを削除"
                              >
                                <Icon name="trash" size={16} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ===== 中：プロジェクト（3） ===== */}
                <div className="sideAreaMid">
                  {/* プロジェクト */}
                  <div className="pillSection">
                    <div className="sectionHeader">
                      <div>
                        <div className="sectionTitle">プロジェクト（プロンプト）</div>
                        <div className="sectionNote">
                          プロジェクトは「system prompt」を保持します。スレッドに紐付けると、そのスレッドに適用されます。
                        </div>
                      </div>
                    </div>

                    {!creatingProject ? (
                      <button
                        onClick={() => setCreatingProject(true)}
                        style={{
                          width: "100%",
                          height: 40,
                          borderRadius: 12,
                          border: "1px solid var(--border)",
                          background: "var(--panel)",
                          cursor: "pointer",
                          fontWeight: 800,
                          color: "var(--text)",
                        }}
                      >
                        + 新規プロジェクト
                      </button>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <input
                          value={newProjectName}
                          onChange={(e) => setNewProjectName(e.target.value)}
                          placeholder="プロジェクト名"
                          style={{
                            height: 40,
                            borderRadius: 12,
                            border: "1px solid var(--border)",
                            padding: "0 10px",
                            background: "var(--panel)",
                            color: "var(--text)",
                          }}
                        />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            onClick={() => {
                              setCreatingProject(false);
                              setNewProjectName("");
                            }}
                            style={{
                              flex: 1,
                              height: 40,
                              borderRadius: 12,
                              border: "1px solid var(--border)",
                              background: "var(--panel)",
                              cursor: "pointer",
                              fontWeight: 700,
                              color: "var(--text)",
                            }}
                          >
                            キャンセル
                          </button>
                          <button
                            onClick={createProject}
                            style={{
                              flex: 1,
                              height: 40,
                              borderRadius: 12,
                              border: "1px solid var(--primaryBorder)",
                              background: "var(--primarySoft)",
                              cursor: "pointer",
                              fontWeight: 900,
                              color: "var(--primary2)",
                            }}
                          >
                            作成
                          </button>
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                      {projectsSorted.map((p) => {
                        return (
                          <div
                            key={p.id}
                            style={{
                              border: "1px solid var(--border2)",
                              borderRadius: 14,
                              padding: 10,
                              background: "var(--panel)",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontWeight: 900,
                                    fontSize: 14,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    color: "var(--text)",
                                  }}
                                >
                                  {p.name}
                                </div>
                                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                                  {formatTime(p.updatedAt)}
                                </div>
                              </div>

                              <button
                                onClick={() => {
                                  const nextName = prompt("プロジェクト名を入力してください", p.name);
                                  if (nextName !== null) renameProject(p.id, nextName);
                                }}
                                className="miniBtn"
                                title="プロジェクト名を変更"
                                aria-label="プロジェクト名を変更"
                              >
                                <Icon name="edit" size={16} />
                              </button>

                              {/* ✅ 編集ボタン押下＝モーダルを開く（従来のインライン編集は廃止） */}
                              <button
                                onClick={() => openProjectPromptModal(p.id)}
                                className="miniBtn"
                                title="プロンプトを編集（直接入力＋ファイル＋D&D）"
                                aria-label="プロンプトを編集"
                              >
                                <Icon name="upload" size={16} />
                              </button>

                              <button
                                onClick={() => {
                                  const ok = confirm(
                                    "このプロジェクトを削除しますか？（紐付くスレッドは単発に戻ります）"
                                  );
                                  if (ok) deleteProject(p.id);
                                }}
                                className="miniBtn"
                                title="プロジェクトを削除"
                                aria-label="プロジェクトを削除"
                              >
                                <Icon name="trash" size={16} />
                              </button>
                            </div>

                            {/* 簡易プレビュー */}
                            {!!(p.systemPrompt ?? "").trim() && (
                              <div
                                style={{
                                  marginTop: 10,
                                  padding: 10,
                                  borderRadius: 14,
                                  border: "1px solid var(--border2)",
                                  background: "var(--panel2)",
                                  fontSize: 12,
                                  color: "var(--text)",
                                  opacity: 0.92,
                                  lineHeight: 1.6,
                                  maxHeight: 120,
                                  overflow: "auto",
                                  whiteSpace: "pre-wrap",
                                }}
                                title="プロンプト（プレビュー）"
                              >
                                {p.systemPrompt}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ===== 下：データ操作（1） ===== */}
                <div className="sideAreaBot">
                  {/* データ操作 */}
                  <div className="pillSection">
                    <div className="sectionHeader">
                      <div className="sectionTitle">データ操作</div>
                    </div>

                    <button
                      onClick={() => {
                        const ok = confirm("全データ（プロジェクト/スレッド/メッセージ）を削除しますか？");
                        if (ok) clearAllData();
                      }}
                      style={{
                        width: "100%",
                        height: 40,
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        background: "var(--panel)",
                        cursor: "pointer",
                        fontWeight: 700,
                        color: "var(--text)",
                      }}
                      title="全データを削除"
                    >
                      全データを初期化
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 折りたたみ時の復帰タブ（ハンバーガーは使わず、細いタブだけ残す） */}
          {sideCollapsed && (
            <button
              onClick={() => setSideCollapsed(false)}
              style={{
                position: "fixed",
                left: 0,
                top: 90,
                zIndex: 25,
                width: 18,
                height: 140,
                borderRadius: "0 12px 12px 0",
                border: "1px solid var(--border)",
                background: "var(--panel)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 0,
                boxShadow: "var(--shadow2)",
                color: "var(--text)",
              }}
              title="メニューを開く"
              aria-label="メニューを開く"
            >
              <div style={{ fontSize: 12, fontWeight: 900, transform: "rotate(90deg)", color: "var(--text)" }}>
                MENU
              </div>
            </button>
          )}
        </aside>

        {/* ===== メイン ===== */}
        <main className="main">
          {/* 上部ヘッダー */}
          <div className="mainHeader">
            <div className="mainHeaderRow">
              <h1 className="title">OpenAI API チャット（スレッド / プロジェクト / プロンプト）</h1>

              <div className={`modePill ${modeClass}`} title="APIモード">
                {modeText}
              </div>

              <div className="topActions">
                <TopActionButton
                  onClick={() => setSearchOpen((v) => !v)}
                  title="検索パネルを開閉します"
                  icon={<Icon name="search" size={18} />}
                  label="検索"
                  variant={searchOpen ? "solid" : "ghost"}
                />

                <TopActionButton
                  onClick={toggleTheme}
                  title={themeTitle}
                  icon={themeIcon}
                  label={themeLabel}
                />

                <TopActionButton
                  onClick={copyText}
                  disabled={threadMessages.length === 0}
                  title="このスレッドのテキストをコピー"
                  icon={<Icon name="copy" size={18} />}
                  label="テキスト"
                />

                <TopActionButton
                  onClick={copyJson}
                  title="全データをJSONでコピー"
                  icon={<Icon name="json" size={18} />}
                  label="JSON"
                />

                <TopActionButton
                  onClick={downloadText}
                  disabled={threadMessages.length === 0}
                  title="このスレッドをTXTで保存"
                  icon={<Icon name="download" size={18} />}
                  label="TXT"
                />

                {/* ✅ 追加：ログアウト */}
                <TopActionButton
                  onClick={handleLogout}
                  title="ログアウト（ローカルのログイン状態を削除）"
                  icon={<Icon name="logout" size={18} />}
                  label="ログアウト"
                />
              </div>
            </div>

            {/* 検索パネル */}
            {searchOpen && (
              <div style={{ borderTop: "1px solid var(--border2)" }}>
                <div style={{ maxWidth: 1100, margin: "0 auto", padding: "10px 16px 12px 16px" }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      ref={searchInputRef}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="このスレッド内を検索（例：料金 / API / モデル名）"
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        height: 40,
                        background: "var(--panel)",
                        color: "var(--text)",
                      }}
                      disabled={!!editingId}
                    />
                    <button
                      onClick={clearSearch}
                      disabled={!search.trim() || !!editingId}
                      style={{
                        height: 40,
                        padding: "0 12px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        cursor: !search.trim() || editingId ? "not-allowed" : "pointer",
                        background: "var(--panel)",
                        fontWeight: 800,
                        color: "var(--text)",
                      }}
                      title={editingId ? "編集中は操作できません" : "検索キーワードをクリアします"}
                    >
                      クリア
                    </button>

                    <button
                      onClick={openImportModal}
                      disabled={loading}
                      style={{
                        height: 40,
                        padding: "0 12px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        cursor: loading ? "not-allowed" : "pointer",
                        background: "var(--panel)",
                        fontWeight: 800,
                        color: "var(--text)",
                      }}
                      title="会話データ(JSON)をインポート"
                    >
                      JSONインポート
                    </button>
                  </div>

                  {systemPromptApplied.trim() && (
                    <div
                      style={{
                        marginTop: 10,
                        padding: 12,
                        borderRadius: 14,
                        border: "1px solid var(--border2)",
                        background: "var(--panel2)",
                        color: "var(--text)",
                        opacity: 0.92,
                        fontSize: 12,
                        lineHeight: 1.6,
                      }}
                      title="適用中のsystem prompt（プロジェクト既定）"
                    >
                      <div style={{ fontWeight: 900, marginBottom: 6, color: "var(--text)" }}>適用中のプロンプト</div>
                      <div style={{ whiteSpace: "pre-wrap" }}>{systemPromptApplied}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 中央コンテンツ（サイド除いた領域の中央） */}
          <div className="contentWrap">
            <div className="contentInner">
              {/* Undoバー */}
              {undoState && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    border: "1px solid var(--border2)",
                    background: "var(--panel)",
                    borderRadius: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    boxShadow: "var(--shadow2)",
                    color: "var(--text)",
                  }}
                >
                  <div style={{ fontSize: 13, color: "var(--text)", opacity: 0.9 }}>
                    {undoState.items.length === 2 ? "末尾の質問と回答を削除しました。" : "末尾のメッセージを削除しました。"} 取り消しできます（あと{" "}
                    {undoLeftLabel}）
                  </div>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button
                      onClick={undoRemove}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 12,
                        border: "1px solid var(--primaryBorder)",
                        cursor: "pointer",
                        background: "var(--primarySoft)",
                        fontWeight: 900,
                        color: "var(--primary2)",
                      }}
                      title="削除を取り消します"
                    >
                      Undo
                    </button>
                    <button
                      onClick={() => setUndoState(null)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        background: "var(--panel)",
                        fontWeight: 800,
                        color: "var(--text)",
                      }}
                      title="この通知を閉じます"
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              )}

              {/* 編集中バー */}
              {editingId && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    border: "1px solid var(--primaryBorder)",
                    background: "var(--primarySoft)",
                    borderRadius: 14,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    boxShadow: "var(--shadow2)",
                  }}
                >
                  <div style={{ fontSize: 13, color: "var(--primary2)", fontWeight: 900 }}>
                    編集中です（保存すると、その投稿以降は削除され、回答を再生成します）
                  </div>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                    <button
                      onClick={saveEditAndRegenerate}
                      disabled={loading}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 12,
                        border: "1px solid var(--primaryBorder)",
                        cursor: loading ? "not-allowed" : "pointer",
                        background: "var(--primarySoft)",
                        fontWeight: 900,
                        color: "var(--primary2)",
                      }}
                      title="保存して回答を再生成します（Ctrl+Enter / Cmd+Enter）"
                    >
                      {editingWillRegenerate || loading ? "再生成中..." : "保存して再生成"}
                    </button>
                    <button
                      onClick={cancelEdit}
                      disabled={loading}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 12,
                        border: "1px solid var(--border)",
                        cursor: loading ? "not-allowed" : "pointer",
                        background: "var(--panel)",
                        fontWeight: 800,
                        color: "var(--text)",
                      }}
                      title="編集をキャンセルします（Esc）"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: 12,
                    border: "1px solid var(--dangerBorder)",
                    background: "var(--dangerSoft)",
                    borderRadius: 14,
                    color: "var(--dangerText)",
                    boxShadow: "var(--shadow2)",
                    fontWeight: 800,
                  }}
                >
                  {error}
                </div>
              )}

              <div className="card">
                {filteredMessages.length === 0 ? (
                  <div style={{ color: "var(--muted)" }}>
                    {threadMessages.length === 0
                      ? "会話履歴がここに表示されます。"
                      : "検索条件に一致する履歴がありません。"}
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {filteredMessages.map((m, i) => (
                      <div key={m.id}>
                        {/* 質問区切り強化 */}
                        {shouldShowDivider(i, filteredMessages) && (
                          <div style={{ margin: "12px 0 8px 0", borderTop: "2px dashed var(--divider)" }} />
                        )}

                        <div
                          style={{
                            border:
                              m.role === "user"
                                ? "1px solid var(--msgUserBorder)"
                                : "1px solid var(--msgAiBorder)",
                            background: m.role === "user" ? "var(--msgUserBg)" : "var(--msgAiBg)",
                            borderRadius: 16,
                            padding: 12,
                          }}
                        >
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <div style={{ fontWeight: 900, color: "var(--msgText)" }}>
                              {m.role === "user" ? "あなた" : "AI"}
                            </div>
                            <div style={{ fontSize: 12, color: "var(--msgSubText)" }}>
                              {formatTime(m.createdAt)}
                            </div>

                            <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
                              {/* 編集（自分の投稿のみ） */}
                              {m.role === "user" && (
                                <button
                                  onClick={() => startEdit(m.id)}
                                  disabled={loading || (editingId !== null && editingId !== m.id)}
                                  className="msgHeadBtn"
                                  title="このメッセージを編集します（保存で以降削除＋再生成）"
                                  aria-label="このメッセージを編集"
                                >
                                  <Icon name="edit" size={14} />
                                </button>
                              )}

                              {/* ✅ 末尾アンカーにだけ削除（Q&A同時削除） */}
                              {isTailAnchor(m.id) && !loading && !editingId && (
                                <button
                                  onClick={() => {
                                    const ok =
                                      tailDeleteInfo.ids.length === 2
                                        ? confirm("末尾の質問と回答を削除しますか？")
                                        : confirm("末尾のメッセージを削除しますか？");
                                    if (ok) removeTailBlock();
                                  }}
                                  className="msgHeadBtn"
                                  title={tailDeleteInfo.ids.length === 2 ? "末尾の質問と回答を削除" : "末尾のメッセージを削除"}
                                  aria-label="末尾を削除"
                                >
                                  <Icon name="close" size={14} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* 編集中は textarea に切り替え（userのみ） */}
                          {editingId === m.id ? (
                            <div style={{ marginTop: 10 }}>
                              <textarea
                                ref={editTextareaRef}
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onKeyDown={handleEditKeyDown}
                                style={{
                                  width: "100%",
                                  minHeight: 90,
                                  padding: "10px 12px",
                                  border: "1px solid var(--primaryBorder)",
                                  borderRadius: 14,
                                  resize: "vertical",
                                  lineHeight: 1.6,
                                  background: "var(--panel)",
                                  color: "var(--text)",
                                }}
                              />
                              <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "flex-end" }}>
                                <button
                                  onClick={cancelEdit}
                                  disabled={loading}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: 12,
                                    border: "1px solid var(--border)",
                                    cursor: loading ? "not-allowed" : "pointer",
                                    background: "var(--panel)",
                                    fontWeight: 800,
                                    color: "var(--text)",
                                  }}
                                  title="編集をキャンセルします（Esc）"
                                >
                                  キャンセル
                                </button>
                                <button
                                  onClick={saveEditAndRegenerate}
                                  disabled={loading}
                                  style={{
                                    padding: "8px 12px",
                                    borderRadius: 12,
                                    border: "1px solid var(--primaryBorder)",
                                    cursor: loading ? "not-allowed" : "pointer",
                                    background: "var(--primarySoft)",
                                    fontWeight: 900,
                                    color: "var(--primary2)",
                                  }}
                                  title="保存して以降を削除し、回答を再生成します（Ctrl+Enter / Cmd+Enter）"
                                >
                                  {loading ? "再生成中..." : "保存して再生成"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              style={{
                                whiteSpace: "pre-wrap",
                                lineHeight: 1.75,
                                marginTop: 8,
                                color: "var(--msgText)",
                              }}
                            >
                              {m.text}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    <div ref={bottomRef} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 下部固定：入力バー */}
          <div className="inputBar">
            <div className="inputInner">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="質問を入力（Enterで送信 / Shift+Enterで改行）"
                style={{
                  flex: 1,
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  minHeight: 44,
                  height: 44,
                  resize: "vertical",
                  lineHeight: 1.6,
                  background: "var(--panel)",
                  color: "var(--text)",
                }}
                onKeyDown={handleTextareaKeyDown}
                disabled={loading || !!editingId}
              />

              <button
                onClick={handleSend}
                disabled={!canSend}
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "1px solid var(--primaryBorder)",
                  cursor: canSend ? "pointer" : "not-allowed",
                  height: 44,
                  minWidth: 110,
                  background: "var(--primarySoft)",
                  fontWeight: 900,
                  color: "var(--primary2)",
                }}
                title={
                  editingId
                    ? "編集中は送信できません"
                    : loading
                    ? "送信中です"
                    : cooldownLeft > 0
                    ? `連打防止中（あと ${cooldownLabel}）`
                    : ""
                }
              >
                {loading ? "送信中..." : cooldownLeft > 0 ? `待機 ${cooldownLabel}` : "送信"}
              </button>

              <button
                onClick={() => {
                  const ok = confirm("このスレッドの履歴をすべて削除しますか？");
                  if (ok) clearCurrentThreadMessages();
                }}
                disabled={loading}
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  border: "1px solid var(--border)",
                  cursor: loading ? "not-allowed" : "pointer",
                  height: 44,
                  background: "var(--panel)",
                  fontWeight: 800,
                  color: "var(--text)",
                }}
                title="このスレッドをクリア"
              >
                クリア
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* 会話JSONインポートモーダル */}
      {importOpen && (
        <div onClick={onOverlayClick} className="modalOverlay">
          <div className="modalBox">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>JSONインポート（会話データ）</div>
              <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
                Escで閉じる / Ctrl+Enter(Windows)・Cmd+Enter(Mac)で取り込み
              </div>
            </div>

            <div style={{ marginTop: 10 }}>
              <textarea
                ref={importTextareaRef}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                onKeyDown={handleImportKeyDown}
                placeholder="ここにJSONを貼り付けてください（JSONコピーの内容、またはmessages配列）"
                style={{
                  width: "100%",
                  minHeight: 260,
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  resize: "vertical",
                  lineHeight: 1.6,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: 12,
                  background: "var(--panel)",
                  color: "var(--text)",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button
                onClick={closeImportModal}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  background: "var(--panel)",
                  fontWeight: 800,
                  color: "var(--text)",
                }}
              >
                キャンセル
              </button>
              <button
                onClick={commitImport}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--primaryBorder)",
                  cursor: "pointer",
                  background: "var(--primarySoft)",
                  fontWeight: 900,
                  color: "var(--primary2)",
                }}
              >
                取り込む
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ プロジェクトプロンプト編集モーダル（直接入力＋ファイル＋D&D、完結） */}
      {projectPromptModalOpen && promptTargetProjectId && (
        <div
          className="modalOverlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeProjectPromptModal();
          }}
          onKeyDown={handlePromptModalKeyDown}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="プロジェクトプロンプト編集"
        >
          <div className="modalBox">
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 900 }}>プロジェクトのプロンプト編集</div>
              <div style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)" }}>
                Escで閉じる / Ctrl+Enter・Cmd+Enterで保存
              </div>
            </div>

            <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>
              直接入力と、ファイル取り込み（選択・ドラッグ&ドロップ）を併用できます。ファイル内容は末尾に追記されます。
            </div>

            <div
              className={`dropZone ${promptDragOver ? "dropZoneActive" : ""}`}
              style={{ marginTop: 12 }}
              onDragOver={onPromptDragOver}
              onDragLeave={onPromptDragLeave}
              onDrop={onPromptDrop}
            >
              <div className="dropText">
                <div style={{ fontWeight: 900, marginBottom: 2 }}>ファイルをここにドロップ</div>
                <div>または「ファイル選択」から取り込み（.txt / .md など）</div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  ref={promptFileInputRef}
                  type="file"
                  accept=".txt,.md,.prompt,text/plain,text/markdown"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    await importPromptFile(f);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => promptFileInputRef.current?.click()}
                  style={{
                    height: 38,
                    padding: "0 12px",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    background: "var(--panel)",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    fontWeight: 900,
                    color: "var(--text)",
                  }}
                >
                  <Icon name="upload" size={18} /> ファイル選択
                </button>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <textarea
                ref={promptTextareaRef}
                value={projectPromptDraft}
                onChange={(e) => {
                  setProjectPromptDraft(e.target.value);
                  setProjectPromptDirty(true);
                }}
                placeholder="例）必ず箇条書きで。結論→根拠→手順のaの順。Next.js/TS前提。など"
                style={{
                  width: "100%",
                  minHeight: 240,
                  padding: "10px 12px",
                  border: "1px solid var(--border)",
                  borderRadius: 14,
                  resize: "vertical",
                  lineHeight: 1.6,
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: 12,
                  background: "var(--panel)",
                  color: "var(--text)",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  const p = projects.find((x) => x.id === promptTargetProjectId) ?? null;
                  setProjectPromptDraft(p?.systemPrompt ?? "");
                  setProjectPromptDirty(false);
                }}
                disabled={!projectPromptDirty}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  cursor: !projectPromptDirty ? "not-allowed" : "pointer",
                  background: "var(--panel)",
                  fontWeight: 800,
                  color: "var(--text)",
                }}
                title="変更を破棄して元に戻します"
              >
                元に戻す
              </button>

              <button
                onClick={closeProjectPromptModal}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  background: "var(--panel)",
                  fontWeight: 800,
                  color: "var(--text)",
                }}
              >
                閉じる
              </button>

              <button
                onClick={() => saveProjectPrompt(promptTargetProjectId)}
                disabled={!projectPromptDirty}
                style={{
                  padding: "10px 14px",
                  borderRadius: 12,
                  border: "1px solid var(--primaryBorder)",
                  cursor: !projectPromptDirty ? "not-allowed" : "pointer",
                  background: "var(--primarySoft)",
                  fontWeight: 900,
                  color: "var(--primary2)",
                }}
                title="保存して閉じます"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
