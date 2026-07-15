# Practising Bank Reconciliation — Flipbook Guide

A self-contained, client-facing HTML flipbook for the **"Practising Bank
Reconciliation in Your Demo Account"** guidance, built for a fixed
**600 × 1080px** Rocketlane embed. Data is pulled live from Google Sheets via
Apps Script, so you can update the guide by editing the sheet — no code
changes needed.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page shell — header, page viewport, nav, loading/error states |
| `styles.css` | All styling: 600×1080 canvas, cards, theme, accessibility |
| `script.js` | Fetches data, builds sections, paginates, drives navigation |
| `apps-script.gs` | Backend — paste into your existing Apps Script project |

No build step, no npm install, no server-side hosting required.

## 1. Add your deployed Apps Script URL

Open **`script.js`** and find `CONFIG` near the top:

```js
var CONFIG = {
  webAppUrl: 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE',
  sheetParam: 'bankRecon',
  requestTimeoutMs: 12000
};
```

Replace `PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE` with your deployed `/exec`
URL (the same one already used by your Rules & Conditions / Call Types
guides — see `apps-script.gs` below). Leave `sheetParam` as `'bankRecon'`;
this tells the shared Apps Script which tab to read.

## 2. Spreadsheet structure

Tab name (must match exactly):

```
Practising Bank Reconciliation in Your Demo Account
```

Row 1 = headers, data starts row 2:

| Column | Header | Notes |
|---|---|---|
| A | Guidance | Used as the page/section title |
| B | Who | Card — omitted from the page if blank |
| C | What | Card — omitted from the page if blank |
| D | Where | Card — omitted from the page if blank |
| E | When | Card — omitted from the page if blank |
| F | Why | Card — omitted from the page if blank |
| G | How | Card — omitted if blank; rendered more prominently; auto-detects numbered steps (e.g. `1.`, `2.`, `Step 1:`) and shows them as a numbered list |
| H | Sort Order | Controls display order. Numeric values sort correctly (1, 2, 3, 10…); non-numeric or blank values sort after numeric ones, in sheet order |
| I | Active | Row is shown only if this evaluates as active — accepts `TRUE`, `Yes`, `Active`, `1`, `Y` (case-insensitive) |

Blank rows are ignored automatically. Sort Order and Active are never shown
to the client. Paragraph breaks within a cell (line breaks) are preserved.

**Updating content:** edit the sheet, and the page picks it up next time it
loads — no deploy needed for content changes, only for changes to the Apps
Script code itself.

## 3. Apps Script

`apps-script.gs` is a **combined** backend that already serves your Rules &
Conditions and Call Types guides, with a new `bankRecon` branch added for
this guide. It reads the exact tab name above, uses row 1 as headers, filters
to active rows, sorts by Sort Order, and returns clean JSON (or JSONP if a
`callback` parameter is present — used here to avoid cross-origin issues from
GitHub Pages).

To deploy:

1. Open the **Accounting Onboarding / Amy Dawber** spreadsheet.
2. **Extensions > Apps Script**.
3. Replace the existing `Code.gs` contents with `apps-script.gs` from this
   folder (it's a full replacement, not a patch — it still contains your
   Rules & Conditions and Call Types logic, just with the Bank Recon branch
   added).
4. **Deploy > Manage deployments >** pencil icon on your existing
   deployment **> New version > Deploy**. This keeps your existing `/exec`
   URL — you don't need to change it in any of the three guides.
5. Deployment permissions: **Execute as: Me**, **Who has access: Anyone**
   (this is what allows the public GitHub Pages site to read it without
   asking viewers to log in — it only ever returns the read-only fields
   listed above, never edit access).
6. Test directly in a browser:
   - `https://YOUR-DEPLOY-URL/exec?sheet=bankRecon` — should return JSON
   - `https://YOUR-DEPLOY-URL/exec?sheet=bankRecon&callback=test` — should
     return `test({...});` (confirms JSONP still works)

If you ever move this script into a **standalone** Apps Script project
(rather than bound to the sheet), set `SPREADSHEET_ID` near the top of the
file to the spreadsheet's ID from its URL.

## 4. Testing locally

Because the page fetches data via a `<script>` tag (JSONP), it works fine
opened directly as a local file — no local server required. Just open
`index.html` in Chrome after adding your Apps Script URL. If it doesn't load,
open the browser console (F12) for the logged error.

## 5. Deploying to GitHub Pages

1. Create (or reuse) a GitHub repo and push these four files to it.
2. **Settings > Pages > Deploy from a branch**, pick `main` (or your default
   branch) and `/ (root)`.
3. GitHub gives you a URL like:
   `https://your-username.github.io/your-repo-name/`
4. That URL is what you embed in Rocketlane (see below). All file references
   are relative, so this works correctly as a project subpath site.

To update later: edit the sheet for content, or push new commits to
`index.html` / `styles.css` / `script.js` for design/behaviour changes.
GitHub Pages redeploys automatically within a minute or two.

## 6. Embedding in Rocketlane

Embed as an iframe at the recommended **600 × 1080** dimensions, e.g.:

```html
<iframe
  src="https://your-username.github.io/your-repo-name/"
  width="600"
  height="1080"
  style="border:0;"
  loading="lazy"
  title="Practising Bank Reconciliation in Your Demo Account">
</iframe>
```

The page is built specifically for this fixed canvas — it never scrolls
(horizontally or vertically), and all navigation stays within the frame.

## How the guide behaves

- **Pagination is automatic and content-aware.** Each guidance row becomes
  one or more pages depending on how much content it has. `script.js`
  measures real rendered height (not character counts) to decide how many
  "Who / What / Where / When / Why / How" cards fit per page, using a
  two-column layout for shorter content and one column for longer content,
  and only spills onto a **"Continued"** page when content genuinely
  doesn't fit.
- **Navigation:** Back/Next buttons, left/right arrow keys, touch swipe,
  a page counter ("3 of 8") and progress bar. Buttons disable at the first
  and last page.
- **Loading/error states:** a spinner while fetching, and a friendly retry
  screen (with technical details logged to the console) if the Apps Script
  request fails or returns no active rows.
- **Accessibility:** visible keyboard focus states, semantic headings, a
  screen-reader-only live region announcing page changes, and a
  reduced-motion fallback for page transitions.
- **Recalculation:** pagination re-runs if the browser window is resized or
  fonts finish loading, so the layout stays correct.
