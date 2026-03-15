import { listGeminiModels } from "@/lib/gemini/models";

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY not configured on server" }, { status: 500 });
  }

  try {
    const models = await listGeminiModels(apiKey);
    return Response.json({ models });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to list models" },
      { status: 500 }
    );
  }
}
