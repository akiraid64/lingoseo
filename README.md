# LingoSEO

**Multilingual SEO + Accessibility Intelligence — powered by [lingo.dev](https://lingo.dev)**

> Scan any GitHub repo for SEO, ARIA, and cultural adaptation issues across 25+ languages. Fix them with AI. Push a PR. You just merge.

[![Built with lingo.dev SDK](https://img.shields.io/badge/built%20with-lingo.dev%20SDK-blue)](https://lingo.dev)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Gemini 2.5](https://img.shields.io/badge/Gemini-2.5%20Flash-yellow)](https://ai.google.dev)

---

## The Problem

Your website ranks #1 in English. But in Spanish, Japanese, or Arabic — it's invisible to search engines, broken for blind users, and culturally wrong for the market you're trying to reach.

Most developers ship apps with:
- `<title>My Next.js App</title>` — a placeholder Google indexes as your brand
- Zero `hreflang` tags — Google serves your Spanish users the English page
- `aria-label="Submit form"` — a blind Japanese user hears English in the middle of a Japanese screen reader session
- Meta descriptions in English on a page that's supposed to be in Korean
- JSON-LD structured data that tells search engines the wrong language
- "Discover more →" word-for-word translated — not what Germans actually type into Google

But broken tags are only half the problem. Even when developers do translate, they translate **literally** — not culturally, and not accessibly:

**For blind and visually impaired users:**
- A screen reader navigating a Japanese page hits `aria-label="Close dialog"` — and reads it out in English, mid-sentence, breaking the entire audio experience
- `sr-only` text that says "Loading spinner" in English while the rest of the page is in Arabic
- Icon buttons with no label at all — a blind user hears "button button button" with no idea what each does
- Decorative emoji left exposed — a Korean screen reader spells out "SPARKLES" in English between Korean sentences

These aren't edge cases. **253 million people worldwide are visually impaired.** Every untranslated aria-label locks them out of your page in their own language.

**For search engines and real users:**
- A Mexican SaaS landing page that sounds like it was written in Madrid
- A Japanese pricing page with English-level bluntness (Japanese copy is softer, more indirect)
- A German CTA that says "Discover More" when the high-volume search term is "Jetzt entdecken"
- An Arabic page with LTR assumptions baked into every meta description

**Translation is not localization.** What ranks in São Paulo is not what ranks in Lisbon. What a blind Korean user expects to hear from a screen reader is not a Korean pronunciation of English.

LingoSEO uses **Gemini with search grounding** to go beyond word-for-word translation — pulling real search trends per locale so every title, description, and heading targets the keywords people in that market actually type. ARIA strings get their own prompt: screen-reader-native copy written for ears, not eyes. And cultural adaptation handles tone, formality, and vocabulary per locale — so the output is a marketing-ready, fully accessible website, not just a translated one.

**Every untranslated meta tag is a ranking you're losing. Every untranslated aria-label is a blind user you're excluding.** And manually auditing SEO + accessibility + cultural fit across 20+ languages? Nobody does it. So the bugs ship.

## The Solution

LingoSEO connects to your GitHub repo, runs a 13-point SEO + ARIA scan on every HTML/JSX/TSX file, then uses the **lingo.dev SDK** + **Google Gemini** to fix everything with market-aware, culturally-adapted, screen-reader-ready translations — and opens a pull request. You review the diff and merge.

One click. Every language. Every file. Every meta tag, aria-label, JSON-LD field, and cultural nuance.

![LingoSEO Pipeline — Extract, Translate with lingo.dev SDK, Replace](./public/pipeline.png)

---

## How It Works

### Why lingo.dev SDK Is the Engine, Not a Wrapper

The lingo.dev SDK has a feature most people overlook: **`apiUrl`**. Point it at your own server and the SDK routes every translation call through your endpoint instead of their default engine.

This is what makes LingoSEO possible. The SDK does things that are genuinely hard to replicate:
- **DOM-aware HTML translation** — `localizeHtml()` parses the actual DOM tree, extracts text nodes, translates them, and reconstructs markup without breaking a single tag
- **Object structure preservation** — `localizeObject()` traverses nested JSON, translates values, returns the exact same shape
- **Batching and chunking** — large string sets are automatically split into safe batch sizes
- **BCP-47 locale validation** — rejects malformed locale codes before they corrupt your `hreflang` tags

I own the `apiUrl` endpoint. That's where I inject what generic translation can't do:

```
standard lingo.dev:  strings → lingo.dev engine → translated strings

LingoSEO:            strings → lingo.dev SDK → /api/process/localize → Gemini
                                                        │
                          ┌─────────────────────────────┤
                          │                             │
                          ▼                             ▼
                   SEO strings:               ARIA strings:
                   "translate to keywords     "write as natural
                    people actually search     spoken language a
                    for — not dictionary       blind {locale} user
                    English mapped to {locale}"expects to hear"
                          │                             │
                          └──────────────┬──────────────┘
                                         ▼
                              Cultural adaptation:
                              "you decide the right tone,
                               formality, and vocabulary
                               for {locale} — not a literal
                               translation, a native one"
                                         │
                                         ▼
                              + Mixed-language detection per string
                              + Brand name protection from package.json
```

The split is clean: **lingo.dev SDK owns the transport and structure. I own the SEO, ARIA, and cultural intelligence.**

Traditional localization tools use regex to find strings. **Regex misses ~35% of translatable content** — proven across 6 test runs. Nav links, pricing badges, JSON-LD descriptions, footer headers, sr-only text — all invisible to pattern matching. The three-step pipeline replaces regex entirely:

| Step | Engine | What It Does |
|------|--------|-------------|
| **① EXTRACT** | Gemini | Reads the entire file. Returns every translatable string as a JSON map — metadata, headings, nav labels, aria-labels, JSON-LD, pricing text, footer links, everything. Zero regex. |
| **② TRANSLATE** | **lingo.dev SDK** | `localizeObject()` routes through `/api/process/localize`. SDK handles batching, chunking, locale validation. The endpoint routes SEO strings to SEO-optimized Gemini prompts, ARIA strings to accessibility-optimized prompts, general strings to cultural adaptation prompts. |
| **③ REPLACE** | Gemini | Takes the original file + translation map. Replaces every string in-place. Updates `<html lang>`, `og:locale`, `inLanguage`, adds `hreflang` alternates. Returns the complete file, same line count. |

---

## How I Use lingo.dev

LingoSEO is built on top of the [lingo.dev SDK](https://lingo.dev/en/sdk) using the **custom engine** pattern:

```typescript
// lib/translation/lingo-client.ts
import { LingoDotDevEngine } from "lingo.dev/sdk";

const engine = new LingoDotDevEngine({
  apiKey: "lingoseo-engine",
  apiUrl: `${baseUrl}/api`,  // SDK calls {apiUrl}/process/localize
});

// The SDK handles batching, chunking, HTML parsing, object traversal.
// My server handles the brain: Gemini with SEO + ARIA + cultural context.

export async function translateObject(obj, sourceLocale, targetLocale) {
  return engine.localizeObject(obj, { sourceLocale, targetLocale });
}

export async function translateHtml(html, sourceLocale, targetLocale) {
  return engine.localizeHtml(html, { sourceLocale, targetLocale });
}
```

When the SDK calls `/api/process/localize`, LingoSEO:

1. **Auto-detects content type** from the keys — SEO metadata, ARIA labels, or general content — and routes to the right Gemini prompt
2. **SEO context** — titles get "translate to what people ACTUALLY SEARCH for in {locale}, not a literal translation"; descriptions get character-count constraints (150-160); headings get keyword-density awareness
3. **ARIA context** — aria-labels and sr-only text get "write as natural spoken language a blind {locale} user expects to hear — native-sounding, not translated"; because a screen reader reading "Submit form" in English to a Japanese user breaks the entire accessibility contract
4. **Cultural context** — general strings get "use your cultural knowledge — you decide the right tone, formality, and vocabulary for {locale}"; casual English copy becomes appropriately formal German or appropriately warm Spanish
5. **Handles mixed languages** — after multiple translation passes, a file might contain 3-5 languages from incomplete previous runs; the prompt detects each string's language individually and translates only the non-target strings
6. **Protects brand names** — extracted from `package.json` (the only source that's never translated), passed as context so Gemini never touches them

### SDK Methods Used

| Method | Where | Purpose |
|--------|-------|---------|
| `localizeObject()` | Step 2 of pipeline | Translate extracted string maps: SEO metadata, ARIA labels, visible text — routed to the right context prompt |
| `localizeHtml()` | Full-page mode | Translate entire HTML documents while preserving markup; SDK's DOM parser handles tag reconstruction |
| `localizeText()` | Standalone text | Individual string translation when needed |
| `batchLocalizeText()` | Multi-locale workflows | Translate one string to multiple locales at once |

---

## What It Scans (13 Issue Types)

### SEO Issues
| Issue | Severity | What LingoSEO Does |
|-------|----------|-------------------|
| Missing `<title>` | Critical | Generates locale-optimized title (50-60 chars, high search volume keywords for that market) |
| Missing meta description | Critical | Writes 150-160 char description targeting actual search terms in the locale |
| Missing Open Graph tags | Warning | Adds `og:title`, `og:description`, `og:locale` for social sharing |
| Missing Twitter Card | Warning | Adds `twitter:card`, `twitter:title`, `twitter:description` |
| Missing hreflang | Critical | Adds `<link rel="alternate" hreflang="{locale}">` with self-referencing + bidirectional refs |
| Missing canonical | Warning | Adds self-referencing canonical URL |
| Missing viewport | Warning | Adds mobile-first viewport meta tag |
| Unoptimized headings | Warning | Ensures single H1 with locale-relevant keywords |
| Invalid JSON-LD | Warning | Translates `name`, `description`, updates `inLanguage`, flags deprecated schema types |
| Missing sitemap locales | Info | Detects sitemap without locale-specific URLs |

### ARIA & Accessibility Issues
| Issue | Severity | What LingoSEO Does |
|-------|----------|-------------------|
| Untranslated aria-labels | Critical | Translates to **natural spoken language** — not a literal translation, what a native blind user actually expects to hear |
| Untranslated sr-only text | Critical | Localizes visually-hidden text screen readers rely on; culturally adapted for the locale's conventions |
| Untranslated alt text | Warning | Translates image descriptions for screen readers + image SEO in the target locale |
| Missing nav labels | Warning | Multiple `<nav>` elements without distinguishing `aria-label` — screen reader users can't tell nav sections apart |
| Missing skip link | Warning | No skip-to-main-content — keyboard navigation dead end |
| Decorative not hidden | Info | Emoji/icons not marked `aria-hidden="true"` — screen readers pronounce Unicode names in English mid-sentence |
| Icon fonts exposed | Info | Font Awesome icons without `aria-hidden` — "icon icon-check" read aloud |

---

## Three Translation Modes

| Mode | lingo.dev SDK Method | What Gets Fixed | Gemini Prompt Context |
|------|---------------------|----------------|----------------------|
| **SEO** | `localizeObject()` | Titles, descriptions, OG tags, Twitter cards, headings, alt text, JSON-LD, hreflang | Search intent — keywords people actually search per market |
| **ARIA** | `localizeObject()` | aria-label attributes, sr-only text, screen reader content | Spoken language — natural, native, not translated |
| **Full Page** | `localizeHtml()` + `localizeObject()` | Everything above + all visible body text, nav links, buttons, pricing, footer | Cultural adaptation — tone, formality, vocabulary for the locale |

All three modes run through the lingo.dev SDK's `apiUrl` — the endpoint auto-detects which context to apply per string based on the key names.

---

## SEO Score (0-100, Grade A-F)

Every scan produces a weighted score across 5 categories:

```
╔═══════════════════════════════════════════════════════╗
║  CATEGORY          │ WEIGHT │ WHAT IT MEASURES        ║
╠═══════════════════════════════════════════════════════╣
║  Technical SEO     │  22%   │ html-lang, canonical,   ║
║                    │        │ viewport, hreflang      ║
╠═══════════════════════════════════════════════════════╣
║  On-Page SEO       │  23%   │ title, description,     ║
║                    │        │ OG, Twitter, headings   ║
╠═══════════════════════════════════════════════════════╣
║  Accessibility     │  20%   │ alt text, aria-labels,  ║
║                    │        │ sr-only, ARIA landmarks ║
╠═══════════════════════════════════════════════════════╣
║  Schema            │  10%   │ JSON-LD validity,       ║
║                    │        │ sitemap locale support   ║
╠═══════════════════════════════════════════════════════╣
║  i18n Readiness    │  25%   │ hreflang, locale config,║
║                    │        │ translation completeness ║
╚═══════════════════════════════════════════════════════╝
```

Severity deductions: **Critical = -15 pts**, **Warning = -8 pts**, **Info = -2 pts**

---

## Smart Features

### Brand Protection
Reads `package.json` to identify your real brand name — the one source file that's never translated. If a previous run corrupted "InvoiceFlow" to "FacturaFlujo" (Spanish) or "请求流" (Chinese), LingoSEO detects and reverts it.

### Mixed-Language Cleanup
After running localization tools multiple times, files end up with 3-5 languages mixed together. LingoSEO's Gemini prompt auto-detects each string's language individually. If it's not in the target locale, it gets translated. If it is, it stays. The result is 100% target language with zero residue.

### Gemini Source Language Detection
Never trusts `<html lang>` (it's often stale or wrong from previous runs). Instead, Gemini analyzes actual text content from the main files to identify the dominant language and passes it to the SDK as a hint.

### Font Awesome CDN Injection
If the tool detects `fa-` icon classes but no Font Awesome stylesheet is loaded, it automatically injects the CDN link so icons render correctly — and so they can be properly hidden with `aria-hidden`.

---

## Architecture

```
app/
├── page.tsx                    # Landing page
├── dashboard/page.tsx          # Main dashboard (scan + fix UI)
├── api/
│   ├── analyze/route.ts        # Clone → scan → score
│   ├── fix/route.ts            # Clone → fix → push → PR
│   ├── process/localize/       # lingo.dev SDK contract endpoint
│   │   └── route.ts            #   SEO + ARIA + cultural Gemini prompts
│   ├── gemini/models/route.ts  # List available Gemini models
│   └── users/me/route.ts       # SDK identity tracking
│
lib/
├── analysis/
│   ├── engine.ts               # Scan orchestrator
│   ├── scanners/index.ts       # 20 Cheerio-based pattern scanners
│   └── gemini-scanner.ts       # Gemini semantic scanner (content-level)
├── fixer/
│   └── engine.ts               # 3-step extract→translate→replace pipeline
├── translation/
│   ├── lingo-client.ts         # lingo.dev SDK wrapper (custom apiUrl)
│   └── seo-optimizer.ts        # Gemini calls, scoring, hreflang generation
├── github/
│   ├── clone.ts                # Authenticated repo cloning
│   └── pr.ts                   # Branch creation + PR generation
└── logger.ts                   # Structured logging

auth.ts                         # NextAuth v5 (GitHub OAuth)
types/index.ts                  # TypeScript definitions
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16, React 19, TypeScript |
| Translation | **lingo.dev SDK** (`LingoDotDevEngine`, custom `apiUrl`) |
| AI | Google Gemini 2.5 Flash — SEO, ARIA, cultural context prompts |
| HTML Parsing | Cheerio (scanning), lingo.dev SDK `localizeHtml()` (translation) |
| Auth | NextAuth v5 (GitHub OAuth) |
| Git | simple-git, Octokit |
| Styling | Tailwind CSS 4 + inline styles (terminal-brutalist aesthetic) |
| Validation | Zod |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A GitHub account
- A Google Gemini API key ([get one here](https://aistudio.google.com/apikey))

### Setup

```bash
git clone https://github.com/your-username/lingoseo.git
cd lingoseo
npm install
```

Create `.env.local`:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key
AUTH_GITHUB_ID=your_github_oauth_app_id
AUTH_GITHUB_SECRET=your_github_oauth_app_secret
AUTH_SECRET=any_random_string_for_session_encryption

# Optional
GEMINI_MODEL=gemini-2.5-flash          # Default model
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Base URL for SDK callbacks
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with GitHub. Paste a repo URL. Scan. Fix. Merge the PR.

---

## Demo: 8-Pass Translation Stress Test

LingoSEO was pushed through 8 consecutive translation passes on the same repo — each pass a different language — to stress-test mixed-language handling, brand protection, and ARIA coverage:

| Pass | Direction | Coverage | Notes |
|------|-----------|----------|-------|
| 1 | EN → ES | ~50% | First translation — regex-based, many misses |
| 2 | ES → JA | ~55% | Spanish residue from pass 1 |
| 3 | JA → ZH-Hant | ~60% | Japanese + Spanish fragments mixed |
| 4 | ZH → KO | ~60% | Three languages mixed on one page |
| 5 | KO → HI | ~65% | Four languages coexisting; ARIA labels still in English |
| 6 | HI → RU | **~97%** | Switched to 3-step Gemini pipeline — massive jump; all aria-labels translated |
| 7 | RU → AR | **~99%** | Brand corruption fixed, Font Awesome CDN added, zero page.tsx residue |
| 8 | — | **~99%** | Only 3 fossil strings in layout.tsx |

**Key result:** After switching from regex-based extraction to the 3-step Gemini pipeline in pass 6, coverage jumped from ~65% to ~97% in a single run — including ARIA labels that regex had missed across all 5 previous passes.

---

## Supported Locales

Arabic, Chinese (Simplified), Chinese (Traditional), Dutch, French, French (Canada), German, Hindi, Indonesian, Italian, Japanese, Korean, Polish, Portuguese (Brazil), Portuguese (Portugal), Russian, Spanish, Spanish (Mexico), Spanish (Argentina), Swedish, Turkish, Ukrainian, Vietnamese — and any BCP-47 locale code the lingo.dev SDK supports.

---

## The lingo.dev Connection

[lingo.dev](https://lingo.dev) is a **Localization Engineering Platform** (YC F24, $4.2M seed) that turns any LLM into a stateful translation API. Their SDK's `apiUrl` feature is the architectural backbone of LingoSEO — it lets LingoSEO replace the default translation engine with its own while keeping all the SDK's plumbing (DOM parsing, object traversal, batching, locale validation) intact.

LingoSEO is the answer to a question the SDK makes possible: **what if every translation call knew whether it was translating for a search engine, a screen reader, or a human — and adapted accordingly?**

---

<p align="center">
  Built for the <a href="https://lingo.dev">lingo.dev</a> Hackathon<br/>
  <strong>lingo.dev SDK</strong> + <strong>Google Gemini</strong> + <strong>GitHub</strong> = multilingual SEO + ARIA on autopilot
</p>
