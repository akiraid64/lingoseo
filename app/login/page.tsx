"use client";

import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const GitHubIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) router.push("/dashboard");
  }, [session, router]);

  if (status === "loading") {
    return (
      <div style={{
        minHeight: "100vh", display: "flex",
        alignItems: "center", justifyContent: "center",
        background: "var(--bg)",
      }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: "0.75rem",
          color: "var(--accent)", letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>
          Initializing<span className="cursor">_</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
    }}>

      {/* Subtle grid */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none",
        backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
        opacity: 0.25,
      }} />

      {/* Scan line */}
      <div className="scan-line" />

      {/* Nav */}
      <nav style={{
        padding: "1.25rem 2rem",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        position: "relative",
        zIndex: 1,
      }}>
        <a href="/" style={{
          fontFamily: "var(--font-mono)", fontSize: "0.75rem",
          letterSpacing: "0.12em", color: "var(--fg-muted)",
          textTransform: "uppercase", textDecoration: "none",
        }}>
          <span style={{ color: "var(--accent)" }}>[</span>
          {" "}LingoSEO{" "}
          <span style={{ color: "var(--accent)" }}>]</span>
        </a>
      </nav>

      {/* Main content */}
      <div style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        position: "relative",
        zIndex: 1,
      }}>

        {/* Left — branding */}
        <div style={{
          borderRight: "1px solid var(--border)",
          padding: "4rem 3rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}>
          <div className="reveal delay-1" style={{
            fontFamily: "var(--font-mono)", fontSize: "0.65rem",
            letterSpacing: "0.15em", textTransform: "uppercase",
            color: "var(--accent)", marginBottom: "1.5rem",
          }}>
            // Step 0 of 4
          </div>

          <div className="reveal delay-2" style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3rem, 6vw, 5.5rem)",
            lineHeight: 0.9,
            textTransform: "uppercase",
            color: "var(--fg)",
            marginBottom: "0.5rem",
          }}>
            Connect
          </div>
          <div className="reveal delay-3" style={{
            fontFamily: "var(--font-display)",
            fontSize: "clamp(3rem, 6vw, 5.5rem)",
            lineHeight: 0.9,
            textTransform: "uppercase",
            color: "var(--accent)",
          }}>
            GitHub<span className="cursor">_</span>
          </div>

          <div className="reveal delay-4" style={{ margin: "2rem 0" }}>
            <span className="accent-line" style={{ width: "80%" }} />
          </div>

          <div className="reveal delay-5" style={{
            fontFamily: "var(--font-mono)", fontSize: "0.78rem",
            color: "var(--fg-muted)", lineHeight: 1.7,
            maxWidth: "360px",
          }}>
            We request <span style={{ color: "var(--fg)" }}>repo</span> scope
            so we can clone your code, scan it, and push a fix branch.
            You review every change before anything merges.
          </div>

          {/* Scope list */}
          <div className="reveal delay-6" style={{ marginTop: "2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            {["repo — read & write your repositories", "read:user — identify your account", "user:email — contact (optional)"].map((s) => (
              <div key={s} style={{
                fontFamily: "var(--font-mono)", fontSize: "0.68rem",
                color: "var(--fg-muted)", display: "flex", gap: "0.5rem",
              }}>
                <span style={{ color: "var(--accent)" }}>◆</span> {s}
              </div>
            ))}
          </div>
        </div>

        {/* Right — sign in card */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "4rem 3rem",
        }}>
          <div className="reveal delay-3" style={{
            width: "100%",
            maxWidth: "360px",
            border: "1px solid var(--border-hi)",
            background: "var(--bg-card)",
            padding: "2.5rem",
          }}>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: "0.65rem",
              letterSpacing: "0.12em", textTransform: "uppercase",
              color: "var(--fg-muted)", marginBottom: "2rem",
            }}>
              Authentication Required
            </div>

            <button
              onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                padding: "1rem",
                background: "var(--fg)",
                color: "var(--bg)",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: "0.8rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                border: "none",
                cursor: "pointer",
                transition: "opacity 0.15s",
                marginBottom: "1.5rem",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              <GitHubIcon />
              Sign in with GitHub
            </button>

            <div style={{
              borderTop: "1px solid var(--border)",
              paddingTop: "1.25rem",
              fontFamily: "var(--font-mono)",
              fontSize: "0.65rem",
              color: "var(--fg-muted)",
              lineHeight: 1.7,
            }}>
              Your API keys are stored only in your browser.
              We never persist tokens beyond your session.
            </div>
          </div>
        </div>
      </div>

      {/* Mobile fallback for the grid */}
      <style>{`
        @media (max-width: 640px) {
          .login-grid { grid-template-columns: 1fr !important; }
          .login-left { border-right: none !important; border-bottom: 1px solid var(--border); }
        }
      `}</style>
    </div>
  );
}
