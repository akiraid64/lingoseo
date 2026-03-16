"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { useApiKey } from "@/hooks/use-api-key";
import { useGeminiModels } from "@/hooks/use-gemini-models";
import type { AnalysisResult, PrResult } from "@/types";

export default function DashboardPage() {
  const { data: session } = useSession();
  const {
    selectedModel,
    setSelectedModel,
    clearAll,
    isLoaded,
  } = useApiKey();
  const { models, loading: modelsLoading, error: modelsError } =
    useGeminiModels();

  const [repoUrl, setRepoUrl] = useState("");
  const [targetLocale, setTargetLocale] = useState("es");
  const [fixModes, setFixModes] = useState({ seo: true, aria: true, fullPage: false });
  const [analyzing, setAnalyzing] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [prResult, setPrResult] = useState<PrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [fixLog, setFixLog] = useState<string[]>([]);

  async function handleAnalyze() {
    if (!repoUrl) return;
    setAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setPrResult(null);
    setStatusMsg("Cloning repo → pattern scanning → Gemini semantic analysis...");
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
    if (!analysis || !selectedModel) return;
    setFixing(true);
    setError(null);
    setPrResult(null);
    setFixLog([]);
    setStatusMsg(
      "Translating with lingo.dev SDK → optimizing keywords with Gemini → pushing to GitHub..."
    );
    try {
      const res = await fetch("/api/fix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          modelName: selectedModel,
          targetLocale,
          fixModes,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.fixLog) setFixLog(data.fixLog);
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

  const canFix = selectedModel && analysis;

  const gradeColor = (grade: string) => {
    if (grade === "A") return "var(--accent)";
    if (grade === "B") return "#60a5fa";
    if (grade === "C") return "#facc15";
    return "#f87171";
  };

  const scoreColor = (val: number) =>
    val >= 80 ? "var(--accent)" : val >= 60 ? "#facc15" : "#f87171";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--fg)", fontFamily: "var(--font-mono)" }}>

      {/* NAV */}
      <nav style={{
        borderBottom: "1px solid var(--border)",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{
            fontFamily: "var(--font-display)",
            fontSize: "22px",
            letterSpacing: "0.05em",
            color: "var(--fg)",
          }}>LINGOSEO_</span>
          <span style={{
            fontSize: "10px",
            fontFamily: "var(--font-mono)",
            padding: "2px 8px",
            border: "1px solid var(--accent)",
            color: "var(--accent)",
            letterSpacing: "0.1em",
          }}>POWERED BY LINGO.DEV</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "20px", fontSize: "12px" }}>
          <span style={{ color: "var(--fg-muted)" }}>{session?.user?.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              color: "var(--fg-muted)",
              padding: "4px 12px",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              cursor: "pointer",
              letterSpacing: "0.08em",
            }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--fg)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--fg-muted)")}
          >
            SIGN OUT
          </button>
        </div>
      </nav>

      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "40px 24px" }}>

        {/* PAGE HEADER */}
        <div style={{ marginBottom: "48px" }}>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(48px, 8vw, 80px)",
            lineHeight: 0.95,
            letterSpacing: "0.02em",
            color: "var(--fg)",
            marginBottom: "12px",
          }}>
            SEO<br />
            <span style={{ color: "var(--accent)" }}>SCANNER_</span>
          </div>
          <p style={{ fontSize: "12px", color: "var(--fg-muted)", maxWidth: "480px", lineHeight: 1.6 }}>
            Scan a GitHub repo → translate SEO content via <strong style={{ color: "var(--fg)" }}>lingo.dev SDK</strong> → optimize keywords with Gemini → push as a PR.
          </p>
        </div>

        {/* STEP 01 — MODEL */}
        <div style={{ marginBottom: "2px" }}>
          <div style={{
            display: "flex",
            alignItems: "baseline",
            gap: "16px",
            padding: "16px 0",
            borderTop: "1px solid var(--border)",
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "13px", color: "var(--fg-muted)", letterSpacing: "0.1em" }}>01</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "22px", letterSpacing: "0.05em" }}>ENGINE</span>
          </div>
        </div>
        <div style={{ border: "1px solid var(--border)", padding: "24px", marginBottom: "32px" }}>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>GEMINI MODEL</label>
            {modelsLoading ? (
              <div style={{ ...inputStyle, color: "var(--fg-muted)" }}>LOADING MODELS...</div>
            ) : modelsError ? (
              <div style={{ ...inputStyle, border: "1px solid #f87171", color: "#f87171" }}>{modelsError}</div>
            ) : (
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{ ...inputStyle, cursor: "pointer" }}
              >
                <option value="">SELECT MODEL...</option>
                {models.map((m) => (
                  <option key={m.name} value={m.name}>{m.displayName}</option>
                ))}
              </select>
            )}
          </div>

          <div style={{ padding: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", fontSize: "11px", color: "var(--fg-muted)", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--fg)" }}>HOW IT WORKS:</strong> lingo.dev SDK translates your content in-place. Gemini ensures translated keywords match what people actually search for in each locale. All API keys are server-side — nothing stored in your browser.
          </div>
        </div>

        {/* STEP 02 — REPOSITORY */}
        <div style={{ marginBottom: "2px" }}>
          <div style={{
            display: "flex",
            alignItems: "baseline",
            gap: "16px",
            padding: "16px 0",
            borderTop: "1px solid var(--border)",
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "13px", color: "var(--fg-muted)", letterSpacing: "0.1em" }}>02</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "22px", letterSpacing: "0.05em" }}>REPOSITORY</span>
          </div>
        </div>
        <div style={{ border: "1px solid var(--border)", padding: "24px", marginBottom: "32px" }}>
          <div style={{ marginBottom: "16px" }}>
            <label style={labelStyle}>GITHUB REPO URL</label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              style={inputStyle}
            />
          </div>
          <div style={{ marginBottom: "20px" }}>
            <label style={labelStyle}>TARGET LOCALE — ONE LANGUAGE PER PR</label>
            <select
              value={targetLocale}
              onChange={(e) => setTargetLocale(e.target.value)}
              style={{ ...inputStyle, cursor: "pointer" }}
            >
              {[
                { code: "ar",      label: "🇸🇦  Arabic (ar)" },
                { code: "ar-SA",   label: "🇸🇦  Arabic — Saudi (ar-SA)" },
                { code: "ar-EG",   label: "🇪🇬  Arabic — Egyptian (ar-EG)" },
                { code: "zh-Hans", label: "🇨🇳  Chinese Simplified (zh-Hans)" },
                { code: "zh-Hant", label: "🇹🇼  Chinese Traditional (zh-Hant)" },
                { code: "nl",      label: "🇳🇱  Dutch (nl)" },
                { code: "fr",      label: "🇫🇷  French (fr)" },
                { code: "fr-CA",   label: "🇨🇦  French — Canadian (fr-CA)" },
                { code: "de",      label: "🇩🇪  German (de)" },
                { code: "hi",      label: "🇮🇳  Hindi (hi)" },
                { code: "id",      label: "🇮🇩  Indonesian (id)" },
                { code: "it",      label: "🇮🇹  Italian (it)" },
                { code: "ja",      label: "🇯🇵  Japanese (ja)" },
                { code: "ko",      label: "🇰🇷  Korean (ko)" },
                { code: "pl",      label: "🇵🇱  Polish (pl)" },
                { code: "pt-BR",   label: "🇧🇷  Portuguese — Brazil (pt-BR)" },
                { code: "pt-PT",   label: "🇵🇹  Portuguese — Portugal (pt-PT)" },
                { code: "ru",      label: "🇷🇺  Russian (ru)" },
                { code: "es",      label: "🇪🇸  Spanish (es)" },
                { code: "es-MX",   label: "🇲🇽  Spanish — Mexico (es-MX)" },
                { code: "es-AR",   label: "🇦🇷  Spanish — Argentina (es-AR)" },
                { code: "sv",      label: "🇸🇪  Swedish (sv)" },
                { code: "tr",      label: "🇹🇷  Turkish (tr)" },
                { code: "uk",      label: "🇺🇦  Ukrainian (uk)" },
                { code: "vi",      label: "🇻🇳  Vietnamese (vi)" },
              ].map(({ code, label }) => (
                <option key={code} value={code}>{label}</option>
              ))}
            </select>
            <p style={{ fontSize: "10px", color: "var(--fg-muted)", marginTop: "6px", letterSpacing: "0.05em" }}>
              Each locale gets its own PR — culturally accurate, market-specific SEO keywords via Gemini
            </p>
          </div>
          {/* Fix mode toggles */}
          <div>
            <label style={labelStyle}>WHAT TO TRANSLATE</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {[
                {
                  key: "seo" as const,
                  label: "SEO METADATA",
                  sub: "localizeText · localizeObject",
                  desc: "Titles, meta descriptions, headings, hreflang, sitemap",
                },
                {
                  key: "aria" as const,
                  label: "ARIA + SCREEN READER",
                  sub: "localizeObject (batch)",
                  desc: "aria-label attributes, .sr-only text for blind users",
                },
                {
                  key: "fullPage" as const,
                  label: "FULL PAGE CONTENT",
                  sub: "localizeHtml",
                  desc: "Entire visible HTML body text, preserving all markup",
                },
              ].map(({ key, label, sub, desc }) => {
                const active = fixModes[key];
                const disabled = (key === "aria" && fixModes.fullPage) || (key === "seo" && fixModes.fullPage);
                return (
                  <button
                    key={key}
                    disabled={disabled}
                    onClick={() => setFixModes((p) => {
                      const next = { ...p, [key]: !p[key] };
                      if (key === "fullPage" && next.fullPage) {
                        // Full Page enables all three — SEO + ARIA + content
                        next.seo = true;
                        next.aria = true;
                      }
                      return next;
                    })}
                    style={{
                      background: active ? "var(--accent)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
                      color: active ? "#070707" : "var(--fg-muted)",
                      padding: "10px 14px",
                      cursor: disabled ? "not-allowed" : "pointer",
                      textAlign: "left",
                      fontFamily: "var(--font-mono)",
                      minWidth: "180px",
                      flex: "1",
                      opacity: disabled ? 0.35 : 1,
                    }}
                  >
                    <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", marginBottom: "3px" }}>
                      {active ? "✓ " : ""}{label}
                    </div>
                    <div style={{ fontSize: "9px", letterSpacing: "0.06em", opacity: 0.7, marginBottom: "4px" }}>
                      {sub}
                    </div>
                    <div style={{ fontSize: "9px", opacity: 0.55, lineHeight: 1.4 }}>
                      {(key === "aria" || key === "seo") && fixModes.fullPage ? "AUTO-ENABLED BY FULL PAGE" : desc}
                    </div>
                  </button>
                );
              })}
            </div>
            {!fixModes.seo && !fixModes.aria && !fixModes.fullPage && (
              <p style={{ fontSize: "10px", color: "#f87171", marginTop: "6px", letterSpacing: "0.05em" }}>
                SELECT AT LEAST ONE MODE
              </p>
            )}
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!repoUrl || analyzing}
            style={{
              ...accentBtnStyle,
              opacity: (!repoUrl || analyzing) ? 0.4 : 1,
              cursor: (!repoUrl || analyzing) ? "not-allowed" : "pointer",
            }}
          >
            {analyzing ? "[ SCANNING... ]" : "[ SCAN FOR SEO ISSUES ]"}
          </button>
        </div>

        {/* STATUS */}
        {statusMsg && (
          <div style={{
            marginBottom: "24px",
            padding: "16px",
            border: "1px solid var(--accent)",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            fontSize: "11px",
            letterSpacing: "0.05em",
          }}>
            <div style={{
              width: "12px", height: "12px",
              border: "2px solid var(--accent)",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              flexShrink: 0,
            }} />
            {statusMsg}
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div style={{
            marginBottom: "24px",
            padding: "16px",
            border: "1px solid #f87171",
            color: "#f87171",
            fontSize: "11px",
            letterSpacing: "0.05em",
          }}>
            ERROR: {error}
          </div>
        )}

        {/* STEP 03 — ANALYSIS RESULTS */}
        {analysis && (
          <>
            <div style={{ marginBottom: "2px" }}>
              <div style={{
                display: "flex",
                alignItems: "baseline",
                gap: "16px",
                padding: "16px 0",
                borderTop: "1px solid var(--border)",
              }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "13px", color: "var(--fg-muted)", letterSpacing: "0.1em" }}>03</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "22px", letterSpacing: "0.05em" }}>DIAGNOSIS</span>
                <span style={{ fontSize: "10px", color: "var(--fg-muted)", letterSpacing: "0.08em", marginLeft: "auto" }}>
                  {analysis.scannedFiles} FILES SCANNED
                  {analysis.localesDetected.length > 0 && <> · LOCALES: {analysis.localesDetected.join(", ").toUpperCase()}</>}
                </span>
              </div>
            </div>

            {/* ── DIAGNOSTIC PANEL ── */}
            <div style={{ border: "1px solid var(--border)", marginBottom: "24px", position: "relative", overflow: "hidden" }}>
              {/* Scanline overlay */}
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none", zIndex: 1,
                background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(168,255,62,0.015) 2px, rgba(168,255,62,0.015) 4px)",
              }} />

              {/* Top bar — terminal header */}
              <div style={{
                padding: "8px 16px",
                borderBottom: "1px solid var(--border)",
                display: "flex", alignItems: "center", gap: "8px",
                background: "rgba(168,255,62,0.03)",
              }}>
                <div style={{ width: "6px", height: "6px", background: analysis.score.total >= 60 ? "var(--accent)" : "#f87171", boxShadow: `0 0 6px ${analysis.score.total >= 60 ? "var(--accent)" : "#f87171"}` }} />
                <span style={{ fontSize: "9px", color: "var(--fg-muted)", letterSpacing: "0.14em", fontFamily: "var(--font-mono)" }}>
                  LINGOSEO://HEALTH-MONITOR v1.0 — {new Date().toISOString().split("T")[0]}
                </span>
                <span style={{ marginLeft: "auto", fontSize: "9px", color: "var(--fg-muted)", letterSpacing: "0.1em" }}>
                  PID {Math.floor(Math.random() * 9000 + 1000)}
                </span>
              </div>

              {/* Grade + diagnostic bars */}
              <div style={{ display: "grid", gridTemplateColumns: "140px 1fr" }}>
                {/* Grade cell */}
                <div style={{
                  borderRight: "1px solid var(--border)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "28px 0",
                  position: "relative",
                  background: `radial-gradient(circle at center, ${gradeColor(analysis.score.grade)}08, transparent 70%)`,
                }}>
                  <div style={{ fontSize: "9px", color: "var(--fg-muted)", letterSpacing: "0.16em", marginBottom: "8px", fontFamily: "var(--font-mono)" }}>
                    GRADE
                  </div>
                  <div style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "96px", lineHeight: 0.85,
                    color: gradeColor(analysis.score.grade),
                    textShadow: `0 0 40px ${gradeColor(analysis.score.grade)}30`,
                    position: "relative",
                  }}>
                    {analysis.score.grade}
                  </div>
                  <div style={{
                    marginTop: "8px", padding: "2px 10px",
                    border: `1px solid ${gradeColor(analysis.score.grade)}60`,
                    fontSize: "12px", fontFamily: "var(--font-mono)",
                    color: gradeColor(analysis.score.grade),
                    letterSpacing: "0.1em",
                  }}>
                    {analysis.score.total}/100
                  </div>
                </div>

                {/* Diagnostic bars */}
                <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "12px", justifyContent: "center" }}>
                  <div style={{ fontSize: "9px", color: "var(--fg-muted)", letterSpacing: "0.14em", marginBottom: "4px", fontFamily: "var(--font-mono)" }}>
                    {">"} SUBSYSTEM DIAGNOSTICS
                  </div>
                  {Object.entries(analysis.score.breakdown).map(([key, val]) => {
                    const c = scoreColor(val);
                    const pct = val;
                    const label = key.replace(/([A-Z])/g, " $1").toUpperCase().trim();
                    const status = val >= 80 ? "NOMINAL" : val >= 60 ? "DEGRADED" : "CRITICAL";
                    return (
                      <div key={key}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <span style={{ fontSize: "9px", color: "var(--fg-muted)", letterSpacing: "0.1em", fontFamily: "var(--font-mono)" }}>
                            {label}
                          </span>
                          <span style={{ fontSize: "9px", color: c, letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
                            {status} [{val}]
                          </span>
                        </div>
                        <div style={{ position: "relative", height: "8px", background: "rgba(255,255,255,0.04)", overflow: "hidden" }}>
                          <div style={{
                            position: "absolute", left: 0, top: 0, bottom: 0,
                            width: `${pct}%`, background: c,
                            boxShadow: `0 0 8px ${c}40`,
                            transition: "width 0.6s ease-out",
                          }} />
                          {/* Tick marks */}
                          {[25, 50, 75].map(tick => (
                            <div key={tick} style={{
                              position: "absolute", left: `${tick}%`, top: 0, bottom: 0,
                              width: "1px", background: "rgba(255,255,255,0.08)",
                            }} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Severity readout — horizontal strip */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid var(--border)" }}>
                {[
                  { label: "CRITICAL", count: analysis.summary.critical, color: "#f87171", icon: "▲", desc: "Blocks search indexing" },
                  { label: "WARNING", count: analysis.summary.warning, color: "#facc15", icon: "◆", desc: "Hurts discoverability" },
                  { label: "INFO", count: analysis.summary.info, color: "#60a5fa", icon: "●", desc: "Optimization opportunity" },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    padding: "14px 20px",
                    borderRight: i < 2 ? "1px solid var(--border)" : "none",
                    position: "relative",
                    overflow: "hidden",
                  }}>
                    {/* Glow behind count when > 0 */}
                    {s.count > 0 && (
                      <div style={{
                        position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)",
                        width: "40px", height: "40px", borderRadius: "50%",
                        background: `${s.color}12`, filter: "blur(12px)", pointerEvents: "none",
                      }} />
                    )}
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px", position: "relative" }}>
                      <span style={{ fontSize: "10px", color: s.color }}>{s.icon}</span>
                      <span style={{
                        fontFamily: "var(--font-display)", fontSize: "36px",
                        color: s.count > 0 ? s.color : "rgba(255,255,255,0.15)", lineHeight: 1,
                      }}>{s.count}</span>
                      <span style={{ fontSize: "8px", color: s.color, letterSpacing: "0.12em", opacity: 0.8 }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: "9px", color: "var(--fg-muted)", marginTop: "4px", letterSpacing: "0.05em", position: "relative" }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── ISSUE CARDS — filtered by selected mode ── */}
            {(() => {
              // Locale-specific cultural context
              const LOCALE_CONTEXT: Record<string, Record<string, string>> = {
                "missing-hreflang": {
                  es: "Spanish is spoken in 20+ countries — Spain, Mexico, Argentina all use different search terms. Without hreflang, Google shows Mexicans your Spain-targeted page (or vice versa), hurting click-through rates by up to 60%.",
                  ar: "Arabic has major dialect differences between Gulf Arabic (UAE, Saudi), Egyptian Arabic, and Levantine. A Saudi user seeing an Egyptian-targeted page feels mismatched — lower trust, higher bounce rate.",
                  zh: "Google is blocked in China — Chinese users use Baidu. Without hreflang, even your Simplified Chinese page won't reach mainland China. Traditional Chinese (zh-TW) users in Taiwan use Google but expect a different vocabulary.",
                  pt: "Brazilian Portuguese (pt-BR) and European Portuguese (pt-PT) are mutually intelligible but feel very different. Brazilian users distrust European-style copy — it reads as formal and distant to them.",
                  fr: "French Canadians (fr-CA) are fiercely protective of their dialect and will leave a site that addresses them in European French. Quebec has its own search behavior and social proof signals.",
                  de: "Germany, Austria, and Switzerland use German but have different formalness expectations. Swiss German users expect 'Sie' formality; Germans are more variable. Wrong targeting erodes trust immediately.",
                  ja: "Japanese search queries are dramatically shorter and more ambiguous than English. Keywords that work in English translate to verbose Japanese phrases nobody types. Google Japan uses different ranking signals.",
                  ko: "Korean users predominantly use Naver, not Google. Without locale signals, your page won't be indexed correctly on Naver, which controls 70%+ of Korean search traffic.",
                  hi: "Hindi speakers in India predominantly use Google, but mix English and Hindi in searches (Hinglish). Pages in pure Hindi often underperform versus mixed-language pages for Indian audiences.",
                },
                "missing-title": {
                  es: "Spanish speakers type longer, more descriptive queries than English speakers. A title optimized for English ('Best CRM') may not match Spanish search behavior ('mejor CRM para pequeñas empresas'). Without a locale-optimized title, you're invisible.",
                  ar: "Arabic Google searches tend to be question-based. Titles that don't include Arabic question patterns get much lower click-through rates.",
                  zh: "Baidu gives extra weight to titles. A Chinese user won't click a result that doesn't immediately signal relevance — the title must use the exact search term they typed.",
                  ja: "Japanese titles must balance keyword density differently — stuffing keywords looks spammy in Japanese. Titles should use natural phrasing that matches conversational Japanese search patterns.",
                },
                "missing-meta-description": {
                  es: "Spanish descriptions need to match the region — Mexican users respond to direct, benefit-focused copy; Spanish users prefer formal, feature-focused descriptions.",
                  ar: "Arabic reads right-to-left. If your meta description has mixed directionality, it renders incorrectly in Google's Arabic search results.",
                  zh: "Chinese descriptions must be under ~78 Chinese characters (not 160 English characters) or they get cut off — Google's snippet length is measured in pixels.",
                },
                "untranslated-aria-labels": {
                  es: "In Latin America, web accessibility litigation is rising rapidly. A blind Spanish-speaking user who hears English aria-labels will immediately abandon your site.",
                  ar: "Arabic screen readers expect right-to-left reading order. English aria-labels mixed into Arabic content cause screen readers to switch reading direction mid-sentence.",
                  fr: "France has strict accessibility laws (RGAA). English labels are considered a legal compliance failure, not just a UX issue.",
                  de: "Germany's BFSG requires digital accessibility for most commercial websites by 2025. Untranslated ARIA labels are a compliance risk.",
                  ja: "Japanese screen reader users expect precise Japanese phrasing. Direct translations of English labels often sound robotic — a native speaker would never say them that way.",
                },
                "untranslated-sr-only": {
                  ar: "Screen reader text in Arabic must follow Arabic grammatical gender rules. English sr-only text skips this entirely, making the experience feel broken.",
                  es: "Spanish has gendered nouns — an English sr-only text like 'opens in new tab' translated literally sounds grammatically wrong. Native speakers notice immediately.",
                },
                "invalid-schema": {
                  es: "Google's Spanish-language rich results require valid schema. Spanish-speaking users heavily rely on rich snippets — invalid schema removes you from premium positions.",
                  zh: "Baidu has its own structured data format. JSON-LD for Google does not help with Baidu rich results.",
                  ja: "Japanese Google users have very high reliance on rich results — invalid schema means losing high-visibility positions.",
                },
                "missing-og-tags": {
                  es: "WhatsApp is the #1 social platform in Latin America. Broken OG tags show a blank preview — the link looks like spam.",
                  ar: "WhatsApp and Telegram are dominant in Arabic-speaking countries. No OG preview looks untrustworthy in Arab digital culture.",
                  zh: "WeChat uses OG tags for link previews — without them, your shared link shows as a plain URL, which Chinese users associate with scam content.",
                  ru: "VKontakte, the dominant Russian social network, uses OG tags for link previews. Without them, shared links look broken.",
                },
                "missing-nav-label": {
                  ar: "Arabic screen readers process landmarks right-to-left. Unlabeled navs are even more confusing because the user has zero context about which navigation region they've entered.",
                  ja: "Japanese assistive technology users heavily rely on landmark navigation. Japanese JAWS/NVDA users report unlabeled navs as one of the top frustrations.",
                  de: "Germany's BFSG (Barrierefreiheitsstärkungsgesetz) requires labeled landmarks by June 2025. Unlabeled navigation is a compliance risk.",
                  fr: "France's RGAA 4.1 requires all navigation landmarks to be distinguishable. This is a legal requirement, not just best practice.",
                },
                "missing-skip-link": {
                  ar: "Right-to-left keyboards navigate differently — without a skip link, Arabic keyboard users must tab through the entire nav in reverse visual order, which is deeply disorienting.",
                  ja: "Japanese websites often have dense navigation with 30+ links. Without skip links, keyboard users spend significant time reaching the main content.",
                  de: "BFSG accessibility law requires keyboard navigation shortcuts. Skip links are the minimum viable implementation.",
                  fr: "RGAA criterion 12.7 explicitly mandates skip links. French government auditors check for this specifically.",
                },
                "decorative-not-hidden": {
                  ja: "Japanese screen readers (PC-Talker, NVDA-JP) read emoji Unicode names in English even on Japanese pages. A blind Japanese user suddenly hears English words mid-sentence.",
                  ko: "Korean screen readers read emoji as their Unicode names — often in English — breaking the flow of Korean text for blind users.",
                  zh: "Chinese screen readers pronounce emoji names in English or as Unicode codepoints, creating an incomprehensible mix of languages for blind Mandarin speakers.",
                },
              };

              const localeRegion = targetLocale.split("-")[0].toLowerCase();
              const getLocaleContext = (issueType: string): string | null => {
                return LOCALE_CONTEXT[issueType]?.[localeRegion] || null;
              };

              // Before/after examples — IN-PLACE replacement
              const locale = targetLocale.toUpperCase();
              const ISSUE_META: Record<string, { title: string; plain: string; category: "SEO" | "ARIA" | "TECHNICAL"; catColor: string; beforeEx: string; afterEx: string }> = {
                "missing-title": {
                  title: "No Page Title",
                  plain: "Google uses the page title as the blue clickable link in search results. Without one, your page appears as a raw URL — nobody clicks that.",
                  category: "SEO", catColor: "var(--accent)",
                  beforeEx: `<head>\n  <!-- no <title> tag -->\n</head>`,
                  afterEx: `<title>Translated title for ${locale}\n  (50-60 chars, market keywords)</title>`,
                },
                "missing-meta-description": {
                  title: "No Search Preview Text",
                  plain: "The meta description is the 2-line summary under the blue link on Google. Without it, Google picks random text from your page.",
                  category: "SEO", catColor: "var(--accent)",
                  beforeEx: `<head>\n  <!-- no meta description -->\n</head>`,
                  afterEx: `<meta name="description"\n  content="Translated for ${locale} (150-160 chars)" />`,
                },
                "missing-hreflang": {
                  title: "Google Doesn't Know Other Languages Exist",
                  plain: `hreflang tags tell Google "show the ${locale} version to ${locale} speakers". Without them, Google shows your English page to everyone.`,
                  category: "SEO", catColor: "var(--accent)",
                  beforeEx: `<head>\n  <!-- no language targeting -->\n</head>`,
                  afterEx: `<link rel="alternate" hreflang="${targetLocale}"\n  href="https://site.com/${targetLocale}/" />\n<link rel="alternate" hreflang="x-default"\n  href="https://site.com/" />`,
                },
                "missing-og-tags": {
                  title: "No Social Share Preview",
                  plain: "When someone shares your link on WhatsApp, Twitter, or LinkedIn, Open Graph tags control the preview. Without them, shares look broken.",
                  category: "SEO", catColor: "var(--accent)",
                  beforeEx: `<!-- shared link shows blank card -->`,
                  afterEx: `<meta property="og:title"\n  content="Translated for ${locale}" />\n<meta property="og:description"\n  content="Translated for ${locale}" />`,
                },
                "missing-twitter-tags": {
                  title: "Twitter/X Shows Blank Card",
                  plain: "Twitter has its own tag format. Without it, links shared on Twitter show no image or preview — just a plain URL.",
                  category: "SEO", catColor: "var(--accent)",
                  beforeEx: `<!-- no twitter:card tag -->`,
                  afterEx: `<meta name="twitter:card"\n  content="summary_large_image" />`,
                },
                "untranslated-alt": {
                  title: "Image Labels Not Translated",
                  plain: "Alt text describes images to search engines and blind users. Untranslated alt text means Google can't index your images for other languages.",
                  category: "SEO", catColor: "var(--accent)",
                  beforeEx: `<img alt="Blue running shoe" />`,
                  afterEx: `<img alt="[translated to ${locale}]" />`,
                },
                "unoptimized-headings": {
                  title: "Main Heading Not Translated",
                  plain: "The H1 heading is the most important text on your page for search engines. If it's only in English, you're invisible in every other language.",
                  category: "SEO", catColor: "var(--accent)",
                  beforeEx: `<h1>Best Invoicing Software</h1>`,
                  afterEx: `<h1>[Translated to ${locale} with\n  market-specific keywords]</h1>`,
                },
                "missing-sitemap-locales": {
                  title: "Sitemap Missing Language Versions",
                  plain: "Your sitemap doesn't mention that your site has multiple languages. Google may never discover or index them.",
                  category: "SEO", catColor: "var(--accent)",
                  beforeEx: `<url>\n  <loc>https://site.com/</loc>\n</url>`,
                  afterEx: `<url>\n  <loc>https://site.com/</loc>\n  <xhtml:link hreflang="${targetLocale}"\n    href="https://site.com/${targetLocale}/" />\n</url>`,
                },
                "untranslated-aria-labels": {
                  title: "Buttons Unreadable to Blind Users",
                  plain: `Screen readers read aria-labels out loud. If your site targets ${locale} users but aria-labels are in English, blind users hear a foreign language for every button.`,
                  category: "ARIA", catColor: "#60a5fa",
                  beforeEx: `<button aria-label="Close menu">\n  <!-- blind ${locale} user hears English -->`,
                  afterEx: `<button aria-label="[translated to ${locale}]">\n  <!-- native-sounding, not literal -->`,
                },
                "untranslated-sr-only": {
                  title: "Screen Reader Text Not Translated",
                  plain: ".sr-only elements are invisible text for screen readers. If untranslated, blind users get English in the middle of a foreign-language page.",
                  category: "ARIA", catColor: "#60a5fa",
                  beforeEx: `<span class="sr-only">\n  Opens in new tab\n</span>`,
                  afterEx: `<span class="sr-only">\n  [translated to ${locale}]\n</span>`,
                },
                "missing-jsonld-localization": {
                  title: "Structured Data Not Translated",
                  plain: "JSON-LD helps Google understand your content for rich snippets. If only in English, rich results only appear for English searches.",
                  category: "SEO", catColor: "var(--accent)",
                  beforeEx: `{ "name": "Blue Running Shoe" }`,
                  afterEx: `{ "name": "[translated to ${locale}]" }`,
                },
                // ── Structural ARIA issues ──
                "missing-nav-label": {
                  title: "Navigation Has No Label",
                  plain: "When a page has multiple <nav> elements (header + footer), screen readers list them all as \"navigation\" with no way to tell them apart. Each needs an aria-label.",
                  category: "ARIA", catColor: "#60a5fa",
                  beforeEx: `<nav>\n  <ul class="nav-links">...</ul>\n</nav>`,
                  afterEx: `<nav aria-label="[translated: Main navigation]">\n  <ul class="nav-links">...</ul>\n</nav>`,
                },
                "missing-skip-link": {
                  title: "No Skip Navigation Link",
                  plain: "Keyboard users must tab through every nav link on every page load. A hidden \"Skip to main content\" link lets them jump straight to the content — it's a WCAG 2.1 requirement.",
                  category: "ARIA", catColor: "#60a5fa",
                  beforeEx: `<body>\n  <nav><!-- 15 links --></nav>\n  <main>...`,
                  afterEx: `<body>\n  <a class="sr-only" href="#main">\n    [translated: Skip to main content]\n  </a>\n  <nav>...`,
                },
                "decorative-not-hidden": {
                  title: "Decorative Emoji Read Aloud",
                  plain: "Screen readers announce every emoji — a sighted user sees a rocket icon, but a blind user hears \"rocket\" interrupting the sentence. Decorative emoji should be hidden from assistive tech.",
                  category: "ARIA", catColor: "#60a5fa",
                  beforeEx: `<span>🚀 Fast Deploys</span>\n<!-- SR reads: "rocket Fast Deploys" -->`,
                  afterEx: `<span><span aria-hidden="true">🚀</span>\n  Fast Deploys</span>`,
                },
                "action-link-no-role": {
                  title: "Action Button Pretending to Be a Link",
                  plain: "Links with href=\"#\" that trigger actions confuse screen readers — they announce \"link\" but the element behaves like a button. Blind users expect links to navigate somewhere.",
                  category: "ARIA", catColor: "#60a5fa",
                  beforeEx: `<a href="#">Get Started</a>\n<!-- SR: "link, Get Started" -->`,
                  afterEx: `<a href="#" role="button">\n  Get Started\n</a>\n<!-- or better: <button> -->`,
                },
                "missing-region-label": {
                  title: "Unnamed Page Section",
                  plain: "Screen reader users navigate by landmarks (regions). A <section> without a heading or aria-label appears as \"unnamed region\" — useless for navigation.",
                  category: "ARIA", catColor: "#60a5fa",
                  beforeEx: `<section class="pricing">\n  <!-- no heading, no label -->\n</section>`,
                  afterEx: `<section aria-label="[translated: Pricing]">\n  ...\n</section>`,
                },
                "missing-icon-hiding": {
                  title: "Icon Fonts Not Hidden from Screen Readers",
                  plain: "Icon font <i> elements (Font Awesome, etc.) render as invisible empty text without the CSS loaded. Screen readers get silent gaps or garbled characters for each icon.",
                  category: "ARIA", catColor: "#60a5fa",
                  beforeEx: `<a href="/twitter">\n  <i class="fa-brands fa-twitter"></i>\n</a>`,
                  afterEx: `<a href="/twitter" aria-label="[translated: Twitter]">\n  <i class="fa-brands fa-twitter"\n    aria-hidden="true"></i>\n</a>`,
                },
              };

              // Only show issues the fixer will TRANSLATE — no technical faults
              const showSeo = fixModes.seo || fixModes.fullPage;
              const showAria = fixModes.aria || fixModes.fullPage;

              const relevantIssues = analysis.issues.filter(i => {
                const meta = ISSUE_META[i.type];
                if (!meta) return false;
                if (meta.category === "SEO" && !showSeo) return false;
                if (meta.category === "ARIA" && !showAria) return false;
                return true;
              });

              const grouped: Record<string, typeof analysis.issues> = {};
              if (showSeo) grouped.SEO = relevantIssues.filter(i => ISSUE_META[i.type]?.category === "SEO");
              if (showAria) grouped.ARIA = relevantIssues.filter(i => ISSUE_META[i.type]?.category === "ARIA");

              // Deduplicate: one issue per type+filePath
              for (const cat of Object.keys(grouped)) {
                const seen = new Set<string>();
                grouped[cat] = grouped[cat].filter(i => {
                  const key = `${i.type}::${i.filePath}`;
                  if (seen.has(key)) return false;
                  seen.add(key);
                  return true;
                });
              }

              const catConfig: Record<string, { color: string; label: string; desc: string; modeKey: string }> = {
                SEO: { color: "var(--accent)", label: "SEO TRANSLATIONS", desc: "Titles, descriptions, headings, alt text, OG tags → translated to " + locale, modeKey: "SEO METADATA" },
                ARIA: { color: "#60a5fa", label: "ARIA TRANSLATIONS", desc: "aria-label, .sr-only text → translated to " + locale, modeKey: "ARIA + SCREEN READER" },
              };

              return (Object.entries(grouped) as [string, typeof analysis.issues][]).map(([cat, issues]) => {
                if (issues.length === 0) return null;
                const cfg = catConfig[cat];
                return (
                  <div key={cat} style={{ marginBottom: "24px" }}>
                    {/* Category header — connects to fix mode */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "10px 16px",
                      background: `${cfg.color}08`,
                      borderTop: `2px solid ${cfg.color}`,
                      borderLeft: `1px solid ${cfg.color}30`,
                      borderRight: `1px solid ${cfg.color}30`,
                      marginBottom: 0,
                    }}>
                      <div style={{
                        width: "8px", height: "8px",
                        background: cfg.color,
                        boxShadow: `0 0 6px ${cfg.color}60`,
                        flexShrink: 0,
                      }} />
                      <span style={{
                        fontFamily: "var(--font-display)", fontSize: "18px",
                        color: cfg.color, letterSpacing: "0.08em",
                      }}>{cfg.label}</span>
                      <span style={{
                        fontSize: "8px", padding: "2px 6px",
                        border: `1px solid ${cfg.color}40`,
                        color: cfg.color, letterSpacing: "0.1em",
                        opacity: 0.7,
                      }}>
                        {issues.length} ISSUE{issues.length !== 1 ? "S" : ""}
                      </span>
                      <span style={{ fontSize: "9px", color: "var(--fg-muted)", letterSpacing: "0.05em", marginLeft: "auto" }}>
                        FIXED BY: {cfg.modeKey}
                      </span>
                    </div>

                    {/* Issue cards */}
                    {issues.map((issue, idx) => {
                      const meta = ISSUE_META[issue.type];
                      const sColor = issue.severity === "critical" ? "#f87171" : issue.severity === "warning" ? "#facc15" : "#60a5fa";
                      const sIcon = issue.severity === "critical" ? "▲" : issue.severity === "warning" ? "◆" : "●";
                      return (
                        <div key={issue.id} style={{
                          borderLeft: `1px solid ${cfg.color}30`,
                          borderRight: `1px solid ${cfg.color}30`,
                          borderBottom: `1px solid ${cfg.color}20`,
                          padding: "20px 20px 16px",
                          background: idx % 2 === 0 ? "#0a0a0a" : "#090909",
                          position: "relative",
                        }}>
                          {/* Severity indicator — left edge */}
                          <div style={{
                            position: "absolute", left: 0, top: 0, bottom: 0,
                            width: "3px", background: sColor,
                            opacity: issue.severity === "critical" ? 1 : 0.5,
                          }} />

                          <div style={{ marginLeft: "8px" }}>
                            {/* Title row */}
                            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                              <span style={{ fontSize: "10px", color: sColor }}>{sIcon}</span>
                              {meta ? (
                                <span style={{ fontFamily: "var(--font-display)", fontSize: "17px", letterSpacing: "0.04em", color: "var(--fg)" }}>
                                  {meta.title}
                                </span>
                              ) : (
                                <span style={{ fontSize: "12px", color: "var(--fg)" }}>{issue.message}</span>
                              )}
                              <span style={{
                                fontSize: "8px", letterSpacing: "0.12em",
                                color: sColor, border: `1px solid ${sColor}50`,
                                padding: "1px 6px", background: `${sColor}08`,
                              }}>{issue.severity.toUpperCase()}</span>
                            </div>

                            {/* Plain English explanation */}
                            {meta && (
                              <>
                                <p style={{ fontSize: "11px", color: "var(--fg-muted)", lineHeight: 1.8, margin: "0 0 0 20px", maxWidth: "580px" }}>
                                  {meta.plain}
                                </p>

                                {/* Locale-specific context callout */}
                                {getLocaleContext(issue.type) && (
                                  <div style={{
                                    marginTop: "10px", marginLeft: "20px",
                                    padding: "10px 14px",
                                    background: "rgba(168,255,62,0.03)",
                                    borderLeft: "3px solid var(--accent)",
                                    maxWidth: "580px",
                                    position: "relative",
                                  }}>
                                    <div style={{ fontSize: "8px", color: "var(--accent)", letterSpacing: "0.14em", marginBottom: "5px", fontFamily: "var(--font-mono)" }}>
                                      {">"} WHY THIS MATTERS FOR {targetLocale.toUpperCase()} USERS
                                    </div>
                                    <p style={{ fontSize: "10px", color: "rgba(168,255,62,0.7)", lineHeight: 1.7, margin: 0 }}>
                                      {getLocaleContext(issue.type)}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}

                            {/* File path */}
                            <div style={{ fontSize: "9px", color: "var(--fg-muted)", marginTop: "8px", marginLeft: "20px", letterSpacing: "0.05em", opacity: 0.45, fontFamily: "var(--font-mono)" }}>
                              {issue.filePath}
                              {issue.line ? ` : ${issue.line}` : ""}
                            </div>

                            {/* Before / After — visual diff */}
                            {meta && (
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr", gap: "0", marginLeft: "20px", marginTop: "12px" }}>
                                <div>
                                  <div style={{ fontSize: "8px", color: "#f87171", letterSpacing: "0.14em", marginBottom: "4px", fontFamily: "var(--font-mono)" }}>
                                    BEFORE
                                  </div>
                                  <pre style={{
                                    margin: 0, padding: "10px 12px",
                                    background: "rgba(248,113,113,0.04)",
                                    border: "1px solid rgba(248,113,113,0.15)",
                                    borderRight: "none",
                                    fontSize: "9px", color: "#f87171",
                                    fontFamily: "var(--font-mono)",
                                    lineHeight: 1.6, overflow: "auto",
                                    whiteSpace: "pre-wrap", wordBreak: "break-all",
                                    opacity: 0.8,
                                  }}>{issue.currentValue || meta.beforeEx}</pre>
                                </div>
                                {/* Arrow connector */}
                                <div style={{
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  paddingTop: "18px",
                                }}>
                                  <span style={{ fontSize: "14px", color: "var(--fg-muted)", opacity: 0.3 }}>→</span>
                                </div>
                                <div>
                                  <div style={{ fontSize: "8px", color: "var(--accent)", letterSpacing: "0.14em", marginBottom: "4px", fontFamily: "var(--font-mono)" }}>
                                    AFTER ({locale})
                                  </div>
                                  <pre style={{
                                    margin: 0, padding: "10px 12px",
                                    background: "rgba(168,255,62,0.04)",
                                    border: "1px solid rgba(168,255,62,0.15)",
                                    borderLeft: "none",
                                    fontSize: "9px", color: "var(--accent)",
                                    fontFamily: "var(--font-mono)",
                                    lineHeight: 1.6, overflow: "auto",
                                    whiteSpace: "pre-wrap", wordBreak: "break-all",
                                  }}>{issue.suggestedFix || meta.afterEx}</pre>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              });
            })()}

            {/* FIX BUTTON */}
            <div style={{
              padding: "24px",
              border: "1px solid var(--border)",
              display: "flex", alignItems: "center", gap: "16px",
              marginBottom: "32px",
            }}>
              <button
                onClick={handleFixAndPr}
                disabled={fixing || !canFix}
                style={{
                  ...accentBtnStyle,
                  opacity: (fixing || !canFix) ? 0.4 : 1,
                  cursor: (fixing || !canFix) ? "not-allowed" : "pointer",
                }}
              >
                {fixing
                  ? "[ LINGO.DEV TRANSLATING → GEMINI OPTIMIZING → PUSHING... ]"
                  : `[ TRANSLATE & CREATE PR ]`}
              </button>
              {!canFix && (
                <span style={{ fontSize: "10px", color: "var(--fg-muted)", letterSpacing: "0.05em" }}>
                  {!selectedModel ? "SELECT A GEMINI MODEL" : ""}
                </span>
              )}
            </div>
          </>
        )}

        {/* STEP 04 — PR CREATED */}
        {prResult && (
          <>
            <div style={{ marginBottom: "2px" }}>
              <div style={{
                display: "flex",
                alignItems: "baseline",
                gap: "16px",
                padding: "16px 0",
                borderTop: "1px solid var(--accent)",
              }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "13px", color: "var(--accent)", letterSpacing: "0.1em" }}>04</span>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "22px", color: "var(--accent)", letterSpacing: "0.05em" }}>PR CREATED</span>
              </div>
            </div>
            <div style={{ border: "1px solid var(--accent)", padding: "24px", marginBottom: "32px" }}>
              <div style={{ display: "grid", gap: "12px", marginBottom: "20px", fontSize: "11px" }}>
                <div style={{ display: "flex", gap: "12px" }}>
                  <span style={{ color: "var(--fg-muted)", letterSpacing: "0.08em", minWidth: "120px" }}>BRANCH</span>
                  <code style={{ color: "var(--accent)", fontFamily: "var(--font-mono)" }}>{prResult.branchName}</code>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <span style={{ color: "var(--fg-muted)", letterSpacing: "0.08em", minWidth: "120px" }}>FILES CHANGED</span>
                  <span style={{ color: "var(--fg)" }}>{prResult.filesChanged}</span>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <span style={{ color: "var(--fg-muted)", letterSpacing: "0.08em", minWidth: "120px" }}>POWERED BY</span>
                  <span style={{ color: "var(--fg)" }}>lingo.dev SDK (localizeText · localizeObject · batchLocalizeText)</span>
                </div>
              </div>
              <a
                href={prResult.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 20px",
                  background: "var(--accent)",
                  color: "#070707",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  textDecoration: "none",
                }}
              >
                VIEW PULL REQUEST #{prResult.prNumber} →
              </a>
            </div>
          </>
        )}

        {/* FIX LOG */}
        {fixLog.length > 0 && (
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "16px", padding: "16px 0", borderTop: "1px solid var(--border)" }}>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "13px", color: "var(--fg-muted)", letterSpacing: "0.1em" }}>LOG</span>
              <span style={{ fontFamily: "var(--font-display)", fontSize: "22px", letterSpacing: "0.05em" }}>FIX ENGINE OUTPUT</span>
            </div>
            <div style={{ border: "1px solid var(--border)", background: "#050505", padding: "16px", maxHeight: "320px", overflowY: "auto" }}>
              {fixLog.map((line, i) => {
                const color = line.includes("✓") ? "var(--accent)"
                  : line.includes("✗") ? "#f87171"
                  : line.includes("⚠") ? "#facc15"
                  : line.startsWith("[GEMINI]") ? "#c084fc"
                  : line.startsWith("[LINGO]") ? "#60a5fa"
                  : "var(--fg-muted)";
                return (
                  <div key={i} style={{ fontSize: "10px", fontFamily: "var(--font-mono)", color, lineHeight: 1.8, letterSpacing: "0.03em" }}>
                    {line}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  background: "#111",
  border: "1px solid var(--border)",
  color: "var(--fg)",
  fontFamily: "var(--font-mono)",
  fontSize: "12px",
  outline: "none",
  boxSizing: "border-box",
  colorScheme: "dark",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "10px",
  color: "var(--fg-muted)",
  letterSpacing: "0.1em",
  marginBottom: "6px",
};

const accentBtnStyle: React.CSSProperties = {
  padding: "12px 24px",
  background: "var(--accent)",
  color: "#070707",
  border: "none",
  fontFamily: "var(--font-mono)",
  fontSize: "11px",
  fontWeight: 700,
  letterSpacing: "0.1em",
  cursor: "pointer",
};
