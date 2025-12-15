// src/app/api/chat/route.ts
import { NextResponse } from "next/server";

type Role = "user" | "assistant";

type ReqBody = {
  mode?: "mock" | "openai" | string;
  messages?: { role: Role; text: string }[];
  systemPrompt?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;

    const mode = body.mode ?? "mock";
    const messages = body.messages ?? [];
    const systemPrompt = body.systemPrompt ?? "";

    // ----------------------------
    // ✅ mockモード：usageは疑似値で返す（推定UIが動くように）
    // ----------------------------
    if (mode === "mock") {
      const lastUser = [...messages].reverse().find((m) => m.role === "user")?.text ?? "";
      const mockText = `（mock）受け取りました: ${lastUser}`;

      // 超ざっくり疑似トークン（文字数ベース）
      const promptTokens = Math.max(1, Math.ceil((systemPrompt.length + messages.map(m => m.text).join("\n").length) / 4));
      const completionTokens = Math.max(1, Math.ceil(mockText.length / 4));
      const totalTokens = promptTokens + completionTokens;

      return NextResponse.json({
        text: mockText,
        mode: "mock",
        model: "mock",
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: totalTokens,
        },
      });
    }

    // ----------------------------
    // ✅ openaiモード（サーバ側でOpenAIを叩く想定）
    // ----------------------------
    if (mode === "openai") {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return NextResponse.json(
          { error: "OPENAI_API_KEY is not set." },
          { status: 500 }
        );
      }

      // ここでは“チャットアプリの既存仕様”に合わせて messages を {role, content} に変換
      const openaiMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [];
      if (systemPrompt.trim()) {
        openaiMessages.push({ role: "system", content: systemPrompt });
      }
      for (const m of messages) {
        openaiMessages.push({ role: m.role, content: m.text });
      }

      // OpenAI互換のChat Completions想定（既存がこの形式ならそのまま）
      const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: openaiMessages,
          temperature: 0.2,
        }),
      });

      if (!r.ok) {
        const errText = await r.text().catch(() => "");
        return NextResponse.json(
          { error: `OpenAI request failed: ${r.status} ${r.statusText} ${errText}` },
          { status: 500 }
        );
      }

      const data = (await r.json()) as any;

      const text: string =
        data?.choices?.[0]?.message?.content ??
        "";

      const usage = data?.usage ?? null;

      return NextResponse.json({
        text,
        mode: "openai",
        model,
        usage: usage
          ? {
              prompt_tokens: usage.prompt_tokens ?? 0,
              completion_tokens: usage.completion_tokens ?? 0,
              total_tokens: usage.total_tokens ?? 0,
            }
          : null,
      });
    }

    return NextResponse.json(
      { error: `Unknown mode: ${mode}` },
      { status: 400 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}
