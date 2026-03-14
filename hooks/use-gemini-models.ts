"use client";

import { useState, useEffect } from "react";
import type { GeminiModel } from "@/types";

export function useGeminiModels(apiKey: string) {
  const [models, setModels] = useState<GeminiModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!apiKey || apiKey.length < 10) {
      setModels([]);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch("/api/gemini/models", {
      headers: { "X-Gemini-API-Key": apiKey },
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setModels([]);
        } else {
          setModels(data.models || []);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  return { models, loading, error };
}
