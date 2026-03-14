import Link from "next/link";

const ISSUES = [
  "Missing <title> per locale",
  "Untranslated meta descriptions",
  "Missing og: tags",
  "No hreflang alternates",
  "Untranslated aria-labels",
  "Missing <html lang>",
  "sr-only text not localized",
  "Deprecated JSON-LD schema",
  "No viewport meta",
  "No canonical tag",
  "Sitemap without locale URLs",
  "H1 not keyword-optimized",
];

const STEPS = [
  {
    n: "01",
    title: "Connect Repo",
    desc: "Sign in with GitHub. Paste any public or private repo URL.",
  },
  {
    n: "02",
    title: "13-Point Scan",
    desc: "Our engine walks every HTML/JSX/TSX file. 13 scanner types run in parallel.",
  },
  {
    n: "03",
    title: "lingo.dev Translates",
    desc: "SDK calls localizeText, batchLocalizeText, localizeObject per issue type.",
  },
  {
    n: "04",
    title: "Gemini Optimizes",
    desc: "Translated keywords are refined for actual search intent per locale.",
  },
  {
    n: "05",
    title: "PR Opened",
    desc: "Branch pushed, pull request created. You review the diff and merge.",
  },
];

export default function LandingPage() {
  const doubled = [...ISSUES, ...ISSUES];

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* ── Nav ──────────────────────────────────── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(12px)",
        background: "rgba(7,7,7,0.85)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 2rem", height: "52px",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "0.75rem",
          letterSpacing: "0.12em", color: "var(--fg-muted)", textTransform: "uppercase",
        }}>
          <span style={{ color: "var(--accent)" }}>[</span>
          {" "}LingoSEO{" "}
          <span style={{ color: "var(--accent)" }}>]</span>
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--fg-muted)", letterSpacing: "0.08em" }}>
            v1.0 · hackathon #3
          </span>
          <Link href="/login" className="btn-accent" style={{ padding: "0.4rem 1rem", fontSize: "0.7rem" }}>
            Start →
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────── */}
      <section style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "5rem 2rem 4rem",
        overflow: "hidden",
        borderBottom: "1px solid var(--border)",
      }}>
        {/* Scan line */}
        <div className="scan-line" />

        {/* Grid lines decoration */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
          opacity: 0.3,
        }} />

        {/* Corner marks */}
        <div style={{ position: "absolute", top: "5rem", left: "2rem", width: 20, height: 20, borderTop: "1px solid var(--accent)", borderLeft: "1px solid var(--accent)", opacity: 0.6 }} />
        <div style={{ position: "absolute", bottom: "3rem", right: "2rem", width: 20, height: 20, borderBottom: "1px solid var(--accent)", borderRight: "1px solid var(--accent)", opacity: 0.6 }} />

        <div style={{ position: "relative", maxWidth: "1100px", margin: "0 auto", width: "100%" }}>

          {/* Status badge */}
          <div className="reveal delay-1" style={{
            display: "inline-flex", alignItems: "center", gap: "0.5rem",
            fontFamily: "var(--font-mono)", fontSize: "0.65rem",
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--fg-muted)", marginBottom: "2rem",
          }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block", boxShadow: "0 0 6px var(--accent)" }} className="cursor" />
            Powered by lingo.dev SDK · Hackathon #3
          </div>

          {/* Main headline */}
          <div className="reveal delay-2" style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3.5rem, 10vw, 9rem)",
            lineHeight: 0.92,
            letterSpacing: "0.01em",
            color: "var(--fg)",
            textTransform: "uppercase",
            marginBottom: "0.5rem",
          }}>
            Your Translated
          </div>

          <div className="reveal delay-3" style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3.5rem, 10vw, 9rem)",
            lineHeight: 0.92,
            letterSpacing: "0.01em",
            color: "var(--fg)",
            textTransform: "uppercase",
            marginBottom: "0.25rem",
          }}>
            Pages
          </div>

          {/* Separator */}
          <div className="reveal delay-3" style={{ margin: "1.25rem 0" }}>
            <span className="accent-line" style={{ display: "block", width: "min(600px, 100%)" }} />
          </div>

          <div className="reveal delay-4" style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(4rem, 11vw, 10.5rem)",
            lineHeight: 0.88,
            letterSpacing: "0.01em",
            color: "var(--accent)",
            textTransform: "uppercase",
          }}>
            Rank Nowhere<span className="cursor" style={{ color: "var(--accent)" }}>_</span>
          </div>

          {/* Subtext */}
          <div className="reveal delay-5" style={{
            fontFamily: "var(--font-mono)", fontSize: "0.82rem",
            color: "var(--fg-muted)", lineHeight: 1.7,
            maxWidth: "480px", marginTop: "2.5rem",
          }}>
            LingoSEO scans your GitHub repo for 13 multilingual SEO
            issues, translates with <span style={{ color: "var(--fg)" }}>lingo.dev SDK</span>,
            optimizes keywords for each locale, and pushes all fixes as a PR.
            You just merge.
          </div>

          {/* CTAs */}
          <div className="reveal delay-6" style={{ display: "flex", gap: "1rem", marginTop: "2.5rem", flexWrap: "wrap" }}>
            <Link href="/login" className="btn-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              Connect GitHub & Scan
            </Link>
            <a
              href="https://github.com/lingodotdev/lingo.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
            >
              lingo.dev →
            </a>
          </div>
        </div>
      </section>

      {/* ── Marquee ticker ───────────────────────── */}
      <div style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-muted)",
        overflow: "hidden",
        padding: "0.75rem 0",
      }}>
        <div className="marquee-track">
          {doubled.map((item, i) => (
            <span key={i} style={{
              fontFamily: "var(--font-mono)", fontSize: "0.7rem",
              letterSpacing: "0.08em", textTransform: "uppercase",
              color: "var(--fg-muted)", padding: "0 2rem", whiteSpace: "nowrap",
            }}>
              <span style={{ color: "var(--accent)", marginRight: "0.75rem" }}>◆</span>
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── How it works ─────────────────────────── */}
      <section style={{
        padding: "6rem 2rem",
        maxWidth: "1100px",
        margin: "0 auto",
        width: "100%",
        borderBottom: "1px solid var(--border)",
      }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "0.65rem",
          letterSpacing: "0.15em", textTransform: "uppercase",
          color: "var(--accent)", marginBottom: "1.25rem",
        }}>
          // How it works
        </div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 5vw, 3.5rem)",
          letterSpacing: "0.02em", textTransform: "uppercase",
          color: "var(--fg)", marginBottom: "4rem",
        }}>
          Five Steps to Ranked Pages
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
          {STEPS.map((s, i) => (
            <div key={s.n} className="card-hover" style={{
              display: "grid",
              gridTemplateColumns: "80px 1fr",
              gap: "0 2rem",
              padding: "2rem 0",
              borderTop: "1px solid var(--border)",
              cursor: "default",
            }}>
              <div style={{
                fontFamily: "var(--font-display)",
                fontSize: "3.5rem",
                lineHeight: 1,
                color: i === 2 ? "var(--accent)" : "var(--fg-dim)",
                letterSpacing: "0.02em",
              }}>
                {s.n}
              </div>
              <div>
                <div style={{
                  fontFamily: "var(--font-mono)", fontWeight: 700,
                  fontSize: "0.9rem", letterSpacing: "0.05em",
                  textTransform: "uppercase", color: "var(--fg)",
                  marginBottom: "0.4rem",
                }}>
                  {s.title}
                </div>
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.78rem",
                  color: "var(--fg-muted)", lineHeight: 1.65,
                }}>
                  {s.desc}
                </div>
              </div>
            </div>
          ))}
          <div style={{ borderTop: "1px solid var(--border)" }} />
        </div>
      </section>

      {/* ── What we detect ───────────────────────── */}
      <section style={{
        padding: "6rem 2rem",
        maxWidth: "1100px",
        margin: "0 auto",
        width: "100%",
      }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "0.65rem",
          letterSpacing: "0.15em", textTransform: "uppercase",
          color: "var(--accent)", marginBottom: "1.25rem",
        }}>
          // 13 issue types detected
        </div>
        <div style={{
          fontFamily: "var(--font-display)", fontSize: "clamp(2rem, 5vw, 3.5rem)",
          letterSpacing: "0.02em", textTransform: "uppercase",
          color: "var(--fg)", marginBottom: "3rem",
        }}>
          What LingoSEO Fixes
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1px", background: "var(--border)" }}>
          {ISSUES.map((item) => (
            <div key={item} className="card-hover" style={{
              background: "var(--bg-card)",
              padding: "1.25rem 1.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
            }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "0.7rem",
                color: "var(--accent)", flexShrink: 0,
              }}>▸</span>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: "0.75rem",
                color: "var(--fg-muted)", lineHeight: 1.4,
              }}>
                {item}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA banner ───────────────────────────── */}
      <section style={{
        borderTop: "1px solid var(--border)",
        background: "var(--bg-muted)",
        padding: "5rem 2rem",
        textAlign: "center",
      }}>
        <div style={{
          fontFamily: "var(--font-display)",
          fontSize: "clamp(2.5rem, 6vw, 5rem)",
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          color: "var(--fg)",
          marginBottom: "1rem",
        }}>
          Fix Your Rankings Today
        </div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "0.78rem",
          color: "var(--fg-muted)", marginBottom: "2.5rem",
        }}>
          lingo.dev SDK + Gemini AI + GitHub OAuth → one merged PR
        </div>
        <Link href="/login" className="btn-accent" style={{ fontSize: "0.85rem", padding: "1rem 2rem" }}>
          Scan Your Repo →
        </Link>
      </section>

      {/* ── Footer ───────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid var(--border)",
        padding: "1.5rem 2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "0.5rem",
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--fg-muted)", letterSpacing: "0.08em" }}>
          [ LINGOSEO ] · Built for lingo.dev Multilingual Hackathon #3
        </span>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "var(--fg-dim)", letterSpacing: "0.05em" }}>
          lingo.dev SDK · Gemini · GitHub OAuth
        </span>
      </footer>

    </div>
  );
}
