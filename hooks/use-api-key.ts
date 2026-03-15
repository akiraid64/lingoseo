"use client";

import { useState, useEffect, useCallback } from "react";

const MODEL_KEY = "lingoseo:selected-model";

export function useApiKey() {
  const [selectedModel, setSelectedModelState] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setSelectedModelState(localStorage.getItem(MODEL_KEY) || "");
    setIsLoaded(true);
  }, []);

  const setSelectedModel = useCallback((model: string) => {
    localStorage.setItem(MODEL_KEY, model);
    setSelectedModelState(model);
  }, []);

  const clearAll = useCallback(() => {
    localStorage.removeItem(MODEL_KEY);
    setSelectedModelState("");
  }, []);

  return {
    selectedModel,
    setSelectedModel,
    clearAll,
    isLoaded,
  };
}
