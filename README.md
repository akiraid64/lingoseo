# LingoSEO

**Multilingual SEO + Accessibility — powered by [lingo.dev](https://lingo.dev)**

> Point it at any GitHub repo. It finds every broken SEO tag and accessibility issue across 25+ languages, fixes them with AI, and opens a pull request. You just merge.

[![Built with lingo.dev SDK](https://img.shields.io/badge/built%20with-lingo.dev%20SDK-blue)](https://lingo.dev)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org)
[![Gemini 2.5](https://img.shields.io/badge/Gemini-2.5%20Flash-yellow)](https://ai.google.dev)

---

## The Problem

Your website ranks #1 in English. In Spanish, Japanese, or Arabic — **it's invisible to search engines, broken for blind users, and culturally off for the market you're trying to reach.**

![What happens when you ship without LingoSEO](./public/Gemini_Generated_Image_4wgp0n4wgp0n4wgp.png)

Most developers ship apps with stuff like this still in the code:

- `<title>My Next.js App</title>` — **that placeholder is what Google indexes as your brand name**
- No `hreflang` tags *(the tags that tell Google "show this page to Spanish speakers, not the English version")* — so **Google serves your Mexican users the English page**
- `aria-label="Submit form"` *(aria-labels are the hidden text that screen readers read aloud to blind users)* — **a blind Japanese user hears English in the middle of a Japanese screen reader session**
- Meta descriptions in English on a page that's supposed to be in Korean
- JSON-LD *(hidden structured data that tells search engines what your page is about)* set to the wrong language

That's just the broken tags. Even when developers *do* translate, they translate literally — which is a different problem.

**What literally-translated websites look like for blind users:**

A screen reader navigating a Japanese page hits `aria-label="Close dialog"` and reads it out in English, mid-sentence. The rest of the page is Japanese. The button label isn't. That's not a minor glitch — **it's the equivalent of a foreign-language pop-up appearing in the middle of an audiobook.**

There's also hidden text called `sr-only` *(short for "screen reader only" — text that's invisible on screen but read aloud)* that developers often forget to translate. So blind Arabic users hear English labels for buttons their sighted counterparts would never notice.

And emoji. Decorative emoji left without `aria-hidden="true"` get spelled out by screen readers: a Korean page says "저희 서비스를 SPARKLES 이용해 보세요" — "SPARKLES" pronounced in English, mid-sentence.

> **253 million people worldwide are visually impaired.** Every untranslated accessibility label locks them out of your page in their own language.

**What literally-translated websites look like for real users:**

A Mexican SaaS page that sounds like it was written in Madrid. A Japanese pricing page that's too blunt (Japanese copy is softer). A German CTA that says "Discover More" when **the actual high-volume German search term is "Jetzt entdecken."**

> **Translation is not localization.** What ranks in São Paulo is not what ranks in Lisbon.

LingoSEO uses Gemini to pull real search trends per locale — so titles and descriptions target what people in that market actually type into Google, not just English copy run through a translator. Every accessibility label gets its own prompt: written for ears, not eyes. Formal where formal is expected. Warm where warm is expected.

**Every untranslated meta tag is a ranking you're losing. Every untranslated aria-label is a blind user you're excluding.** Nobody audits this stuff across 20+ languages manually. So the bugs ship.

<video src="./public/demo.mp4" controls width="100%">
  Your browser does not support the video tag.
</video>

> This is what LingoSEO fixes. One scan. Every language. Every file. You just merge the PR.

---

## The Solution

LingoSEO connects to your GitHub repo, runs a **13-point scan** on every HTML/JSX/TSX file, then uses the **lingo.dev SDK** + **Google Gemini** to fix everything — and opens a pull request. **You review the diff and merge.**

![LingoSEO Pipeline — Extract, Translate with lingo.dev SDK, Replace](./public/pipeline.png)

---

## How It Works

### The three-step pipeline

Most localization tools use pattern matching *(regex — think "find all text that looks like a page title")* to extract strings from files. **It misses about 35% of translatable content.** Nav links, pricing badges, footer text, screen-reader labels — all invisible to it.

LingoSEO doesn't use pattern matching for this. Instead:

| Step | Who Does It | What Happens |
|------|-------------|-------------|
| **① Extract** | Gemini | Reads the entire file like a human. Pulls out every translatable string — titles, descriptions, button labels, aria-labels, JSON-LD, pricing text, footer links, everything — as a JSON object. |
| **② Translate** | **lingo.dev SDK** | Sends that JSON through the lingo.dev SDK, which routes it to a custom endpoint. The endpoint feeds different strings to different Gemini prompts: SEO copy gets search-intent instructions, accessibility labels get spoken-language instructions, everything else gets cultural adaptation. |
| **③ Replace** | Gemini | Takes the original file and the translation map. Swaps every string in-place. Updates the language tags, adds hreflang alternates *(links that tell Google which version of the page to show to which country)*, keeps the file the same length. Returns the complete translated file. |

### Why lingo.dev SDK sits in the middle

The lingo.dev SDK has a feature called `apiUrl`. **Point it at your own server and every translation call goes through your endpoint instead of theirs.**

That's how LingoSEO works. The SDK handles the hard infrastructure stuff — parsing HTML without breaking it, splitting large translation jobs into safe batches, validating locale codes. I handle what generic translation can't: **context.**

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
```

> **lingo.dev SDK owns the transport. I own the context.**

### What happens inside the translation endpoint

When the SDK calls `/api/process/localize`, LingoSEO:

1. Figures out what type of string it's looking at — SEO metadata, accessibility label, or general content
2. **SEO strings** get: "translate to what people actually search for in {locale}" — with character limits (50-60 for titles, 150-160 for descriptions)
3. **Accessibility labels** get: "write as natural spoken language a blind {locale} user expects to hear" — because translating "Submit" to Japanese isn't the same as writing what a Japanese screen reader user expects to hear
4. **General content** gets: cultural adaptation — right tone, right formality, right vocabulary for the locale
5. If a file has 3 languages mixed in from previous botched translation runs, it detects each string's language individually and only translates the ones that aren't already in the target language
6. Brand names are extracted from `package.json` *(your project's config file, which is never translated)* and passed as context so Gemini never touches them

### SDK methods used

| Method | What it does |
|--------|-------------|
| `localizeObject()` | Translates a set of key-value string pairs while keeping the structure intact — used for SEO metadata, aria-labels, visible text |
| `localizeHtml()` | Translates a full HTML page without breaking any tags — the SDK's DOM parser handles reassembly |
| `localizeText()` | Single string translation |
| `batchLocalizeText()` | One string translated into multiple languages at once |

---

## What It Scans

### SEO issues

| Issue | Severity | What LingoSEO does |
|-------|----------|-------------------|
| Missing page title | Critical | Writes a locale-optimized title using real search volume keywords for that market (50-60 chars) |
| Missing meta description | Critical | Writes a 150-160 char description targeting what people actually search for in that locale |
| Missing Open Graph tags | Warning | Adds the tags social platforms use when someone shares your link |
| Missing Twitter Card tags | Warning | Same, but specifically for Twitter/X previews |
| Missing hreflang | Critical | Adds the tags that tell Google which version of your page to show to which country |
| Missing canonical tag | Warning | Adds the tag that prevents Google from treating duplicate pages as separate results |
| Missing mobile viewport | Warning | Adds the tag Google requires for mobile-first indexing |
| Unoptimized headings | Warning | Fixes missing or duplicate H1 tags |
| Invalid structured data | Warning | Fixes the hidden JSON that describes your page to search engines |
| Missing sitemap locales | Info | Flags sitemaps that don't include locale-specific URLs |

### Accessibility issues

| Issue | Severity | What LingoSEO does |
|-------|----------|-------------------|
| Untranslated aria-labels | Critical | Rewrites them as natural spoken language for a native blind user — not a word-for-word translation |
| Untranslated sr-only text | Critical | Translates the hidden text screen readers rely on |
| Untranslated alt text | Warning | Translates image descriptions — both for screen readers and image search SEO |
| Multiple navs without labels | Warning | Blind users can't tell navigation sections apart without distinguishing labels |
| No skip-to-content link | Warning | Keyboard and screen reader users get stuck tabbing through the whole nav on every page |
| Decorative emoji not hidden | Info | Emoji without `aria-hidden="true"` get read aloud by screen readers — "SPARKLES" in English mid-Japanese-sentence |
| Icon fonts exposed | Info | Font Awesome icons without `aria-hidden` — screen readers read "icon icon-check" aloud |

---

## Three Fix Modes

Pick what you want to fix:

| Mode | What gets fixed |
|------|----------------|
| **SEO** | Page titles, meta descriptions, social sharing tags, headings, image alt text, structured data, hreflang tags |
| **ARIA** | All screen reader text — aria-labels, sr-only text, accessibility attributes |
| **Full Page** | Everything above, plus all visible text on the page — nav links, buttons, pricing cards, footer, badges |

---

## Your Score (0-100, Grade A–F)

Every scan gives your repo a score across 5 areas:

```
╔═══════════════════════════════════════════════════════╗
║  CATEGORY          │ WEIGHT │ WHAT IT MEASURES        ║
╠═══════════════════════════════════════════════════════╣
║  Technical SEO     │  22%   │ language tags, canonical║
║                    │        │ viewport, hreflang      ║
╠═══════════════════════════════════════════════════════╣
║  On-Page SEO       │  23%   │ title, description,     ║
║                    │        │ social tags, headings   ║
╠═══════════════════════════════════════════════════════╣
║  Accessibility     │  20%   │ alt text, aria-labels,  ║
║                    │        │ screen reader text      ║
╠═══════════════════════════════════════════════════════╣
║  Schema            │  10%   │ structured data,        ║
║                    │        │ sitemap locale support  ║
╠═══════════════════════════════════════════════════════╣
║  i18n Readiness    │  25%   │ hreflang, locale setup, ║
║                    │        │ translation completeness║
╚═══════════════════════════════════════════════════════╝
```

Deductions: Critical issues cost 15 points, warnings cost 8, info items cost 2.

---

## A Few Smart Details

**🔒 Brand protection.** LingoSEO reads your `package.json` to find your real brand name — that's the one file that never gets translated. If a previous run corrupted "InvoiceFlow" to "FacturaFlujo" in Spanish, **it catches it and reverts it.**

**🧹 Mixed-language cleanup.** Run translation tools a few times in a row and files end up with 3-5 languages mixed in. LingoSEO detects each string's language individually and **only translates the ones that don't already match the target.**

**🔍 It doesn't trust `<html lang>`** — that attribute is often stale or wrong. Gemini reads the actual text content to figure out what language the page really is.

---

## Getting Started

You'll need Node.js 18+, a GitHub account, and a free [Gemini API key](https://aistudio.google.com/apikey).

```bash
git clone https://github.com/your-username/lingoseo.git
cd lingoseo
npm install
```

Create `.env.local`:

```env
GEMINI_API_KEY=your_gemini_api_key
AUTH_GITHUB_ID=your_github_oauth_app_id
AUTH_GITHUB_SECRET=your_github_oauth_app_secret
AUTH_SECRET=any_random_string

# Optional
GEMINI_MODEL=gemini-2.5-flash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with GitHub. Paste a repo URL. Scan. Fix. Merge.

---

## Supported Languages

Arabic, Chinese (Simplified), Chinese (Traditional), Dutch, French, French (Canada), German, Hindi, Indonesian, Italian, Japanese, Korean, Polish, Portuguese (Brazil), Portuguese (Portugal), Russian, Spanish, Spanish (Mexico), Spanish (Argentina), Swedish, Turkish, Ukrainian, Vietnamese — plus any language code the lingo.dev SDK supports.

---

## Tech Stack

| | |
|--|--|
| Framework | Next.js 16, React 19, TypeScript |
| Translation | lingo.dev SDK (`LingoDotDevEngine`, custom `apiUrl`) |
| AI | Google Gemini 2.5 Flash |
| Scanning | Cheerio for pattern matching, Gemini for semantic analysis |
| Auth | NextAuth v5 (GitHub OAuth) |
| Git | simple-git, Octokit |

---

## The lingo.dev Connection

[lingo.dev](https://lingo.dev) (YC F24) built an SDK that separates translation infrastructure from translation intelligence. Their `apiUrl` feature lets you swap in your own endpoint — you keep all the SDK's plumbing (HTML parsing, batching, locale validation) and bring your own brain.

LingoSEO is what happens when that brain knows the difference between a search engine, a screen reader, and a human — **and writes differently for each one.**

---

<p align="center">
  Built for the <a href="https://lingo.dev">lingo.dev</a> Hackathon<br/>
  <strong>lingo.dev SDK</strong> + <strong>Google Gemini</strong> + <strong>GitHub</strong> = multilingual SEO + accessibility on autopilot
</p>
