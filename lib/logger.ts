const COLORS = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
  green: "\x1b[32m",
  lime: "\x1b[92m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
};

function ts() {
  return `${COLORS.gray}${new Date().toISOString().slice(11, 23)}${COLORS.reset}`;
}

function tag(label: string, color: string) {
  return `${color}${COLORS.bold}[${label}]${COLORS.reset}`;
}

export const log = {
  // ── pipeline steps ──────────────────────────────────────
  step: (msg: string) =>
    console.log(`${ts()} ${tag("STEP", COLORS.lime)} ${COLORS.bold}${msg}${COLORS.reset}`),

  // ── success ─────────────────────────────────────────────
  ok: (msg: string) =>
    console.log(`${ts()} ${tag(" OK ", COLORS.green)} ${msg}`),

  // ── info ────────────────────────────────────────────────
  info: (msg: string) =>
    console.log(`${ts()} ${tag("INFO", COLORS.cyan)} ${msg}`),

  // ── warning ─────────────────────────────────────────────
  warn: (msg: string) =>
    console.warn(`${ts()} ${tag("WARN", COLORS.yellow)} ${msg}`),

  // ── error ───────────────────────────────────────────────
  err: (msg: string, err?: unknown) => {
    console.error(`${ts()} ${tag("ERR!", COLORS.red)} ${COLORS.red}${msg}${COLORS.reset}`);
    if (err instanceof Error) {
      console.error(`${COLORS.gray}       ${err.message}${COLORS.reset}`);
      if (err.stack) {
        console.error(`${COLORS.gray}${err.stack.split("\n").slice(1, 4).join("\n")}${COLORS.reset}`);
      }
    } else if (err !== undefined) {
      console.error(`${COLORS.gray}       ${String(err)}${COLORS.reset}`);
    }
  },

  // ── sub-items ───────────────────────────────────────────
  item: (msg: string) =>
    console.log(`${ts()} ${COLORS.gray}  ↳${COLORS.reset}  ${msg}`),

  // ── divider ─────────────────────────────────────────────
  divider: (label: string) =>
    console.log(`\n${COLORS.lime}${"─".repeat(20)} ${label} ${"─".repeat(20)}${COLORS.reset}\n`),
};
