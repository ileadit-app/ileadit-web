import type { NextConfig } from "next";

/**
 * WEB-CR1 (28 Oct 2026 code review). Every security header, including CSP,
 * is one static value applied to every route here — deliberately NOT a
 * per-request nonce-based CSP in middleware.ts.
 *
 * A nonce-based `script-src 'nonce-...' 'strict-dynamic'` was tried first
 * and reverted after proving it out against a real production build
 * (`next build` + `next start`, curl + direct HTML inspection): this app's
 * route table is mostly STATIC (`○`, prerendered once at build time) —
 * `/`, `/about`, `/pricing`, `/download`, `/privacy`, `/terms`,
 * `/account-deletion`, `/login`, `/signup`, `/dashboard`, `/account`,
 * `/competitions/new` — with only `/competitions/[id]` and `/invite/[code]`
 * actually dynamic (`ƒ`). Next.js's documented nonce-propagation
 * (https://nextjs.org/docs/app/guides/content-security-policy) stamps a
 * per-request nonce onto its generated `<script>` tags ONLY for dynamically
 * rendered routes — a statically prerendered page's HTML (and its inline
 * RSC-hydration `<script>` payloads) is generated once at BUILD time, long
 * before any request-specific nonce exists, so it can never carry one.
 *
 * Per the CSP spec, once a `script-src` directive contains a nonce-source
 * (or `'strict-dynamic'`), CSP-aware browsers ignore `'unsafe-inline'`
 * entirely and trust ONLY nonced (or dynamically-trusted) scripts. Combined
 * with the fact above, that would have silently blocked every inline
 * hydration script on every static page in any modern evergreen browser —
 * confirmed by inspecting a real built/served static page's HTML and
 * finding zero `nonce="..."` attributes on its `<script>` tags despite the
 * response header itself carrying a fresh nonce each time. A broken,
 * blank-on-load site is a far worse outcome than a plain `'unsafe-inline'`
 * script-src, so this file uses the latter. Do not reintroduce
 * nonce/`'strict-dynamic'` here without first either (a) moving every route
 * to force-dynamic rendering, or (b) re-verifying against a real built app
 * that nonces actually reach every route's rendered output.
 */
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            // Every directive below is justified by a REAL, grep-confirmed
            // need in this codebase — see the inline comments. If a future
            // feature needs a new external domain, add it here with the
            // same kind of comment; don't widen a directive to a bare
            // `https:`/`*` to make an error go away.
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 'unsafe-inline' is required for Next's own RSC-hydration
              // inline <script> payloads on statically prerendered pages
              // (see header comment above for why a nonce can't be used
              // instead). https://www.google.com + https://www.gstatic.com
              // are reCAPTCHA v3's own script host, dynamically injected by
              // Firebase App Check's ReCaptchaV3Provider (src/lib/appCheck.ts).
              // https://apis.google.com is required by EVERY
              // signInWithPopup() call (src/lib/auth.ts's signInWithGoogle/
              // signInWithMicrosoft, src/components/auth/AccountLinkingPanel.tsx's
              // linkViaProvider) regardless of which OAuth provider is used
              // — confirmed by reading @firebase/auth's own bundled source
              // (node_modules/@firebase/auth/dist/esm/index-*.js,
              // `_setExternalJSProvider`): the popup/redirect resolver
              // injects a real `<script src="https://apis.google.com/js/api.js">`
              // tag into THIS page (not the popup window) to load
              // `gapi.iframes`, the cross-window postMessage relay Firebase
              // Auth uses to learn the popup's sign-in result. Without this
              // host, `gapi.load` never resolves and every popup sign-in
              // (Google today; Microsoft once isMicrosoftSignInEnabled()
              // flips on) hangs/fails — the provider's own IdP page the
              // popup navigates to (accounts.google.com,
              // login.microsoftonline.com) is a separate top-level browsing
              // context and is NOT subject to this page's CSP at all, so it
              // needs no entry here.
              "script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://apis.google.com",
              // Tailwind's utility classes compile to a real stylesheet
              // (<link>, already covered by 'self'), but several components
              // in this codebase set inline style={{...}} attributes
              // (decorative blur/gradient positioning, etc) — there is no
              // nonce mechanism for the style attribute, so this is the one
              // deliberate, minimum 'unsafe-inline' this directive needs.
              "style-src 'self' 'unsafe-inline'",
              // Firebase Storage (competition background images,
              // src/components/competitions/CompetitionHero.tsx), inline
              // `data:` QR codes (src/components/invite/InviteQrCode.tsx),
              // and Google/Microsoft OAuth avatar photos
              // (src/components/layout/Header.tsx's Avatar).
              "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://ileadit-app.firebasestorage.app https://*.googleusercontent.com",
              "font-src 'self' data:",
              // WEB-CR1-FIX2: narrowed from a bare https://*.googleapis.com
              // wildcard to the EXACT hosts this app's Firebase client SDKs
              // (firebase@12.11.0) actually call — confirmed by grepping
              // node_modules/@firebase/{auth,firestore,storage,app-check,
              // installations}/dist/*.js for every *.googleapis.com literal
              // each package contains, then keeping only the ones this app
              // actually exercises (re-run that grep and re-check this list
              // after any Firebase SDK major-version bump):
              //   - identitytoolkit.googleapis.com / securetoken.googleapis.com
              //     — firebase/auth (sign-in, token refresh)
              //   - firestore.googleapis.com — firebase/firestore (every
              //     onSnapshot/query call in src/lib)
              //   - firebasestorage.googleapis.com — firebase/storage
              //     (artwork upload XHR itself; already present in img-src
              //     for the resulting download URLs, but uploadBytesResumable's
              //     own request needs it in connect-src too)
              //   - firebaseinstallations.googleapis.com — firebase/installations
              //     (the FID App Check's token exchange is keyed on)
              //   - content-firebaseappcheck.googleapis.com — firebase/app-check
              //     (the reCAPTCHA-token-to-App-Check-token exchange,
              //     src/lib/appCheck.ts)
              // storage.googleapis.com appears in @firebase/storage's source
              // too, but only inside a regex that PARSES gs:// URLs — the
              // SDK's real DEFAULT_HOST is firebasestorage.googleapis.com, so
              // it's deliberately excluded here.
              // europe-west2-ileadit-app.cloudfunctions.net is the Functions
              // callable endpoint (src/lib/functions.ts — the ONE file
              // allowed to name this region). www.google.com/www.gstatic.com
              // are reCAPTCHA v3's own verification hosts (src/lib/appCheck.ts).
              "connect-src 'self' https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://firebaseinstallations.googleapis.com https://content-firebaseappcheck.googleapis.com https://europe-west2-ileadit-app.cloudfunctions.net https://www.google.com https://www.gstatic.com",
              // reCAPTCHA v3's invisible-challenge iframe, and Firebase
              // Auth's hidden iframe helper at the project's authDomain
              // (used for persistence/redirect-result handling even though
              // this app only calls signInWithPopup, not signInWithRedirect).
              "frame-src https://www.google.com https://recaptcha.google.com https://ileadit-app.firebaseapp.com",
              // Nobody should ever iframe ileadit.co.uk itself.
              "frame-ancestors 'none'",
              "form-action 'self'",
              "base-uri 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
          {
            // Forces HTTPS for a year, including subdomains, and opts into
            // browser HSTS preload lists. Safe to ship immediately: this
            // app is only ever served over HTTPS (Firebase Hosting/Vercel),
            // there is no HTTP fallback to break.
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
          {
            // Stops a browser from "helpfully" re-interpreting a response
            // as a different content-type than the one it was served with
            // (the classic MIME-sniffing XSS vector).
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            // Belt-and-braces alongside the CSP `frame-ancestors 'none'`
            // above — browsers too old to honour CSP3's frame-ancestors
            // still respect this header.
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            // Sends the full URL to same-origin requests/navigations
            // (useful for this app's own analytics-free referrer-based
            // debugging) but only the origin, never the full path/query,
            // to a cross-origin destination — avoids leaking e.g. a
            // competition ID or invite code to an external site via the
            // Referer header on an outbound link.
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            // Minimal deny-by-default list — this app doesn't use the
            // camera, microphone, or ambient-light/geolocation sensors;
            // nothing here should ever be grantable to an embedded iframe
            // (there shouldn't be one, per frame-ancestors) or this origin.
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
