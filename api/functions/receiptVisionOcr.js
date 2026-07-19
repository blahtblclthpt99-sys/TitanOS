import { readJson } from "../_lib/supabase.js";
import { applyCors, handleOptions } from "../_lib/cors.js";

/**
 * Vision OCR for receipts. Uses OpenAI when OPENAI_API_KEY is set;
 * otherwise returns a structured heuristic stub so the UI still works.
 */
export default async function handler(req, res) {
  applyCors(res, req);
  if (handleOptions(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { image_base64: imageBase64, mime_type: mimeType = "image/jpeg", pasted_text: pastedText } = readJson(req);
    if (pastedText?.trim()) {
      return res.status(200).json({ text: pastedText.trim(), source: "paste" });
    }
    if (!imageBase64) {
      return res.status(400).json({ error: "image_base64 or pasted_text required" });
    }

    const openAiKey = process.env.OPENAI_API_KEY;
    if (openAiKey) {
      const dataUrl = `data:${mimeType};base64,${String(imageBase64).replace(/^data:[^;]+;base64,/, "")}`;
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openAiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract receipt text. Include vendor, date, total amount, and line items if visible. Plain text only.",
                },
                { type: "image_url", image_url: { url: dataUrl } },
              ],
            },
          ],
          max_tokens: 800,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        console.error("OpenAI vision error:", json);
        return res.status(502).json({ error: "Vision OCR failed" });
      }
      const text = json.choices?.[0]?.message?.content || "";
      return res.status(200).json({ text, source: "openai_vision" });
    }

    return res.status(200).json({
      text: "",
      source: "stub",
      message: "Add OPENAI_API_KEY for live receipt vision. Paste receipt text for now.",
    });
  } catch (error) {
    console.error("receiptVisionOcr error:", error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
