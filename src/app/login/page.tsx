// src/app/login/page.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getLocalAuth, setLocalAuth } from '@/lib/localAuth';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); // いったんダミー（後でサーバー認証に差し替え）
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const userRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    // 既にログイン済みなら / へ
    const a = getLocalAuth();
    if (a?.isAuthed) {
      window.location.href = '/';
      return;
    }
    requestAnimationFrame(() => userRef.current?.focus());
  }, []);

  const canSubmit = useMemo(() => {
    return !submitting && username.trim().length > 0;
  }, [submitting, username]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const u = username.trim();
    if (!u) {
      setError('ユーザー名を入力してください。');
      return;
    }

    setSubmitting(true);
    try {
      // ✅ ローカル完結：ここを後でサーバー認証に差し替える
      // password は現時点では未使用（UIだけ用意）
      void password;

      setLocalAuth(u);
      window.location.href = '/';
    } catch {
      setError('ログインに失敗しました。');
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <style jsx>{`
        :global(:root) {
          --bg: #f5f7fb;
          --panel: #ffffff;
          --panel2: #f8fafc;
          --border: #d6dbe3;
          --border2: #e7ebf0;
          --text: #0f172a;
          --muted: #64748b;

          --primary: #2563eb;
          --primary2: #1d4ed8;
          --primarySoft: #eff6ff;
          --primaryBorder: #bfdbfe;

          --dangerSoft: #fef2f2;
          --dangerBorder: #fecaca;
          --dangerText: #b91c1c;

          --shadow: 0 10px 28px rgba(15, 23, 42, 0.08);
          --ring: 0 0 0 3px rgba(37, 99, 235, 0.18);
        }

        :global(body) {
          margin: 0;
          color: var(--text);
          background: var(--bg);
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji",
            "Segoe UI Emoji";
        }

        .card {
          width: min(520px, 100%);
          background: var(--panel);
          border: 1px solid var(--border2);
          border-radius: 18px;
          box-shadow: var(--shadow);
          padding: 18px;
        }

        .title {
          font-size: 20px;
          font-weight: 900;
          margin: 0;
          letter-spacing: 0.2px;
        }

        .sub {
          margin-top: 8px;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.6;
        }

        .field {
          margin-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        label {
          font-size: 12px;
          font-weight: 800;
          color: #0f172a;
        }

        input {
          height: 42px;
          border-radius: 12px;
          border: 1px solid var(--border);
          padding: 0 12px;
          background: var(--panel);
          outline: none;
          font-size: 14px;
        }

        input:focus-visible {
          box-shadow: var(--ring);
          border-color: var(--primaryBorder);
        }

        .row {
          margin-top: 16px;
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .btn {
          height: 44px;
          border-radius: 14px;
          border: 1px solid var(--primaryBorder);
          background: var(--primarySoft);
          color: var(--primary2);
          font-weight: 900;
          cursor: pointer;
          padding: 0 14px;
          flex: 1;
        }

        .btn:hover:not(:disabled) {
          background: #e7f0ff;
          border-color: #a9c8ff;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .note {
          margin-top: 12px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid var(--border2);
          background: var(--panel2);
          font-size: 12px;
          color: #334155;
          line-height: 1.6;
        }

        .err {
          margin-top: 12px;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid var(--dangerBorder);
          background: var(--dangerSoft);
          color: var(--dangerText);
          font-weight: 800;
          font-size: 13px;
        }
      `}</style>

      <div className="card">
        <h1 className="title">ログイン</h1>
        <div className="sub">
          一旦はローカル完結です（localStorageにログイン状態を保存）。後からサーバー認証に差し替え可能な構成にしています。
        </div>

        {error && <div className="err">{error}</div>}

        <form onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="username">ユーザー名</label>
            <input
              id="username"
              ref={userRef}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例：matsumoto"
              autoComplete="username"
            />
          </div>

          <div className="field">
            <label htmlFor="password">パスワード（現時点では未使用）</label>
            <input
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="（後でサーバー認証に差し替え）"
              type="password"
              autoComplete="current-password"
            />
          </div>

          <div className="row">
            <button className="btn" type="submit" disabled={!canSubmit} title="ログイン（ローカル保存）">
              {submitting ? 'ログイン中...' : 'ログイン'}
            </button>
          </div>
        </form>

        <div className="note">
          ローカルログインを破棄したい場合は、Home画面の「ログアウト」で削除できます。
        </div>
      </div>
    </div>
  );
}
