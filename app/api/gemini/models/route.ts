import { listGeminiModels } from "@/lib/gemini/models";

export async function GET(req: Request) {
  const apiKey = req.headers.get("x-gemini-api-key");
  if (!apiKey) {
    return Response.json({ error: "Missing Gemini API key" }, { status: 401 });
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
