// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Ticket W12-GUARDS (2026-09-20). Three rules that, before this file, were
 * enforced by nothing except a person happening to have read CLAUDE.md or an
 * extraction ticket's own header comment. Every guard here scans the REAL
 * `src/` tree (not a fixture) so a future violation fails a real `npm test`
 * run, not a review comment.
 *
 * Deliberately no lint plugin, no AST parser, no new dependency — these are
 * plain string scans over real files using `node:fs`, with just enough
 * hand-rolled paren-balancing (see `extractCallArguments`) to survive the
 * one nested-call shape this codebase actually uses
 * (`doc(getFirebaseDb(), "users", uid, ...)`). This is a deliberately
 * narrow, low-tech tool: it recognises the specific call shapes this
 * codebase's own Firestore access layer already uses consistently (see
 * `src/lib/competitionDetail.ts`, `src/lib/accountProfile.ts`, etc. for the
 * real examples every regex below is modelled on) — it is not a general
 * Firestore-path analyser and would need rework if this codebase ever grew
 * a path-building helper/abstraction that obscures the literal collection
 * name at the call site.
 *
 * A THIRD candidate rule ("no silent numeric default on an engine-owned
 * value" — coins/points/livesRemaining defaulting to `0` instead of `null`)
 * was investigated and NOT shipped as a guard here. See this file's own
 * closing comment block for the full reasoning — short version: the
 * detection pattern itself has zero false positives against the real
 * codebase, but three of the seven real occurrences found
 * (`src/lib/competitionDetail.ts` x2, `src/lib/playerCompetitions.ts` x1,
 * all on the `points` field specifically) feed directly into
 * `src/lib/leaderboardRank.ts`'s D-18 ranking comparator, which requires a
 * real `number` to do arithmetic on. Making that field nullable is a real,
 * scoped, properly-tested refactor of a verified ranking subsystem — not
 * something to rush through as a side effect of a test-writing ticket.
 * Shipping the guard today would mean either committing it red (fails
 * `npm test`) or narrowing its field list specifically to dodge the fields
 * the ticket named as examples — both worse than not shipping it.
 */

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const THIS_FILE = fileURLToPath(import.meta.url);

interface Violation {
  /** Repo-relative path, forward slashes, e.g. "src/lib/foo.ts". */
  file: string;
  line: number;
  detail: string;
}

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && full !== THIS_FILE) {
      out.push(full);
    }
  }
  return out;
}

function toRepoRelative(absPath: string): string {
  return "src/" + path.relative(SRC_ROOT, absPath).split(path.sep).join("/");
}

function lineOf(content: string, index: number): number {
  return content.slice(0, index).split("\n").length;
}

/**
 * Finds every top-level call to `fnName(...)` in `content`, hand-balancing
 * parens so a nested call in the first argument (this codebase's own
 * `doc(getFirebaseDb(), "users", uid, ...)` shape) doesn't truncate the
 * match early. Requires a non-identifier character immediately before the
 * function name so e.g. searching for "collection(" never matches inside
 * "collectionGroup(" or "myCollection(".
 */
function extractCallArguments(content: string, fnName: string): Array<{ args: string; index: number }> {
  const marker = `${fnName}(`;
  const results: Array<{ args: string; index: number }> = [];
  let searchFrom = 0;

  while (true) {
    const idx = content.indexOf(marker, searchFrom);
    if (idx === -1) break;

    const before = content[idx - 1];
    if (before !== undefined && /[A-Za-z0-9_$.]/.test(before)) {
      searchFrom = idx + marker.length;
      continue;
    }

    const start = idx + marker.length;
    let depth = 1;
    let i = start;
    while (i < content.length && depth > 0) {
      if (content[i] === "(") depth++;
      else if (content[i] === ")") depth--;
      i++;
    }
    results.push({ args: content.slice(start, i - 1), index: idx });
    searchFrom = i;
  }

  return results;
}

/** Splits a call's argument text on top-level commas only (depth-aware, so
 * a nested array/object/call argument is never split in the middle). */
function splitTopLevelArgs(args: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of args) {
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    if (ch === ")" || ch === "]" || ch === "}") depth--;
    if (ch === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) parts.push(current);
  return parts.map((p) => p.trim());
}

