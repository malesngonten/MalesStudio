#!/usr/bin/env bash
# ==============================================================================
# Males Ngonten Studio - proot Ubuntu ARM64 Environment Setup
# Target: Ubuntu inside proot-distro (Android ARM64)
# ==============================================================================

set -e

echo "🐱 ========================================================="
echo "    MALES NGONTEN STUDIO - PROOT UBUNTU ARM64 SETUP"
echo "========================================================="
echo ""

# 1. Update Ubuntu APT
echo "[1/6] Memperbarui package repository Ubuntu..."
apt update -y && apt upgrade -y

# 2. Install dependensi sistem dasar: curl, git, build-essential, ca-certificates
echo "[2/6] Menginstal curl, git, python3, build-essential..."
apt install -y curl git python3 make g++ ca-certificates xz-utils

# 3. Install Node.js 20+ LTS via NodeSource
echo "[3/6] Memasang Node.js 20 LTS..."
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -d'.' -f1 | tr -d 'v')" -lt 20 ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "  -> Node.js version: $(node -v)"
echo "  -> NPM version: $(npm -v)"

# 4. Install FFmpeg untuk rendering video
echo "[4/6] Menginstal FFmpeg..."
apt install -y ffmpeg
echo "  -> FFmpeg version: $(ffmpeg -version | head -n 1)"

# 5. Install Chromium Browser & library headless (diperlukan Remotion di ARM64)
echo "[5/6] Menginstal Chromium & library headless ARM64..."
apt install -y chromium-browser \
    libnss3 \
    libatk-bridge2.0-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libasound2 \
    fonts-liberation \
    libappindicator3-1 \
    libxtst6 || true

# Export chromium path for Puppeteer / Remotion
export PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser || which chromium || echo "/usr/bin/chromium-browser")
echo "  -> PUPPETEER_EXECUTABLE_PATH set to: $PUPPETEER_EXECUTABLE_PATH"

# Simpan environment variable secara permanen di /etc/environment atau ~/.bashrc
if ! grep -q "PUPPETEER_EXECUTABLE_PATH" ~/.bashrc; then
    echo "export PUPPETEER_EXECUTABLE_PATH=$PUPPETEER_EXECUTABLE_PATH" >> ~/.bashrc
    echo "export PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true" >> ~/.bashrc
fi

# 6. Install dependensi NPM project jika di direktori repo
if [ -f "package.json" ]; then
    echo "[6/6] Menginstal dependensi NPM Males Ngonten Studio..."
    npm install
else
    echo "[6/6] File package.json belum ditemukan di folder ini."
    echo "      Silakan clone repo lalu jalankan 'npm install'."
fi

echo ""
echo "========================================================="
echo "✅ SETUP PROOT UBUNTU ARM64 SELESAI!"
echo "Untuk menjalankan Males Ngonten Studio:"
echo "  npm run dev"
echo "Lalu buka browser di HP Anda pada http://localhost:3000"
echo "========================================================="
