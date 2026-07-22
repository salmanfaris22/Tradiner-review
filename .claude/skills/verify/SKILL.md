---
name: verify
description: Build/run/drive the mentor-rating form to observe changes at the browser surface. Use when verifying edits to index.html or Code.gs.
---

# Verify — mentor rating form

Static single page (`index.html`) + Google Apps Script (`Code.gs`). Surface = the browser.

## Handle

No build step. Serve the page and mock the Apps Script endpoint so submit works
without deploying to Google:

1. Copy `index.html` + `images/` to a scratch dir, replace
   `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with `http://127.0.0.1:8787/submit`.
2. Node http server: serve the scratch dir, and on `POST /submit` append the raw
   body to a capture file and reply `{"ok":true}` with `Access-Control-Allow-Origin: *`.
3. Drive real Chrome over CDP — no npm deps, Node 22+ has a global `WebSocket`:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --remote-debugging-port=9333 --user-data-dir=<scratch>/cp --no-first-run \
  --no-default-browser-check --hide-scrollbars about:blank &
# then: GET http://127.0.0.1:9333/json/list → page target's webSocketDebuggerUrl
# Page.enable / Runtime.enable, Runtime.evaluate to click, Page.captureScreenshot
```

Playwright is **not** installed (no browsers cached) — don't reach for it.

## Gotchas

- **Screenshot as JPEG, `deviceScaleFactor: 1`.** PNG at dsf 2 produces frames big
  enough that Chrome drops the CDP socket (close code 1006) mid-run and the driver
  hangs. `{format:'jpeg',quality:72,captureBeyondViewport:false}` is stable.
- Always put a per-call timeout on CDP sends; a stuck call otherwise looks like a
  clean `exit 0` (Node exits when the socket dies and nothing keeps the loop alive).
- `images/rahoof.jpg` / `samad.jpg` are placeholders — 404s in the console are
  expected; the initials-avatar fallback is what should render.
- `navigator.vibrate` warnings in headless are noise (no real user gesture).

## Flows worth driving

- intro → `#btnStart` → 9 mentor picks (cards auto-advance after ~430ms) → review → `#btnSubmit` → thank-you + confetti.
- Check the captured POST body: `{answers, questions, submittedAt, userAgent}`,
  `Content-Type: text/plain` (that's what keeps Apps Script out of CORS preflight).
  No `name`/`batch` — the form is anonymous by design.
- Responsive: `Emulation.setDeviceMetricsOverride` at 390x844, 360x640, and
  844x390 landscape. Assert `document.documentElement.scrollWidth <= innerWidth`.
- Probes that have caught things: click Next with nothing picked (toast, no advance),
  search with no match, back-navigation from review keeps the selection.

## Not verifiable locally

Deploying `Code.gs` needs the user's Google account. Verify the client contract
against the mock, then read `Code.gs`'s column mapping against the captured body.
