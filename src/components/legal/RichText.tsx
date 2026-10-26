import Link from "next/link";
import type { ReactNode } from "react";

/**
 * WEB-LEGAL-1. Minimal inline-markdown renderer for the two legal pages
 * (`/privacy`, `/account-deletion`). The body copy on both pages is
 * Paul-approved text pasted in verbatim from
 * `.ticket-refs/*-APPROVED-20261026.md` — this component exists so that
 * copy can live in page source as a plain template-literal string (the
 * form closest to the approved markdown, easiest to diff against it) while
 * still rendering real `<strong>`/`<a>`/`<Link>` elements, instead of hand
 * splitting every sentence into JSX children (error-prone when the goal is
 * exact wording).
 *
 * Supports exactly what the approved copy uses: **bold**, markdown
 * [label](url) links, `hello@ileadit.co.uk`-style email addresses (always
 * rendered as `mailto:`), and two specific bare link targets
 * (ico.org.uk/make-a-complaint, ileadit.co.uk/account-deletion). This is
 * NOT a general markdown renderer — don't extend it to support new syntax
 * without first checking it's still only ever fed these two trusted,
 * static source files.
 */

const LINK_CLASS =
  "font-semibold text-foreground underline decoration-2 underline-offset-2 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy rounded-sm";

const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)]+)\)/;
const BOLD = /\*\*([^*]+)\*\*/;
const EMAIL = /[\w.+-]+@ileadit\.co\.uk/;

const BARE_LINKS: Record<string, string> = {
  "ico.org.uk/make-a-complaint": "https://ico.org.uk/make-a-complaint",
  "ileadit.co.uk/account-deletion": "/account-deletion",
};

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const candidates: Array<{ index: number; length: number; node: ReactNode }> = [];

  const mdLink = MARKDOWN_LINK.exec(text);
  if (mdLink) {
    candidates.push({
      index: mdLink.index,
      length: mdLink[0].length,
      node: (
        <Link key={`${keyPrefix}-md`} href={mdLink[2]} className={LINK_CLASS}>
          {mdLink[1]}
        </Link>
      ),
    });
  }

  const bold = BOLD.exec(text);
  if (bold) {
    candidates.push({
      index: bold.index,
      length: bold[0].length,
      node: (
        <strong key={`${keyPrefix}-b`} className="font-bold text-foreground">
          {renderInline(bold[1], `${keyPrefix}-b-in`)}
        </strong>
      ),
    });
  }

  const email = EMAIL.exec(text);
  if (email) {
    candidates.push({
      index: email.index,
      length: email[0].length,
      node: (
        <a key={`${keyPrefix}-e`} href={`mailto:${email[0]}`} className={LINK_CLASS}>
          {email[0]}
        </a>
      ),
    });
  }

  for (const [label, href] of Object.entries(BARE_LINKS)) {
    const idx = text.indexOf(label);
    if (idx !== -1) {
      candidates.push({
        index: idx,
        length: label.length,
        node: href.startsWith("http") ? (
          <a key={`${keyPrefix}-l-${label}`} href={href} className={LINK_CLASS}>
            {label}
          </a>
        ) : (
          <Link key={`${keyPrefix}-l-${label}`} href={href} className={LINK_CLASS}>
            {label}
          </Link>
        ),
      });
    }
  }

  if (candidates.length === 0) {
    return text.length > 0 ? [text] : [];
  }

  candidates.sort((a, b) => a.index - b.index);
  const first = candidates[0];
  const before = text.slice(0, first.index);
  const after = text.slice(first.index + first.length);

  return [...(before ? [before] : []), first.node, ...renderInline(after, `${keyPrefix}-n`)];
}

export function Rich({ text, keyPrefix }: { text: string; keyPrefix: string }) {
  return <>{renderInline(text, keyPrefix)}</>;
}

export function RichP({
  text,
  keyPrefix,
  className,
}: {
  text: string;
  keyPrefix: string;
  className?: string;
}) {
  return (
    <p className={className ?? "text-base leading-relaxed text-muted-foreground"}>
      <Rich text={text} keyPrefix={keyPrefix} />
    </p>
  );
}

export function RichList({
  items,
  keyPrefix,
  className,
}: {
  items: string[];
  keyPrefix: string;
  className?: string;
}) {
  return (
    <ul role="list" className={className ?? "space-y-2"}>
      {items.map((item, i) => (
        <li
          key={`${keyPrefix}-li-${i}`}
          className="text-base leading-relaxed text-muted-foreground before:mr-2 before:content-['\2022']"
        >
          <Rich text={item} keyPrefix={`${keyPrefix}-li-${i}`} />
        </li>
      ))}
    </ul>
  );
}
