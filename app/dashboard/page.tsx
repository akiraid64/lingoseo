"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { useApiKey } from "@/hooks/use-api-key";
import { useGeminiModels } from "@/hooks/use-gemini-models";
import type { AnalysisResult, PrResult } from "@/types";

export default function DashboardPage() {
  const { data: session } = useSession();
  const {
    apiKey,
    setApiKey,
    lingoApiKey,
    setLingoApiKey,
    selectedModel,
    setSelectedModel,
    clearAll,
    isLoaded,
  } = useApiKey();
  const { models, loading: modelsLoading, error: modelsError } =
    useGeminiModels(apiKey);

  const [repoUrl, setRepoUrl] = useState("");
  const [targetLocales, setTargetLocales] = useState("es,fr,de,ja");
  const [analyzing, setAnalyzing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [prResult, setPrResult] = useState<PrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");

  async function handleAnalyze() {
    if (!repoUrl) return;
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setPrResult(null);
    setStatusMsg("Cloning repository and scanning for SEO issues...");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoUrl }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalysis(data.analysis);
      setStatusMsg("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      setStatusMsg("");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleFixAndPr() {
    if (!analysis || !selectedModel || !apiKey || !lingoApiKey) return;
    setFixing(true);
    setError(null);
    setPrResult(null);
    setStatusMsg(
      "Translating with lingo.dev SDK → optimizing keywords with Gemini → pushing to GitHub..."
    );

    try {
      const res = await fetch("/api/fix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Gemini-API-Key": apiKey,
          "X-Lingo-API-Key": lingoApiKey,
        },
        body: JSON.stringify({
          repoUrl,
          modelName: selectedModel,
          targetLocales: targetLocales
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean),
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.pr) {
        setPrResult(data.pr);
        setStatusMsg("");
      } else {
        setStatusMsg(data.message || "No fixes applied");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fix failed");
      setStatusMsg("");
    } finally {
      setFixing(false);
    }
  }

  if (!isLoaded) return null;

  const canFix = selectedModel && apiKey && lingoApiKey && analysis;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Top bar */}
      <nav className="border-b border-[var(--border)] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white font-bold text-xs">
            LS
          </div>
          <span className="font-semibold">LingoSEO</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--primary)]/20 text-[var(--primary)]">
            Powered by lingo.dev
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-[var(--muted-foreground)]">
            {session?.user?.name}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="text-sm text-[var(--muted-foreground)] hover:text-white transition"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-sm text-[var(--muted-foreground)] mb-8">
          Scan a GitHub repo, translate SEO content with{" "}
          <strong>lingo.dev SDK</strong>, optimize keywords with AI, and push as
          a PR.
        </p>

        {/* Step 1: API Keys */}
        <section className="mb-8 p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-lg font-semibold mb-1">1. API Keys</h2>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">
            Both keys stay in your browser (localStorage) — never stored on our
            server.
          </p>

          <div className="space-y-4">
            {/* Lingo.dev API Key - PRIMARY */}
            <div className="p-4 rounded-lg border border-[var(--primary)]/30 bg-[var(--primary)]/5">
              <label className="block text-sm font-medium mb-1 text-[var(--primary)]">
                lingo.dev API Key (required — powers all translations)
              </label>
              <input
                type="password"
                value={lingoApiKey}
                onChange={(e) => setLingoApiKey(e.target.value)}
                placeholder="Your lingo.dev API key"
                className="w-full px-3 py-2 rounded-lg bg-[var(--muted)] border border-[var(--border)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                Used for: localizeText, localizeObject, batchLocalizeText,
                localizeHtml — translating all SEO content to target locales
              </p>
            </div>

            {/* Gemini API Key */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Gemini API Key (SEO keyword optimization)
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="AIza..."
                  className="w-full px-3 py-2 rounded-lg bg-[var(--muted)] border border-[var(--border)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Gemini Model
                </label>
                {modelsLoading ? (
                  <div className="px-3 py-2 rounded-lg bg-[var(--muted)] border border-[var(--border)] text-sm text-[var(--muted-foreground)]">
                    Loading models...
                  </div>
                ) : modelsError ? (
                  <div className="px-3 py-2 rounded-lg bg-[var(--muted)] border border-red-500/50 text-sm text-red-400">
                    {modelsError}
                  </div>
                ) : (
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--muted)] border border-[var(--border)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  >
                    <option value="">Select a model...</option>
                    {models.map((m) => (
                      <option key={m.name} value={m.name}>
                        {m.displayName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {(apiKey || lingoApiKey) && (
              <button
                onClick={clearAll}
                className="text-xs text-[var(--muted-foreground)] hover:text-red-400 transition"
              >
                Clear all keys
              </button>
            )}
          </div>

          {/* How it works callout */}
          <div className="mt-4 p-3 rounded-lg bg-[var(--muted)] text-xs text-[var(--muted-foreground)]">
            <strong className="text-[var(--foreground)]">How it works:</strong>{" "}
            lingo.dev SDK translates your SEO content (titles, descriptions,
            headings, alt text) to all target locales. Then Gemini checks if the
            translated keywords match what people actually search for in each
            locale and optimizes them.
          </div>
        </section>

        {/* Step 2: Repo URL */}
        <section className="mb-8 p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <h2 className="text-lg font-semibold mb-1">2. Repository</h2>
          <p className="text-xs text-[var(--muted-foreground)] mb-4">
            Paste a GitHub repo URL to scan for SEO issues.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                GitHub Repo URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="w-full px-3 py-2 rounded-lg bg-[var(--muted)] border border-[var(--border)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Target Locales (comma-separated)
              </label>
              <input
                type="text"
                value={targetLocales}
                onChange={(e) => setTargetLocales(e.target.value)}
                placeholder="es,fr,de,ja,zh-Hans"
                className="w-full px-3 py-2 rounded-lg bg-[var(--muted)] border border-[var(--border)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              />
              <p className="text-xs text-[var(--muted-foreground)] mt-1">
                lingo.dev will translate SEO content to these locales using its
                Localization Engine
              </p>
            </div>

            <button
              onClick={handleAnalyze}
              disabled={!repoUrl || analyzing}
              className="px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {analyzing ? "Scanning..." : "Scan for SEO Issues"}
            </button>
          </div>
        </section>

        {/* Status */}
        {statusMsg && (
          <div className="mb-6 p-4 rounded-xl border border-[var(--border)] bg-[var(--card)] flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">{statusMsg}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Step 3: Analysis Results */}
        {analysis && (
          <section className="mb-8 p-6 rounded-xl border border-[var(--border)] bg-[var(--card)]">
            <h2 className="text-lg font-semibold mb-4">3. Analysis Results</h2>

            {/* SEO Score */}
            <div className="flex items-center gap-6 mb-6 p-4 rounded-xl bg-[var(--muted)] border border-[var(--border)]">
              <div className="text-center">
                <div
                  className={`text-5xl font-black ${
                    analysis.score.grade === "A"
                      ? "text-green-400"
                      : analysis.score.grade === "B"
                        ? "text-blue-400"
                        : analysis.score.grade === "C"
                          ? "text-yellow-400"
                          : "text-red-400"
                  }`}
                >
                  {analysis.score.grade}
                </div>
                <div className="text-xs text-[var(--muted-foreground)]">
                  {analysis.score.total}/100
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
                {Object.entries(analysis.score.breakdown).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[var(--muted-foreground)] capitalize">
                      {key.replace(/([A-Z])/g, " $1")}
                    </span>
                    <span
                      className={`font-medium ${val >= 80 ? "text-green-400" : val >= 60 ? "text-yellow-400" : "text-red-400"}`}
                    >
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-center">
                <div className="text-2xl font-bold text-red-400">
                  {analysis.summary.critical}
                </div>
                <div className="text-xs text-red-400/70">Critical</div>
              </div>
              <div className="p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-center">
                <div className="text-2xl font-bold text-yellow-400">
                  {analysis.summary.warning}
                </div>
                <div className="text-xs text-yellow-400/70">Warning</div>
              </div>
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30 text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {analysis.summary.info}
                </div>
                <div className="text-xs text-blue-400/70">Info</div>
              </div>
            </div>

            <div className="text-sm text-[var(--muted-foreground)] mb-4">
              Scanned {analysis.scannedFiles} files
              {analysis.localesDetected.length > 0 && (
                <> &middot; Locales detected: {analysis.localesDetected.join(", ")}</>
              )}
            </div>

            {/* Issues table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 pr-3 text-[var(--muted-foreground)] font-medium">
                      Severity
                    </th>
                    <th className="text-left py-2 pr-3 text-[var(--muted-foreground)] font-medium">
                      Issue
                    </th>
                    <th className="text-left py-2 text-[var(--muted-foreground)] font-medium">
                      File
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analysis.issues.map((issue) => (
                    <tr
                      key={issue.id}
                      className="border-b border-[var(--border)]/50"
                    >
                      <td className="py-2 pr-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            issue.severity === "critical"
                              ? "bg-red-500/20 text-red-400"
                              : issue.severity === "warning"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-blue-500/20 text-blue-400"
                          }`}
                        >
                          {issue.severity}
                        </span>
                      </td>
                      <td className="py-2 pr-3">{issue.message}</td>
                      <td className="py-2 text-[var(--muted-foreground)] font-mono text-xs">
                        {issue.filePath}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Fix button */}
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={handleFixAndPr}
                disabled={fixing || !canFix}
                className="px-5 py-2.5 rounded-lg bg-[var(--success)] text-black text-sm font-medium hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed w-fit"
              >
                {fixing
                  ? "lingo.dev translating → Gemini optimizing → Pushing..."
                  : `Fix All & Create PR (${analysis.issues.length} issues)`}
              </button>
              {!canFix && (
                <span className="text-xs text-[var(--muted-foreground)]">
                  {!lingoApiKey
                    ? "Add your lingo.dev API key first"
                    : !apiKey
                      ? "Add your Gemini API key"
                      : !selectedModel
                        ? "Select a Gemini model"
                        : ""}
                </span>
              )}
            </div>
          </section>
        )}

        {/* Step 4: PR Created */}
        {prResult && (
          <section className="mb-8 p-6 rounded-xl border border-[var(--success)]/30 bg-[var(--success)]/5">
            <h2 className="text-lg font-semibold mb-3 text-[var(--success)]">
              PR Created Successfully!
            </h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-[var(--muted-foreground)]">Branch:</span>{" "}
                <code className="px-1.5 py-0.5 rounded bg-[var(--muted)] text-xs">
                  {prResult.branchName}
                </code>
              </p>
              <p>
                <span className="text-[var(--muted-foreground)]">
                  Files changed:
                </span>{" "}
                {prResult.filesChanged}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Translations powered by lingo.dev SDK (localizeText,
                localizeObject, batchLocalizeText)
              </p>
              <a
                href={prResult.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 px-5 py-2.5 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition"
              >
                View Pull Request #{prResult.prNumber}
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
