import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] flex flex-col">
      {/* Nav */}
      <nav className="border-b border-[var(--border)] px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)] flex items-center justify-center text-white font-bold text-sm">
            LS
          </div>
          <span className="text-lg font-semibold">LingoSEO</span>
        </div>
        <Link
          href="/login"
          className="px-4 py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-medium hover:opacity-90 transition"
        >
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--border)] text-xs text-[var(--muted-foreground)] mb-6">
          <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
          Powered by lingo.dev
        </div>

        <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight mb-6">
          Your translated pages
          <br />
          <span className="text-[var(--primary)]">rank nowhere</span> on Google
        </h1>

        <p className="text-lg text-[var(--muted-foreground)] max-w-2xl mb-8">
          LingoSEO scans your GitHub repo, finds multilingual SEO issues,
          translates with search-intent-optimized keywords using lingo.dev, and
          pushes fixes as a PR. You just merge.
        </p>

        <div className="flex gap-4 mb-16">
          <Link
            href="/login"
            className="px-6 py-3 rounded-lg bg-[var(--primary)] text-white font-medium hover:opacity-90 transition"
          >
            Connect GitHub & Start
          </Link>
          <a
            href="https://github.com/lingodotdev/lingo.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-lg border border-[var(--border)] text-[var(--foreground)] font-medium hover:bg-[var(--secondary)] transition"
          >
            View lingo.dev
          </a>
        </div>

        {/* How it works */}
        <div className="w-full grid grid-cols-1 md:grid-cols-4 gap-4 mb-16">
          {[
            {
              step: "1",
              title: "Connect Repo",
              desc: "Sign in with GitHub, paste your repo URL",
            },
            {
              step: "2",
              title: "SEO Scan",
              desc: "We scan every file for multilingual SEO gaps",
            },
            {
              step: "3",
              title: "lingo.dev Translates",
              desc: "SDK translates with search-intent keywords",
            },
            {
              step: "4",
              title: "PR Created",
              desc: "Fixes pushed to a new branch, you review & merge",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="p-5 rounded-xl border border-[var(--border)] bg-[var(--card)] text-left"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--primary)]/20 text-[var(--primary)] flex items-center justify-center text-sm font-bold mb-3">
                {item.step}
              </div>
              <h3 className="font-semibold mb-1">{item.title}</h3>
              <p className="text-sm text-[var(--muted-foreground)]">
                {item.desc}
              </p>
            </div>
          ))}
        </div>

        {/* What we detect */}
        <div className="w-full text-left mb-16">
          <h2 className="text-2xl font-bold mb-6 text-center">
            What LingoSEO Detects & Fixes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              "Missing or untranslated <title> tags",
              "Missing meta descriptions per locale",
              "Missing Open Graph (og:) tags",
              "Missing Twitter Card meta tags",
              "Missing hreflang alternate links",
              "Untranslated image alt attributes",
              "Missing <html lang=''> attribute",
              "Sitemap without locale alternates",
              "JSON-LD structured data not localized",
              "Headings not optimized for locale keywords",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 p-3 rounded-lg bg-[var(--card)] border border-[var(--border)]"
              >
                <span className="text-[var(--success)] text-lg">✓</span>
                <span className="text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-6 py-6 text-center text-sm text-[var(--muted-foreground)]">
        Built for the lingo.dev Multilingual Hackathon #3 — Powered by
        lingo.dev SDK + CLI
      </footer>
    </div>
  );
}
