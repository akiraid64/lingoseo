"use client";

import { useState, useEffect, useCallback } from "react";

const GEMINI_KEY = "lingoseo:gemini-api-key";
const LINGO_KEY = "lingoseo:lingo-api-key";
const MODEL_KEY = "lingoseo:selected-model";

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string>("");
  const [lingoApiKey, setLingoApiKeyState] = useState<string>("");
  const [selectedModel, setSelectedModelState] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setApiKeyState(localStorage.getItem(GEMINI_KEY) || "");
    setLingoApiKeyState(localStorage.getItem(LINGO_KEY) || "");
    setSelectedModelState(localStorage.getItem(MODEL_KEY) || "");
    setIsLoaded(true);
  }, []);

  const setApiKey = useCallback((key: string) => {
    localStorage.setItem(GEMINI_KEY, key);
    setApiKeyState(key);
  }, []);

  const setLingoApiKey = useCallback((key: string) => {
    localStorage.setItem(LINGO_KEY, key);
    setLingoApiKeyState(key);
  }, []);

  const setSelectedModel = useCallback((model: string) => {
    localStorage.setItem(MODEL_KEY, model);
    setSelectedModelState(model);
  }, []);

  const clearAll = useCallback(() => {
    localStorage.removeItem(GEMINI_KEY);
    localStorage.removeItem(LINGO_KEY);
    localStorage.removeItem(MODEL_KEY);
    setApiKeyState("");
    setLingoApiKeyState("");
    setSelectedModelState("");
  }, []);

  return {
    apiKey,
    setApiKey,
    lingoApiKey,
    setLingoApiKey,
    selectedModel,
    setSelectedModel,
    clearAll,
    isLoaded,
  };
}
