import { getSupabaseAdmin, readJson } from "../_lib/supabase.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const admin = getSupabaseAdmin();
    const { data: userData, error: userError } = await admin.auth.getUser(token);
    if (userError || !userData.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const body = readJson(req);
    const { messages = [], confirmedAction = null } = body;

    if (confirmedAction) {
      return res.status(200).json({
        data: {
          type: "done",
          message: "Action execution is being migrated. Please use the app UI for now.",
        },
      });
    }

    const lastMessage = messages.filter((m) => m.role === "user").slice(-1)[0]?.content || "";
    const openAiKey = process.env.OPENAI_API_KEY;

    if (!openAiKey) {
      return res.status(200).json({
        data: {
          type: "response",
          message:
            `I received: "${lastMessage}". ` +
            "AI assistant backend is connected — add OPENAI_API_KEY in Vercel to enable full Titan AI responses.",
        },
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are Titan AI, a helpful field-service business assistant. Be concise and practical.",
          },
          ...messages.slice(-12),
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("OpenAI error:", errText);
      return res.status(502).json({ error: "AI request failed" });
    }

    const completion = await response.json();
    const content = completion.choices?.[0]?.message?.content || "No response.";

    return res.status(200).json({
      data: {
        type: "response",
        message: content,
      },
    });
  } catch (error) {
    console.error("titanAI error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
