# Barakath Agencies — Full Stack ERP

Complete business management app with React frontend + Express + SQLite database.
Data saves to a real file on your computer (`barakath-agencies.db`).

---

## First Time Setup

### 1. Install dependencies
```bash
npm install
```
> If you get an error on Windows about `better-sqlite3`, run this first:
> `npm install --global windows-build-tools`

### 2. Start the app
```bash
npm run start
```
This runs **both** at once:
- React frontend → http://localhost:3000
- SQLite API server → http://localhost:4000

Open http://localhost:3000 in your browser.

---

## Migrate existing data (if you used the old version)

If you had data in the old browser-based version:

1. Make sure the app is running (`npm run start`)
2. Open `migrate.html` in Chrome (drag the file into browser)
3. Click **Start Migration**
4. Done — all your old data is now in SQLite

---

## Where is my database file?

`barakath-agencies.db` in this folder.

**Backup:** Copy this file to USB drive, Google Drive, etc.
**Restore:** Replace the file and restart with `npm run start`.

You can also view/edit it with the free app: https://sqlitebrowser.org/

---

## Project Structure

```
barakath-agencies/
├── server/
│   ├── database.js      ← SQLite setup, creates all tables
│   └── index.js         ← Express API (all routes)
├── src/
│   ├── lib/
│   │   ├── db.ts        ← API client (talks to Express server)
│   │   └── utils.ts
│   ├── pages/           ← All app pages (Sales, Products, etc.)
│   ├── components/      ← Layout, modals, etc.
│   ├── context/         ← Auth, Settings, Theme
│   ├── hooks/           ← Keyboard nav hooks
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── migrate.html         ← One-time migration from old IndexedDB
├── index.html
├── package.json
├── vite.config.ts       ← Proxies /api → localhost:4000
└── tsconfig.json
```

---

## How it works

```
Browser (React) → /api/... → Vite Proxy → Express :4000 → SQLite file
```

All your business data: customers, sales, purchases, expenses, inventory,
products, reminders — everything is saved in `barakath-agencies.db`.

---

## Login

Default owner credentials:
- Phone: `8870551144`
- Username: `asraf`
- Password: `xyz12345`

(Change these in Settings → Owner Profile)