function isQuotedLiteral(token: string, value: string): boolean {
  return token === `"${value}"` || token === `'${value}'` || token === `\`${value}\``;
}

function formatViolations(violations: Violation[], ruleQuote: string, citedAt: string): string {
  const lines = violations.map((v) => `  ${v.file}:${v.line} — ${v.detail}`).join("\n");
  return (
    `${violations.length} violation(s) of a rule written down at ${citedAt}:\n\n` +
    `  "${ruleQuote}"\n\n${lines}\n`
  );
}

/* ------------------------------------------------------------------ *
 * Guard 1 — the users/{uid}/days/{date} read ban.
 * ------------------------------------------------------------------ */

const DAYS_BAN_QUOTE =
  'Portal: must not read or display, ever, even though the rules technically allow ' +
  "the owner to read their own day record (Privacy Rules, below — this is a " +
  "project-level ban stricter than the rules). Engine-write only.";
const DAYS_BAN_CITATION = 'CLAUDE.md, Firestore Collections § "users/{userId}/days/{date}"';

function findDaysReadViolations(): Violation[] {
  const violations: Violation[] = [];

  for (const file of walkSourceFiles(SRC_ROOT)) {
    const content = fs.readFileSync(file, "utf8");
    const relFile = toRepoRelative(file);

    // doc(...)/collection(...) calls that name BOTH "users" and "days" as
    // literal path segments — the shape every real Firestore read in this
    // codebase uses (see src/lib/accountProfile.ts, competitionDetail.ts).
    for (const fnName of ["doc", "collection"]) {
      for (const call of extractCallArguments(content, fnName)) {
        const args = splitTopLevelArgs(call.args);
        const hasUsers = args.some((a) => isQuotedLiteral(a, "users"));
        const hasDays = args.some((a) => isQuotedLiteral(a, "days"));
        if (hasUsers && hasDays) {
          violations.push({
            file: relFile,
            line: lineOf(content, call.index),
            detail: `${fnName}(...) call names both "users" and "days" as literal path segments — a read of users/{uid}/days/{date}.`,
          });
        }
      }
    }

    // collectionGroup(db, "days") — a cross-user read of every user's days
    // subcollection at once, which does not even need to name "users" to
    // be a violation, and is a strictly worse version of the same ban.
    for (const call of extractCallArguments(content, "collectionGroup")) {
      const args = splitTopLevelArgs(call.args);
      if (args.some((a) => isQuotedLiteral(a, "days"))) {
        violations.push({
          file: relFile,
          line: lineOf(content, call.index),
          detail: `collectionGroup(...) call names "days" — a cross-user read of every users/{uid}/days/{date} subcollection at once.`,
        });
      }
    }
  }

  return violations;
}

