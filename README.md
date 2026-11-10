# Males Ngonten Studio 🐱🎬

**Males Ngonten Studio** adalah studio pembuatan dan pengeditan video open-source berbasis AI coding agent dengan **Remotion** sebagai engine video utama. Didesain secara khusus agar ramah perangkat mobile (mobile-first), minimalis, dan dapat dijalankan secara mandiri langsung di perangkat pengguna (termasuk Android melalui Termux + proot Ubuntu ARM64).

---

## 🌟 Fitur Utama

1. **Remotion Player Realtime (9:16 Portrait)**:
   - Preview video portrait full-bleed dioptimalkan untuk TikTok, Reels, dan YouTube Shorts.
   - Live drag-and-drop bounding box pada canvas untuk mengatur posisi elemen (X & Y) dengan panduan garis tengah (center guides).
   - Play/pause instan, seek frame scrubber, dan timecode indicator.

2. **AI Agent Chat & Automatic Agent Discovery**:
   - Deteksi otomatis AI coding agent yang terpasang di host: **Males Ngonten Core Engine**, **Claude Code CLI**, **Gemini CLI**, dan **Ollama LLM Lokal**.
   - Komunikasi protokol ACP (Agent Client Protocol) terstruktur dengan tool calls real-time (`readFile`, `writeFile`, `listDirectory`, `gitCheckpoint`).
   - Riwayat sesi percakapan, lampiran file multi-format, indikator status berpikir/eksekusi tools/streaming kode.
   - Fixed bottom chat input dengan pengetikan LTR yang responsif.

3. **Workspace Lokal & Manajemen Proyek**:
   - Pengelolaan file proyek secara nyata di filesystem (`timeline.json`, `ShortVideoComposition.tsx`, `GEMINI.md`, `assets.json`).
   - Asset Manager dengan dropzone untuk gambar, video latar, audio musik, dan font kustom.
   - Code Inspector dengan syntax highlighting CodeMirror 6 untuk meninjau deklarasi TSX Remotion.

4. **Remotion Local Rendering Engine**:
   - Konfigurasi resolusi (720p, 1080p, 4K) dan frame rate (24, 30, 60 FPS).
   - Script rendering mandiri (`scripts/render-cli.mjs`) yang dikonfigurasi dengan flag `--no-sandbox` untuk kompatibilitas ARM64 proot.
   - Live progress frame-by-frame melalui Server-Sent Events (SSE) dengan tombol unduh MP4 langsung.

5. **Diagnostik Sistem ARM64 & Android Termux**:
   - Tab diagnostik terintegrasi untuk mendeteksi CPU architecture, sisa RAM fisik, status Chromium headless, dan FFmpeg.
   - Peringatan dini risiko Android Out-Of-Memory (OOM) dan Android 12+ Phantom Process Killer.

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│               Frontend UI (React 19 + Tailwind CSS)            │
│  - Remotion Video Player (Canvas Drag & Drop Bounding Box)      │
│  - 50:50 Vertical Split Layout (Player Top / Chat Bottom)       │
│  - Multi-track Timeline Drawer, Code Inspector, Asset Manager   │
└───────────────────────────────┬─────────────────────────────────┘
                                │
              HTTP REST + SSE (Server-Sent Events)
                                │
┌───────────────────────────────▼─────────────────────────────────┐
│            Backend Node.js API (server.ts / Express)            │
│  - Agent Discovery Service (Checks PATH for Claude/Gemini/Ollama)│
│  - ACP Protocol Bridge (Stdio transport / Intelligent Runner)    │
│  - Local Workspace Manager (projects/proyek-remotion-1)          │
│  - System Hardware Diagnostics (RAM, ARM64, Binaries)           │
│  - Remotion Render Runner (scripts/render-cli.mjs)              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Panduan Menjalankan

### A. Di Komputer / Laptop (Linux, macOS, Windows)

1. Pasang dependensi:
   ```bash
   npm install
   ```
2. Jalankan server:
   ```bash
   npm run dev
   ```
3. Buka browser pada:
   ```
   http://localhost:3000
   ```

---

### B. Di Android (Termux + proot Ubuntu ARM64)

#### Langkah 1: Setup di Aplikasi Termux
Buka Termux dan jalankan:
```bash
bash scripts/termux-install.sh
```
Atau langkah manual:
```bash
pkg update -y
pkg install -y proot-distro git curl pulseaudio
proot-distro install ubuntu
proot-distro login ubuntu
```

#### Langkah 2: Setup di Dalam Container Ubuntu ARM64
Setelah masuk ke Ubuntu proot:
```bash
# Jalankan script otomasi proot:
bash scripts/setup-proot.sh
```
Script ini akan memasang:
- Node.js 20 LTS & NPM
- FFmpeg
- Chromium Browser untuk ARM64 (`chromium-browser`)
- Library dependensi grafis headless (`libnss3`, `libgbm1`, dsb.)

#### Langkah 3: Menjalankan Males Ngonten Studio
```bash
npm run dev
```
Buka browser Android (Chrome/Firefox/Brave) di:
```
http://localhost:3000
```

> **Tips Android 12+ (Phantom Process Killer):**
> Jika render video tiba-tiba tertutup di background, jalankan perintah ini via ADB dari PC atau Termux (dengan Shizuku/root):
> ```bash
> adb shell "/system/bin/device_config put activity_manager max_phantom_processes 2147483647"
> ```

---

## 🧪 Pengujian & Verifikasi

Untuk memverifikasi integritas endpoint dan kontrak lokal:
```bash
node scripts/test-environment.js
```

Untuk menguji render video Remotion secara mandiri via CLI:
```bash
node scripts/render-cli.mjs --resolution 720p --fps 30 --out out/test-video.mp4
```

---

## 📄 Lisensi

Males Ngonten Studio didistribusikan di bawah lisensi open-source **MIT**. Bebas digunakan, dimodifikasi, dan dikembangkan secara mandiri.
