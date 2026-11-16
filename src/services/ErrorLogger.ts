/**
 * ErrorLogger — mencatat semua error aplikasi ke file JSON
 * agar tidak perlu user melaporkan error secara manual saat testing.
 *
 * - Simpan ke `.males_ngonten/error-log.json` di project aktif
 * - Batasi jumlah entri (rolling buffer) agar file tidak besar
 * - Setiap entri punya timestamp, source, message, stack, dan konteks opsional
 */
import fs from 'fs';
import path from 'path';

const MAX_ENTRIES = 200;

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export class ErrorLogger {
  private logPath: string;
  private entries: Array<{ time: string; source: string; message: string; stack?: string; context?: any }> = [];
  private loaded = false;

  constructor(projectDir: string) {
    ensureDir(path.join(projectDir, '.males_ngonten'));
    this.logPath = path.join(projectDir, '.males_ngonten', 'error-log.json');
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.logPath)) {
        const raw = fs.readFileSync(this.logPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.entries = parsed.slice(-MAX_ENTRIES);
        }
      }
    } catch {}
    this.loaded = true;
  }

  private save() {
    try {
      fs.writeFileSync(this.logPath, JSON.stringify(this.entries, null, 2), 'utf-8');
    } catch {}
  }

  /**
   * Catat error. source boleh 'backend', 'frontend', 'render', 'component', 'tool'.
   */
  log(source: string, message: string, stack?: string, context?: any) {
    const entry = {
      time: new Date().toISOString(),
      source,
      message: String(message),
      stack: stack ? String(stack) : undefined,
      context: context || undefined,
    };
    this.entries.push(entry);
    if (this.entries.length > MAX_ENTRIES) {
      this.entries = this.entries.slice(-MAX_ENTRIES);
    }
    this.save();
    console.error(`[ERROR][${source}] ${message}`, stack ? `\n${stack}` : '', context ? JSON.stringify(context) : '');
  }

  getEntries() {
    return [...this.entries].reverse(); // terbaru dulu
  }

  clear() {
    this.entries = [];
    this.save();
  }
}
