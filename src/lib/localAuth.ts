// src/lib/localAuth.ts
'use client';

export type LocalAuthState = {
  isAuthed: boolean;
  username: string;
  loggedInAt: number; // epoch ms
};

const AUTH_KEY = 'openai_chat_app_local_auth_v1';

export function getLocalAuth(): LocalAuthState | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(AUTH_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return null;

    const obj = v as any;
    const isAuthed = obj.isAuthed === true;
    const username = typeof obj.username === 'string' ? obj.username : '';
    const loggedInAt = typeof obj.loggedInAt === 'number' ? obj.loggedInAt : 0;

    if (!isAuthed) return null;
    return { isAuthed, username, loggedInAt };
  } catch {
    return null;
  }
}

export function setLocalAuth(username: string) {
  if (typeof window === 'undefined') return;
  const payload: LocalAuthState = {
    isAuthed: true,
    username: (username ?? '').trim(),
    loggedInAt: Date.now(),
  };
  window.localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
}

export function clearLocalAuth() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_KEY);
}

export function isAuthedLocal(): boolean {
  return !!getLocalAuth();
}
