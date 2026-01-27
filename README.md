# debba.sql

![](https://img.shields.io/github/release/debba/debba.sql.svg?style=flat)
![](https://img.shields.io/github/downloads/debba/debba.sql/total.svg?style=flat)
![Build & Release](https://github.com/debba/debba.sql/workflows/Release/badge.svg)
[![Known Vulnerabilities](https://snyk.io//test/github/debba/debba.sql/badge.svg?targetFile=package.json)](https://snyk.io//test/github/debba/debba.sql?targetFile=package.json)

A lightweight, developer-focused database management tool, built with Tauri and React.

> 💡 **Origin Story:** This project was born from a **vibe coding** session — an experiment in fluid, agent-assisted development to build a functional tool from scratch in record time.

## Release Download:

<!-- DOWNLOAD_SECTION_START -->
[![Windows](https://img.shields.io/badge/Windows-Download-blue?logo=windows)](https://github.com/debba/debba.sql/releases/download/v0.4.0/debba.sql_0.4.0_x64-setup.exe) [![macOS](https://img.shields.io/badge/macOS-Download-black?logo=apple)](https://github.com/debba/debba.sql/releases/download/v0.4.0/debba.sql_0.4.0_x64.dmg) [![Linux](https://img.shields.io/badge/Linux-Download-green?logo=linux)](https://github.com/debba/debba.sql/releases/download/v0.4.0/debba.sql_0.4.0_amd64.AppImage)
<!-- DOWNLOAD_SECTION_END -->

<div align="center">
  <img src="screenshots/overview.png" width="80%" alt="Main Window" />
</div>

## Gallery

<div align="center">
  <img src="screenshots/screenshot-1.png" width="45%" alt="Connection Manager" />
  <img src="screenshots/screenshot-2.png" width="45%" alt="SQL Editor and Data Grid" />
</div>
<div align="center">
  <img src="screenshots/screenshot-3.png" width="45%" alt="Table Wizard" />
  <img src="screenshots/screenshot-4.png" width="45%" alt="New Connection" />
</div>

## Features

### 🚀 New in v0.4.0

- **Visual Query Builder (Experimental):**
  - **Drag-and-Drop Interface:** Build SQL queries visually using a ReactFlow canvas.
  - **Visual JOINs:** Connect columns between tables to create relationships.
  - **JOIN Type Selection:** Click edge labels to cycle through INNER, LEFT, RIGHT, FULL OUTER, and CROSS joins.
  - **Column Configuration:** Click column names to configure aggregations, aliases, and position in SELECT.
  - **Aggregate Functions:** Support for COUNT, SUM, AVG, MIN, MAX, COUNT DISTINCT with auto-generated GROUP BY.
  - **Advanced Filters:** Build WHERE/HAVING conditions with AND/OR logic and inline delete.
  - **Column Ordering:** Assign position numbers to control column order in the generated SQL.
  - **Real-time SQL Preview:** See generated queries update live in the Run dropdown.
  - **Auto GROUP BY:** Automatic GROUP BY clause generation when mixing aggregated and non-aggregated columns.
- **Saved Queries:**
  - Tab titles now display saved query names instead of generic "Console".
- **UX Improvements:**
  - Fixed Run button integration with Visual Query Builder.
  - Delete table button now positioned in top-right corner of table nodes.
  - Improved zoom controls (no excessive zoom on drag).
  - Enhanced WHERE condition UI with inline delete button.
- **Debug:** Added console logging for Visual Query Builder queries (browser console only).

### 🔌 Connection Management

- Support for **PostgreSQL**, **MySQL/MariaDB**, and **SQLite**.
- Save and manage multiple connection profiles.
- Secure local persistence of connection settings.
- **SSH Tunneling:** Connect to remote databases securely via SSH tunnels.

### 🗄️ Database Explorer

- **Sidebar Navigation:** Quickly browse tables and saved queries.
- **Context Actions:**
  - Right-click tables to: `Select Top 100`, `Count Rows`, `View Schema`, `Copy Name`.

### 📝 SQL Editor

- **Monaco Editor:** Industry-standard editor with syntax highlighting.
- **Multiple Tabs:** DataGrip-style tab management with connection isolation.
- **Execution:** Run queries with `Ctrl+Enter` or Run button.
- **Partial Execution:** Select specific text to run only that portion.
- **Query History:** (Saved Queries feature covers this usage).

### 🎨 Visual Query Builder (Experimental)

- **Drag-and-Drop Interface:** Build queries visually using ReactFlow canvas.
- **Table Nodes:** Drag tables from the sidebar to the canvas.
- **Visual JOINs:** Connect columns between tables to create JOIN relationships.
- **JOIN Types:** Click edge labels to cycle through INNER, LEFT, RIGHT, FULL OUTER, and CROSS joins.
- **Column Selection:** Check columns to include in SELECT, click to configure aggregations and aliases.
- **Aggregate Functions:** Support for COUNT, SUM, AVG, MIN, MAX, COUNT DISTINCT with auto-generated GROUP BY.
- **Advanced Filters:** Build WHERE/HAVING conditions with AND/OR logic.
- **Sorting & Limits:** Configure ORDER BY and LIMIT clauses.
- **Real-time SQL Generation:** See the generated query update as you build.

<div align="center">
  <img src="screenshots/screenshot-5.png" width="80%" alt="Visual Query Builder" />
</div>

### 📊 Data Grid

- **Interactive Results:** Fast rendering of large result sets.
- **Inline Editing:** Double-click any cell to edit data (requires Primary Key).
- **Row Management:** Right-click to delete rows.
- **Create New Row:** Use "New Row" button to insert data into tables.
- **Export Data:** Export query results to CSV or JSON formats.

### 💾 Configuration Storage

Connection profiles are saved locally in `connections.json` at:

- **Linux:** `~/.config/com.debba.sql/`
- **macOS:** `~/Library/Application Support/com.debba.sql/`
- **Windows:** `%APPDATA%\com.debba.sql\`

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, Lucide Icons.
- **Backend:** Rust, Tauri v2, SQLx (Async, Type-safe).
- **Build Tool:** Vite.

## Development

### Prerequisites

- Node.js (v18+)
- Rust (Stable) & Cargo
- Linux dependencies (if on Linux): `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`.

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run in development mode:
   ```bash
   npm run tauri dev
   ```

### Building for Production

To build a standalone executable/installer:

```bash
npm run tauri build
```

## Roadmap

- [x] Multi-database support
- [x] Schema introspection
- [x] SQL Execution & Results
- [x] Inline Editing & Deletion
- [x] Create New Row
- [x] Data Export (CSV/JSON)
- [x] Saved Queries & Persistence
- [x] Pagination & Result Limiting
- [x] Multiple Tabs support
- [x] Visual Query Builder (Experimental)
- [ ] Database Export/Dump
- [ ] Multi-statement execution

## License

Apache License 2.0
