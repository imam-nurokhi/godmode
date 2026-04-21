<div align="center">

# 🖥️ Nexora Support
### IT Helpdesk Dashboard

[![Tickets](https://img.shields.io/badge/tickets-865-00d4aa?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZD0iTTkgNUg3YTIgMiAwIDAwLTIgMnYxMmEyIDIgMCAwMDIgMmgxMGEyIDIgMCAwMDItMlY3YTIgMiAwIDAwLTItMmgtMk05IDVhMiAyIDAgMDAyIDJoMmEyIDIgMCAwMDItMk05IDVhMiAyIDAgMDEyLTJoMmEyIDIgMCAwMTIgMiIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBmaWxsPSJub25lIi8+PC9zdmc+)](data/tickets.json)
[![Resolve Rate](https://img.shields.io/badge/resolve_rate-90.6%25-3fb950?style=flat-square)](data/tickets.json)
[![Categories](https://img.shields.io/badge/categories-13-a371f7?style=flat-square)](data/tickets.json)
[![License](https://img.shields.io/badge/license-MIT-f0883e?style=flat-square)](LICENSE)

*A real-data, zero-backend IT helpdesk dashboard — dark theme, live stats, instant filters.*

</div>

---

## ✨ Features

| Feature | Details |
|---|---|
| **865 real tickets** | Parsed from live helpdesk export (Jul 2025 → Apr 2026) |
| **Live statistics** | Status counts, category breakdown, monthly trend |
| **Instant filtering** | By status, category, and free-text search |
| **Detail drawer** | Full ticket metadata + latest reply preview |
| **Pagination** | 20 tickets/page with smart ellipsis |
| **Loading screen** | Animated progress bar while data fetches |
| **Responsive** | Desktop sidebar + mobile bottom nav |
| **Zero dependencies** | Pure HTML/CSS/JS — no npm, no build step |

---

## 🗂️ Project Structure

```
godmode/
├── index.html              # Entry point — clean markup, no inline logic
├── assets/
│   ├── css/
│   │   └── main.css        # Full stylesheet (816 lines, dark theme tokens)
│   └── js/
│       └── app.js          # App logic: fetch → compute → render (561 lines)
├── data/
│   └── tickets.json        # 865 real support tickets (~1.1 MB)
└── README.md
```

---

## 🚀 Getting Started

> **Important**: `app.js` uses `fetch('./data/tickets.json')`. You **must** run a local HTTP server — opening `index.html` directly as a `file://` URL will fail due to browser CORS policy.

### Option A — Python (zero install)
```bash
cd godmode
python3 -m http.server 8080
# → open http://localhost:8080
```

### Option B — Node.js
```bash
npx serve .
# → follow the URL printed in terminal
```

### Option C — VS Code
Install the **Live Server** extension, right-click `index.html` → *Open with Live Server*.

---

## 📊 Data Overview

| Metric | Value |
|---|---|
| Total tickets | 865 |
| Date range | Jul 2025 – Apr 2026 |
| Resolve rate | 90.6% (784 closed) |
| Open | 44 |
| In Progress | 26 |
| Pending | 10 |

**Top categories:**

| Category | Tickets |
|---|---|
| AUDITQ | 295 |
| CRM | 140 |
| AUDIT SERVICE | 85 |
| MARKETING | 75 |
| WEBSITE | 64 |

---

## 🛠️ Tech Stack

- **HTML5** — semantic structure, zero framework
- **CSS3** — custom properties (design tokens), CSS Grid, Flexbox
- **Vanilla JS (ES2020+)** — `async/await`, `fetch`, optional chaining
- **JetBrains Mono** + **Inter** — fonts via Google Fonts
- **No build tool** — edit and serve, that's it

---

## 📐 Architecture

```
data/tickets.json
      │
      ▼ fetch() [app.js: init()]
normalise()           ← maps raw API fields → lean ticket objects
      │
      ▼
computeStats()        ← derives byStatus / byCat / byMonth / topUsers
      │
      ▼
render()
  ├── renderStats()   → #statsGrid    (5 stat cards)
  ├── renderList()    → #ticketList   (paginated rows)
  └── renderSidebar() → #rightPanel   (trend bars, category bars, top users)
```

State is a plain object — no store, no reactive framework. Filters mutate `state.*` and call `render()`.

---

## 🌐 Deploy to GitHub Pages

```bash
# From repo root
git push origin main
# Then: Settings → Pages → Source: main / (root)
```

> Note: GitHub Pages is a static host — `fetch('./data/tickets.json')` works fine since the file is in the same origin.

---

## 📄 License

MIT — do whatever you want, attribution appreciated.

---

<div align="center">
  Built with ☕ and real data · <a href="https://github.com/imam-nurokhi/godmode">imam-nurokhi/godmode</a>
</div>
