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
    selectedModel,
    setSelectedModel,
    clearAll,
    isLoaded,
  } = useApiKey();
  const { models, loading: modelsLoading, error: modelsError } =
    useGeminiModels(apiKey);

  const [repoUrl, setRepoUrl] = useState("");
  const [targetLocales, setTargetLocales] = useState("es,fr,de,ja");
  const [fixModes, setFixModes] = useState({ seo: true, aria: true, fullPage: false });
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
    if (!analysis || !selectedModel || !apiKey) return;
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
          fixModes,
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

  const canFix = selectedModel && apiKey && analysis;

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

        {/* STEP 01 — API KEYS */}
        <div style={{ marginBottom: "2px" }}>
          <div style={{
            display: "flex",
            alignItems: "baseline",
            gap: "16px",
            padding: "16px 0",
            borderTop: "1px solid var(--border)",
          }}>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "13px", color: "var(--fg-muted)", letterSpacing: "0.1em" }}>01</span>
            <span style={{ fontFamily: "var(--font-display)", fontSize: "22px", letterSpacing: "0.05em" }}>API KEYS</span>
          </div>
        </div>
        <div style={{ border: "1px solid var(--border)", padding: "24px", marginBottom: "32px" }}>
          <p style={{ fontSize: "11px", color: "var(--fg-muted)", marginBottom: "20px", letterSpacing: "0.05em" }}>
            KEYS STAY IN YOUR BROWSER (LOCALSTORAGE) — NEVER SENT TO OUR SERVER
          </p>

          {/* Gemini key + model */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={labelStyle}>GEMINI API KEY</label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                style={inputStyle}
              />
            </div>
            <div>
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
          </div>

          {(apiKey || lingoApiKey) && (
            <button
              onClick={clearAll}
              style={{ background: "none", border: "none", color: "var(--fg-muted)", fontSize: "10px", cursor: "pointer", letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f87171")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--fg-muted)")}
            >
              [ CLEAR ALL KEYS ]
            </button>
          )}

          <div style={{ marginTop: "16px", padding: "12px", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", fontSize: "11px", color: "var(--fg-muted)", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--fg)" }}>HOW IT WORKS:</strong> lingo.dev SDK translates your SEO content (titles, descriptions, headings, alt text, aria-labels) to all target locales. Then Gemini checks if translated keywords match what people actually search for in each locale and optimizes them.
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
            <label style={labelStyle}>TARGET LOCALES (COMMA-SEPARATED)</label>
            <input
              type="text"
              value={targetLocales}
              onChange={(e) => setTargetLocales(e.target.value)}
              placeholder="es,fr,de,ja,zh-Hans"
              style={inputStyle}
            />
            <p style={{ fontSize: "10px", color: "var(--fg-muted)", marginTop: "6px", letterSpacing: "0.05em" }}>
              lingo.dev will translate SEO content to these locales using its Localization Engine
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
                const disabled = key === "aria" && fixModes.fullPage;
                return (
                  <button
                    key={key}
                    disabled={disabled}
                    onClick={() => setFixModes((p) => {
                      const next = { ...p, [key]: !p[key] };
                      // Full Page already includes ARIA via localizeHtml
                      if (key === "fullPage" && next.fullPage) next.aria = false;
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
                      {disabled ? "INCLUDED IN FULL PAGE" : desc}
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

            {/* ── HEALTH MONITOR ── */}
            <div style={{ border: "1px solid var(--border)", marginBottom: "24px" }}>
              {/* Grade + bars */}
              <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", borderBottom: "1px solid var(--border)" }}>
                {/* Grade */}
                <div style={{
                  borderRight: "1px solid var(--border)",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  padding: "24px 0",
                  background: `${gradeColor(analysis.score.grade)}08`,
                }}>
                  <div style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "80px", lineHeight: 1,
                    color: gradeColor(analysis.score.grade),
                  }}>{analysis.score.grade}</div>
                  <div style={{ fontSize: "10px", color: "var(--fg-muted)", letterSpacing: "0.12em", marginTop: "4px" }}>
                    {analysis.score.total}/100
                  </div>
                </div>
                {/* Terminal bars */}
                <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: "14px", justifyContent: "center" }}>
                  <div style={{ fontSize: "9px", color: "var(--fg-muted)", letterSpacing: "0.12em", marginBottom: "2px" }}>
                    // SYSTEM HEALTH MONITOR
                  </div>
                  {Object.entries(analysis.score.breakdown).map(([key, val]) => {
                    const c = scoreColor(val);
                    const blocks = Math.round(val / 10);
                    return (
                      <div key={key} style={{ display: "grid", gridTemplateColumns: "96px 1fr 28px", gap: "10px", alignItems: "center" }}>
                        <span style={{ fontSize: "9px", color: "var(--fg-muted)", letterSpacing: "0.1em" }}>
                          {key.replace(/([A-Z])/g, "_$1").toUpperCase()}
                        </span>
                        <div style={{ display: "flex", gap: "2px" }}>
                          {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} style={{
                              flex: 1, height: "10px",
                              background: i < blocks ? c : "rgba(255,255,255,0.06)",
                              transition: "background 0.3s",
                            }} />
                          ))}
                        </div>
                        <span style={{ fontSize: "10px", color: c, textAlign: "right", fontFamily: "var(--font-mono)" }}>{val}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Severity counts */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
                {[
                  { label: "CRITICAL", count: analysis.summary.critical, color: "#f87171", desc: "Blocking search ranking" },
                  { label: "WARNING", count: analysis.summary.warning, color: "#facc15", desc: "Hurting discoverability" },
                  { label: "INFO", count: analysis.summary.info, color: "#60a5fa", desc: "Could be improved" },
                ].map((s, i) => (
                  <div key={s.label} style={{
                    padding: "16px 20px",
                    borderRight: i < 2 ? "1px solid var(--border)" : "none",
                    borderTop: "1px solid var(--border)",
                  }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                      <span style={{ fontFamily: "var(--font-display)", fontSize: "40px", color: s.color, lineHeight: 1 }}>{s.count}</span>
                      <span style={{ fontSize: "9px", color: s.color, letterSpacing: "0.1em", opacity: 0.8 }}>{s.label}</span>
                    </div>
                    <div style={{ fontSize: "9px", color: "var(--fg-muted)", marginTop: "4px", letterSpacing: "0.05em" }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── ISSUE CARDS grouped by category ── */}
            {(() => {
              const ISSUE_META: Record<string, { title: string; plain: string; category: "SEO" | "ARIA" | "TECHNICAL"; catColor: string; fixMode: string; beforeEx: string; afterEx: string }> = {
                "missing-title": {
                  title: "No Page Title",
                  plain: "Google uses the page title as the blue clickable link in search results. Without one, your page appears as a raw URL — nobody clicks that.",
                  category: "SEO", catColor: "var(--accent)", fixMode: "SEO METADATA",
                  beforeEx: `<head>\n  <!-- no <title> tag -->\n</head>`,
                  afterEx: `<head>\n  <title>Your Page Title (50-60 chars)</title>\n</head>`,
                },
                "missing-meta-description": {
                  title: "No Search Preview Text",
                  plain: "The meta description is the 2-line summary under the blue link on Google. Without it, Google picks random text from your page — usually bad.",
                  category: "SEO", catColor: "var(--accent)", fixMode: "SEO METADATA",
                  beforeEx: `<head>\n  <!-- no meta description -->\n</head>`,
                  afterEx: `<meta name="description"\n  content="Your 150-160 char summary..." />`,
                },
                "missing-hreflang": {
                  title: "Google Doesn't Know Other Languages Exist",
                  plain: "hreflang tags tell Google 'show the Spanish version to Spanish speakers'. Without them, Google shows your English page to everyone — even people who don't read English.",
                  category: "SEO", catColor: "var(--accent)", fixMode: "SEO METADATA",
                  beforeEx: `<head>\n  <!-- no language targeting -->\n</head>`,
                  afterEx: `<link rel="alternate" hreflang="es"\n  href="https://site.com/es/" />\n<link rel="alternate" hreflang="x-default"\n  href="https://site.com/" />`,
                },
                "missing-og-tags": {
                  title: "No Social Share Preview",
                  plain: "When someone shares your link on WhatsApp, Twitter, or LinkedIn, Open Graph tags control the image, title, and description that appear. Without them, shares look broken.",
                  category: "SEO", catColor: "var(--accent)", fixMode: "SEO METADATA",
                  beforeEx: `<!-- shared link shows blank card -->`,
                  afterEx: `<meta property="og:title" content="..." />\n<meta property="og:description" content="..." />\n<meta property="og:image" content="/og.png" />`,
                },
                "missing-twitter-tags": {
                  title: "Twitter/X Shows Blank Card",
                  plain: "Twitter has its own separate tag format. Without it, links shared on Twitter show no image or preview — just a plain URL.",
                  category: "SEO", catColor: "var(--accent)", fixMode: "SEO METADATA",
                  beforeEx: `<!-- no twitter:card tag -->`,
                  afterEx: `<meta name="twitter:card"\n  content="summary_large_image" />`,
                },
                "untranslated-alt": {
                  title: "Image Labels Not Translated",
                  plain: "Alt text describes images to search engines and blind users. Untranslated alt text means Google can't index your images in other languages, and blind users hear English in a foreign-language page.",
                  category: "SEO", catColor: "var(--accent)", fixMode: "SEO METADATA",
                  beforeEx: `<img src="product.jpg"\n  alt="Blue running shoe" />`,
                  afterEx: `<img src="product.jpg"\n  alt="Blue running shoe"\n  data-alt-es="Zapatilla azul"\n  data-alt-ar="حذاء ركض أزرق" />`,
                },
                "unoptimized-headings": {
                  title: "Main Heading Not Translated",
                  plain: "The H1 heading is the most important text on your page for search engines. If it's only in English, you're invisible in every other language.",
                  category: "SEO", catColor: "var(--accent)", fixMode: "SEO METADATA",
                  beforeEx: `<h1>Best Invoicing Software</h1>\n<!-- no translations -->`,
                  afterEx: `<h1 data-lingo-es="Mejor software de facturación"\n    data-lingo-ar="أفضل برنامج فوترة">\n  Best Invoicing Software\n</h1>`,
                },
                "missing-sitemap-locales": {
                  title: "Sitemap Missing Language Versions",
                  plain: "A sitemap is a list of all your pages that you submit to Google. If it doesn't mention that your site has multiple languages, Google may never discover or index them.",
                  category: "SEO", catColor: "var(--accent)", fixMode: "SEO METADATA",
                  beforeEx: `<url>\n  <loc>https://site.com/</loc>\n  <!-- no language alternates -->\n</url>`,
                  afterEx: `<url>\n  <loc>https://site.com/</loc>\n  <xhtml:link rel="alternate" hreflang="es"\n    href="https://site.com/es/" />\n</url>`,
                },
                "untranslated-aria-labels": {
                  title: "Buttons Unreadable to Blind Users",
                  plain: "Screen readers (used by blind people) read aria-labels out loud. If your site is in Arabic but aria-labels are in English, a blind Arabic user hears a foreign language for every button they encounter.",
                  category: "ARIA", catColor: "#60a5fa", fixMode: "ARIA + SCREEN READER",
                  beforeEx: `<button aria-label="Close menu">\n  <!-- blind Arabic user hears English -->\n</button>`,
                  afterEx: `<button aria-label="Close menu"\n  data-aria-ar="إغلاق القائمة"\n  data-aria-es="Cerrar menú">\n</button>`,
                },
                "untranslated-sr-only": {
                  title: "Screen Reader Text Not Translated",
                  plain: ".sr-only elements are invisible text written purely for screen readers. They provide context like 'navigation menu' or 'opens in new tab'. If untranslated, blind users get English in the middle of any other language.",
                  category: "ARIA", catColor: "#60a5fa", fixMode: "ARIA + SCREEN READER",
                  beforeEx: `<span class="sr-only">Opens in new tab</span>\n<!-- invisible to sighted, but screen reader\n     reads English to Arabic users -->`,
                  afterEx: `<span class="sr-only"\n  data-sr-ar="يفتح في تبويب جديد"\n  data-sr-es="Abre en nueva pestaña">\n  Opens in new tab\n</span>`,
                },
                "missing-html-lang": {
                  title: "Page Has No Language Declared",
                  plain: "The lang attribute on the <html> tag tells browsers, screen readers, and Google what language this page is in. Without it, nothing knows — and translation tools may apply the wrong language.",
                  category: "TECHNICAL", catColor: "#facc15", fixMode: "TECHNICAL",
                  beforeEx: `<html>\n  <!-- browser guesses the language -->`,
                  afterEx: `<html lang="en">\n  <!-- explicit: this page is English -->`,
                },
                "missing-canonical": {
                  title: "No Canonical URL",
                  plain: "If your site is accessible at multiple URLs (with/without www, http/https), Google treats them as duplicate pages and splits your ranking between them. A canonical tag says 'this is the real one'.",
                  category: "TECHNICAL", catColor: "#facc15", fixMode: "TECHNICAL",
                  beforeEx: `<!-- Google sees duplicates:\n  site.com/page\n  www.site.com/page\n  → splits ranking between them -->`,
                  afterEx: `<link rel="canonical"\n  href="https://site.com/page" />`,
                },
                "missing-viewport": {
                  title: "Mobile View Is Broken",
                  plain: "Without a viewport meta tag, your site shows desktop layout on mobile — tiny text, horizontal scrolling. Google ranks mobile-friendly pages higher since 2018.",
                  category: "TECHNICAL", catColor: "#facc15", fixMode: "TECHNICAL",
                  beforeEx: `<!-- mobile users see desktop layout\n     at 10% zoom, impossible to read -->`,
                  afterEx: `<meta name="viewport"\n  content="width=device-width,\n  initial-scale=1" />`,
                },
                "invalid-schema": {
                  title: "Structured Data Using Deprecated Format",
                  plain: "Schema markup is code that helps Google show rich results (star ratings, prices, FAQs). Using outdated schema types means Google ignores your structured data entirely.",
                  category: "TECHNICAL", catColor: "#facc15", fixMode: "TECHNICAL",
                  beforeEx: `{\n  "@type": "FAQPage",\n  // deprecated — Google ignores this\n}`,
                  afterEx: `{\n  "@type": "WebPage",\n  // use supported types only\n}`,
                },
                "missing-jsonld-localization": {
                  title: "Structured Data Not Translated",
                  plain: "JSON-LD structured data helps Google understand your content for rich snippets. If it's only in English, Google can only surface those rich results for English searches.",
                  category: "SEO", catColor: "var(--accent)", fixMode: "SEO METADATA",
                  beforeEx: `{\n  "name": "Blue Running Shoe",\n  // only English\n}`,
                  afterEx: `{\n  "name": "Blue Running Shoe",\n  "name-es": "Zapatilla azul de correr"\n}`,
                },
              };

              const grouped = {
                SEO: analysis.issues.filter(i => ISSUE_META[i.type]?.category === "SEO"),
                ARIA: analysis.issues.filter(i => ISSUE_META[i.type]?.category === "ARIA"),
                TECHNICAL: analysis.issues.filter(i => ISSUE_META[i.type]?.category === "TECHNICAL" || !ISSUE_META[i.type]),
              };

              const catConfig = {
                SEO: { color: "var(--accent)", label: "SEO", desc: "Fixed by: SEO METADATA mode", modeKey: "seo" as const },
                ARIA: { color: "#60a5fa", label: "ARIA", desc: "Fixed by: ARIA + SCREEN READER mode", modeKey: "aria" as const },
                TECHNICAL: { color: "#facc15", label: "TECHNICAL", desc: "Always fixed automatically", modeKey: null },
              };

              return (Object.entries(grouped) as [keyof typeof grouped, typeof analysis.issues][]).map(([cat, issues]) => {
                if (issues.length === 0) return null;
                const cfg = catConfig[cat];
                const modeActive = cfg.modeKey ? fixModes[cfg.modeKey] : true;
                return (
                  <div key={cat} style={{ marginBottom: "24px" }}>
                    {/* Category header */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "10px 16px",
                      background: `${cfg.color}10`,
                      border: `1px solid ${cfg.color}40`,
                      borderBottom: "none",
                      marginBottom: 0,
                    }}>
                      <span style={{
                        fontFamily: "var(--font-display)", fontSize: "18px",
                        color: cfg.color, letterSpacing: "0.08em",
                      }}>{cfg.label}</span>
                      <span style={{ fontSize: "9px", color: cfg.color, opacity: 0.6, letterSpacing: "0.1em" }}>
                        {issues.length} ISSUE{issues.length !== 1 ? "S" : ""}
                      </span>
                      <span style={{
                        marginLeft: "auto", fontSize: "9px", letterSpacing: "0.08em",
                        color: modeActive ? cfg.color : "var(--fg-muted)",
                        border: `1px solid ${modeActive ? cfg.color : "var(--border)"}`,
                        padding: "2px 8px", opacity: modeActive ? 1 : 0.5,
                      }}>
                        {modeActive ? "✓ WILL BE FIXED" : cfg.modeKey ? "ENABLE MODE TO FIX" : "AUTO-FIXED"}
                      </span>
                    </div>

                    {/* Issue cards */}
                    {issues.map((issue, idx) => {
                      const meta = ISSUE_META[issue.type];
                      const sColor = issue.severity === "critical" ? "#f87171" : issue.severity === "warning" ? "#facc15" : "#60a5fa";
                      return (
                        <div key={issue.id} style={{
                          border: `1px solid ${cfg.color}30`,
                          borderTop: idx === 0 ? `1px solid ${cfg.color}40` : "none",
                          padding: "16px 20px",
                          background: "#0a0a0a",
                        }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginBottom: meta ? "10px" : 0 }}>
                            {/* Severity dot */}
                            <div style={{
                              width: "6px", height: "6px", borderRadius: "50%",
                              background: sColor, marginTop: "5px", flexShrink: 0,
                            }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                                {meta ? (
                                  <span style={{ fontFamily: "var(--font-display)", fontSize: "16px", letterSpacing: "0.04em", color: "var(--fg)" }}>
                                    {meta.title}
                                  </span>
                                ) : (
                                  <span style={{ fontSize: "12px", color: "var(--fg)" }}>{issue.message}</span>
                                )}
                                <span style={{
                                  fontSize: "8px", letterSpacing: "0.12em",
                                  color: sColor, border: `1px solid ${sColor}`,
                                  padding: "1px 5px",
                                }}>{issue.severity.toUpperCase()}</span>
                              </div>
                              {meta && (
                                <p style={{ fontSize: "11px", color: "var(--fg-muted)", lineHeight: 1.7, margin: 0, maxWidth: "600px" }}>
                                  {meta.plain}
                                </p>
                              )}
                              <div style={{ fontSize: "9px", color: "var(--fg-muted)", marginTop: "6px", letterSpacing: "0.05em", opacity: 0.5 }}>
                                {issue.filePath}
                                {issue.line ? ` : line ${issue.line}` : ""}
                              </div>
                            </div>
                          </div>

                          {/* Before / After */}
                          {meta && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginLeft: "18px", marginTop: "10px" }}>
                              <div>
                                <div style={{ fontSize: "8px", color: "#f87171", letterSpacing: "0.12em", marginBottom: "4px" }}>BEFORE (BROKEN)</div>
                                <pre style={{
                                  margin: 0, padding: "10px 12px",
                                  background: "rgba(248,113,113,0.05)",
                                  border: "1px solid rgba(248,113,113,0.2)",
                                  fontSize: "9px", color: "#f87171",
                                  fontFamily: "var(--font-mono)",
                                  lineHeight: 1.6, overflow: "auto",
                                  whiteSpace: "pre-wrap", wordBreak: "break-all",
                                }}>{issue.currentValue || meta.beforeEx}</pre>
                              </div>
                              <div>
                                <div style={{ fontSize: "8px", color: "var(--accent)", letterSpacing: "0.12em", marginBottom: "4px" }}>AFTER (FIXED BY LINGOSEO)</div>
                                <pre style={{
                                  margin: 0, padding: "10px 12px",
                                  background: "rgba(168,255,62,0.05)",
                                  border: "1px solid rgba(168,255,62,0.2)",
                                  fontSize: "9px", color: "var(--accent)",
                                  fontFamily: "var(--font-mono)",
                                  lineHeight: 1.6, overflow: "auto",
                                  whiteSpace: "pre-wrap", wordBreak: "break-all",
                                }}>{issue.suggestedFix || meta.afterEx}</pre>
                              </div>
                            </div>
                          )}
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
                  : `[ FIX ALL & CREATE PR — ${analysis.issues.length} ISSUES ]`}
              </button>
              {!canFix && (
                <span style={{ fontSize: "10px", color: "var(--fg-muted)", letterSpacing: "0.05em" }}>
                  {!apiKey ? "ADD GEMINI API KEY" : !selectedModel ? "SELECT A GEMINI MODEL" : ""}
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

const thStyle: React.CSSProperties = {
  padding: "10px 16px",
  textAlign: "left",
  fontSize: "10px",
  color: "var(--fg-muted)",
  fontWeight: 500,
  letterSpacing: "0.1em",
  fontFamily: "var(--font-mono)",
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
