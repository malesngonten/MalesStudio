#!/usr/bin/env bash
# ==============================================================================
# Males Ngonten Studio - Quick Start & Self-Check Script
# ==============================================================================

PORT=${PORT:-3000}

echo "🐱 ========================================================="
echo "    MALES NGONTEN STUDIO - MEMULAI SERVER LOKAL"
echo "========================================================="
echo "Arsitektur CPU : $(uname -m)"
echo "Sistem Operasi : $(uname -s)"
echo "Node.js        : $(node -v 2>/dev/null || echo 'Belum terpasang')"
echo "FFmpeg         : $(ffmpeg -version 2>/dev/null | head -n 1 || echo 'Belum terpasang')"
echo "Chromium       : $(which chromium-browser 2>/dev/null || which chromium 2>/dev/null || echo 'Belum terpasang')"
echo "Port Target    : http://localhost:$PORT"
echo "========================================================="
echo ""

# Cek apakah port 3000 sedang dipakai
if command -v lsof >/dev/null 2>&1; then
    PID=$(lsof -ti :$PORT || true)
    if [ -n "$PID" ]; then
        echo "⚠️  Port $PORT sedang digunakan oleh proses $PID. Menghentikan proses lama..."
        kill -9 $PID 2>/dev/null || true
        sleep 1
    fi
fi

# Jalankan server
echo "🚀 Menjalankan dev server..."
npm run dev