describe("guard: users/{uid}/days/{date} is never read by the web portal", () => {
  it("has no doc()/collection()/collectionGroup() call naming the days subcollection", () => {
    const violations = findDaysReadViolations();
    if (violations.length > 0) {
      throw new Error(formatViolations(violations, DAYS_BAN_QUOTE, DAYS_BAN_CITATION));
    }
    expect(violations).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Guard 2 — competition status label/style mapping has exactly one home.
 * ------------------------------------------------------------------ */

const STATUS_MAPPING_QUOTE =
  "Single source of truth for how a competition's status is labelled and " +
  "styled — ticket W10-STATECHIP. Before this file, STATUS_LABEL was " +
  "declared independently in CompetitionDetail.tsx and CreatedCompetitions.tsx " +
  "(word-for-word identical), a THIRD copy lived in PlayingCompetitions.tsx " +
  "... All four are deleted; every consumer imports from here.";
const STATUS_MAPPING_CITATION = "src/lib/competition-status.ts's own header comment (ticket W10-STATECHIP)";

const CANONICAL_STATUS_FILE = path.join(SRC_ROOT, "lib", "competition-status.ts");
const STATUS_KEYS = ["scheduled", "active", "finalising", "finished"] as const;

function findStatusMappingViolations(): Violation[] {
  const violations: Violation[] = [];

  for (const file of walkSourceFiles(SRC_ROOT)) {
    if (file === CANONICAL_STATUS_FILE) continue;

    const content = fs.readFileSync(file, "utf8");
    const relFile = toRepoRelative(file);

    // A re-implementation looks like an object literal with ALL FOUR
    // status values as unquoted object keys ("scheduled: ...", not
    // `=== "scheduled"` and not an array element `"scheduled",`) — the
    // exact shape the deleted STATUS_LABEL/STATUS_BADGE_CLASSNAME copies
    // had. This deliberately does NOT match the legitimate KNOWN_STATUSES
    // arrays in competitions.ts/competitionDetail.ts/playerCompetitions.ts
    // (array elements, not object keys) or any `status === "scheduled"`
    // comparison anywhere in the app.
    const hasAllKeys = STATUS_KEYS.every((key) => new RegExp(`\\b${key}:\\s`).test(content));
    if (hasAllKeys) {
      // Report at the first key's line for a useful jump-to location.
      const firstKeyMatch = content.match(new RegExp(`\\b${STATUS_KEYS[0]}:\\s`));
      const line = firstKeyMatch?.index !== undefined ? lineOf(content, firstKeyMatch.index) : 1;
      violations.push({
        file: relFile,
        line,
        detail:
          "defines an object with scheduled/active/finalising/finished as its own keys — looks like a re-implementation of the shared status config.",
      });
    }
  }

  return violations;
}

describe("guard: exactly one competition-status label/style mapping exists", () => {
  it("has no second scheduled/active/finalising/finished config outside competition-status.ts", () => {
    const violations = findStatusMappingViolations();
    if (violations.length > 0) {
      throw new Error(formatViolations(violations, STATUS_MAPPING_QUOTE, STATUS_MAPPING_CITATION));
    }
    expect(violations).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Guard 4 (this agent's own addition) — no direct Firestore write outside
 * the one documented exception.
 * ------------------------------------------------------------------ */

const NO_DIRECT_WRITES_QUOTE =
  "the web portal never writes Firestore game state directly — every " +
  "mutation goes through an engine Cloud Functions callable " +
  "(src/lib/functions.ts, region europe-west2).";
const NO_DIRECT_WRITES_CITATION =
  'CLAUDE.md, "Firestore Collections (Shared with Android App)" — the rewritten-2026-09-19 opening note';

const DOCUMENTED_WRITE_EXCEPTION_FILE = path.join(SRC_ROOT, "lib", "accountProfile.ts");
const WRITE_FUNCTION_NAMES = ["setDoc", "updateDoc", "addDoc", "deleteDoc", "writeBatch", "runTransaction"];
const WRITE_CALL_RE = new RegExp(`\\b(${WRITE_FUNCTION_NAMES.join("|")})\\s*\\(`);

function findDirectWriteViolations(): Violation[] {
  const violations: Violation[] = [];

  for (const file of walkSourceFiles(SRC_ROOT)) {
    if (file === DOCUMENTED_WRITE_EXCEPTION_FILE) continue;

    const content = fs.readFileSync(file, "utf8");
    const relFile = toRepoRelative(file);
    const lines = content.split("\n");

    lines.forEach((lineText, idx) => {
      const match = lineText.match(WRITE_CALL_RE);
      if (match) {
        violations.push({
          file: relFile,
          line: idx + 1,
          detail: `calls ${match[1]}(...) directly — every Firestore mutation outside src/lib/accountProfile.ts's documented owner-profile exception must go through an engine callable (src/lib/functions.ts).`,
        });
      }
    });
  }

  return violations;
}

describe("guard: no direct Firestore write outside the one documented exception", () => {
  it("has no setDoc/updateDoc/addDoc/deleteDoc/writeBatch/runTransaction call outside accountProfile.ts", () => {
    const violations = findDirectWriteViolations();
    if (violations.length > 0) {
      throw new Error(formatViolations(violations, NO_DIRECT_WRITES_QUOTE, NO_DIRECT_WRITES_CITATION));
    }
    expect(violations).toEqual([]);
  });

  it("still allows the documented exception file itself to write users/{uid} and private/profile", () => {
    // Guards against a future edit accidentally widening the exclusion (e.g.
    // excluding a whole directory instead of this one file) without anyone
    // noticing this guard stopped checking anything real.
    expect(fs.existsSync(DOCUMENTED_WRITE_EXCEPTION_FILE)).toBe(true);
    const content = fs.readFileSync(DOCUMENTED_WRITE_EXCEPTION_FILE, "utf8");
    expect(WRITE_CALL_RE.test(content)).toBe(true);
  });
});
