#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Males Ngonten Studio - Termux Host Setup Script
# Target: Android Termux (Host environment)
# ==============================================================================

set -e

echo "🐱 ========================================================="
echo "    MALES NGONTEN STUDIO - SETUP ANDROID TERMUX"
echo "========================================================="
echo ""

# 1. Pastikan repo Termux terbaru
echo "[1/4] Memperbarui package repository Termux..."
pkg update -y && pkg upgrade -y

# 2. Install proot-distro dan curl/git
echo "[2/4] Menginstal proot-distro, git, dan pulseaudio..."
pkg install -y proot-distro git curl pulseaudio

# 3. Install Ubuntu container melalui proot-distro
echo "[3/4] Mempersiapkan lingkungan proot Ubuntu ARM64..."
if proot-distro list | grep -q "ubuntu (installed)"; then
    echo "  -> Container Ubuntu sudah terpasang."
else
    echo "  -> Mengunduh dan menginstal container Ubuntu..."
    proot-distro install ubuntu
fi

# 4. Berikan instruksi masuk ke container dan jalankan setup-proot
echo "[4/4] Selesai!"
echo ""
echo "========================================================="
echo "LANGKAH BERIKUTNYA:"
echo "1. Masuk ke Ubuntu proot:"
echo "   proot-distro login ubuntu"
echo ""
echo "2. Di dalam proot Ubuntu, jalankan:"
echo "   curl -sSL https://raw.githubusercontent.com/males-ngonten/studio/main/scripts/setup-proot.sh | bash"
echo "   atau jalankan file ./scripts/setup-proot.sh jika sudah di-clone."
echo "========================================================="
