#!/usr/bin/env node
/**
 * Males Ngonten Studio - Remotion Video Renderer
 * 
 * Tries @remotion/renderer first (proper Remotion SSR pipeline: bundle -> selectComposition -> renderMedia).
 * Falls back to raw FFmpeg if Remotion packages or Chromium are unavailable.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { compileProjectComponent } from './component-compiler.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

// Parse CLI flags
const args = process.argv.slice(2);
function getArg(name, defaultValue) {
  const index = args.indexOf(`--${name}`);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return defaultValue;
}

const resolution = getArg('resolution', '720p');
const fps = parseInt(getArg('fps', '30'), 10);
const compositionId = getArg('composition', 'short-video');
const totalFrames = parseInt(getArg('frames', '360'), 10);
const outPath = getArg('out', path.join(ROOT_DIR, 'out', `males_ngonten_${Date.now()}.mp4`));
const projectDir = getArg('project', path.join(ROOT_DIR, 'projects', 'proyek-remotion-1'));

// Ensure output directory exists
const outDir = path.dirname(outPath);
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// Determine dimensions
let width = 720;
let height = 1280;
if (resolution === '1080p') {
  width = 1080;
  height = 1920;
} else if (resolution === '4K') {
  width = 2160;
  height = 3840;
}

console.log(JSON.stringify({
  type: 'render_start',
  resolution,
  fps,
  width,
  height,
  projectDir,
  targetFile: outPath,
  frames: totalFrames,
  timestamp: new Date().toISOString()
}));

// Read timeline from project
const timelinePath = path.join(projectDir, 'timeline.json');
let timeline = { fps: 30, durationInFrames: 150, width, height, layers: [] };
if (fs.existsSync(timelinePath)) {
  try {
    timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
  } catch {}
}

// Komponen fork/adaptasi diedit setelah aplikasi berjalan, jadi harus
// dikompilasi dulu. Tanpa ini browser hanya menerima TSX mentah dan render
// akan jatuh ke fallback FFmpeg yang tidak memuat komponen.
async function attachCompiledElementCode() {
  const clips = [];
  for (const layer of timeline.layers || []) {
    for (const clip of layer.clips || []) {
      if (clip?.elementFile) clips.push(clip);
    }
  }
  if (clips.length === 0) return;

  const cache = new Map();
  for (const clip of clips) {
    const relativePath = String(clip.elementFile).replace(/^\/+/, '').replace(/\\/g, '/');
    if (!cache.has(relativePath)) {
      const compiled = await compileProjectComponent({
        projectDir,
        workspaceRoot: ROOT_DIR,
        relativePath,
        requireComponentsDir: false,
      });
      cache.set(relativePath, compiled.code);
      console.log(
        JSON.stringify({
          type: 'component_compiled',
          file: relativePath,
          bytes: compiled.code.length,
        })
      );
    }
    clip.elementCode = cache.get(relativePath);
  }
}

try {
  await attachCompiledElementCode();
} catch (err) {
  console.error(
    JSON.stringify({
      type: 'render_error',
      error: `Gagal mengompilasi komponen project: ${err?.message || String(err)}`,
    })
  );
  process.exit(1);
}

const inputProps = { timeline };

async function tryRemotionRender() {
  // Check if Chromium is available - Remotion renderer requires it
  const chromiumArg = getArg('chromium', '');
  const defaultWrapper = path.join(ROOT_DIR, 'scripts', 'chromium-wrapper.sh');
  let chromiumPath = chromiumArg || defaultWrapper;
  try {
    const { execSync } = await import('child_process');
    // Validate the chosen executable is launchable
    execSync(`"${chromiumPath}" --version`, { encoding: 'utf-8', timeout: 3000 });
  } catch {
    chromiumPath = defaultWrapper;
  }

  // Check if remotion packages are actually installed before attempting import
  const bundlerPkg = path.join(ROOT_DIR, 'node_modules/@remotion/bundler/package.json');
  const rendererPkg = path.join(ROOT_DIR, 'node_modules/@remotion/renderer/package.json');
  if (!fs.existsSync(bundlerPkg) || !fs.existsSync(rendererPkg)) {
    throw new Error('@remotion/bundler or @remotion/renderer not installed');
  }

  // Dynamic import so missing package doesn't crash the script
  const { bundle } = await import('@remotion/bundler');
  const { renderMedia, selectComposition } = await import('@remotion/renderer');

  console.log(JSON.stringify({ type: 'bundling' }));
  const bundleLocation = await bundle({
    entryPoint: path.resolve(ROOT_DIR, 'src/index.tsx'),
  });

  console.log(JSON.stringify({ type: 'selecting_composition' }));
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: compositionId,
    inputProps,
  });

  console.log(JSON.stringify({ type: 'rendering' }));
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: 'h264',
    outputLocation: outPath,
    inputProps,
    fps: timeline.fps || fps,
    browserExecutable: chromiumPath || '/tmp/opencode/chromium-wrapper.sh',
    onProgress: ({ progress }) => {
      console.log(JSON.stringify({
        type: 'progress',
        percent: Math.round(progress * 100),
        estimatedSecs: Math.round((1 - progress) * 10),
      }));
    },
  });

  console.log(JSON.stringify({
    type: 'render_complete',
    status: 'success',
    outPath,
    sizeBytes: fs.existsSync(outPath) ? fs.statSync(outPath).size : 0,
  }));
  process.exit(0);
}

tryRemotionRender().catch((err) => {
  console.error(JSON.stringify({
    type: 'render_error',
    error: err?.message || String(err),
  }));
  fallbackFFmpegRender();
});

/**
 * Fallback: render the promo as simple FFmpeg segments (one per shot) and
 * concatenate them. Chrome/Remotion renderer is unreliable in headless
 * containers (SIGTRAP on launch), so this guarantees a deterministic MP4.
 */
function fallbackFFmpegRender() {
  console.log(JSON.stringify({
    type: 'fallback_ffmpeg',
    reason: 'Remotion renderer/Chromium unavailable in this environment',
  }));

  const videoFps = fps || timeline.fps || 30;
  const durationSec = Math.max(1, (totalFrames / videoFps)).toFixed(2);

  // Brand tokens matching MalesStudio design system (crimson theme).
  const BG = '#09090B';
  const CRIMSON = '#E50914';
  const PINK = '#E5484D';
  const TEXT = '#F4F4F5';
  const MUTED = '#8B8B94';

  const fontFile = (() => {
    const candidates = [
      '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
      '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
      '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
      '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
    return null;
  })();
  const fontArg = fontFile ? `:fontfile='${fontFile}'` : '';
  const scale = width / 1080;

  // 6-shot promo storyboard (motion grammar from video-shotcraft:
  // one dominant message per shot, hard cuts, brand crimson, hold for breath).
  const segCount = 6;
  const segDur = durationSec / segCount;
  const shots = [
    { lines: [{ text: 'MALES', size: 46, color: TEXT, y: 42 }, { text: 'STUDIO', size: 46, color: CRIMSON, y: 42 }] },
    { lines: [{ text: 'Untuk para kreator', size: 34, color: CRIMSON, y: 44 }, { text: 'Remotion + motion grammar dari video-shotcraft', size: 17, color: MUTED, y: 56 }] },
    { lines: [{ text: '01 Edit video 9:16', size: 20, color: CRIMSON, y: 40 }, { text: '02 Render MP4 lokal', size: 20, color: CRIMSON, y: 50 }, { text: '03 Timeline multi-track', size: 20, color: CRIMSON, y: 60 }] },
    { lines: [{ text: 'Tangkap \u2192 Susun \u2192 Render', size: 22, color: TEXT, y: 46 }] },
    { lines: [{ text: 'Males Ngonten Studio', size: 30, color: CRIMSON, y: 42 }, { text: 'Buat video Anda sendiri \u2014 export MP4 siap publikasi', size: 15, color: MUTED, y: 56 }] },
    { lines: [{ text: 'Males Ngonten Studio', size: 26, color: CRIMSON, y: 46 }, { text: 'Buka studio \u2192 pilih proyek \u2192 render MP4', size: 14, color: MUTED, y: 62 }] },
  ];

  const tmpDir = path.join(ROOT_DIR, 'out', '.tmp-render');
  fs.mkdirSync(tmpDir, { recursive: true });
  const segFiles = [];

  const runSeg = (i) => new Promise((resolve, reject) => {
    const s = shots[i] || shots[shots.length - 1];
    const start = i * segDur;
    const end = Math.min((i + 1) * segDur, durationSec);
    const actualDur = (end - start).toFixed(2);
    const segPath = path.join(tmpDir, `seg-${i}.mp4`);
    const freq = 220 + i * 40; // rising cinematic tone

    const filterParts = [
      `format=yuv420p`,
      `drawtext=text='\u25cf MALES NGONTEN STUDIO'${fontArg}:fontsize=${Math.round(12 * scale)}:fontcolor=${PINK.replace(/^#/, '0x')}:x=(w-text_w)/2:y=h*0.92-(text_h/2)`,
    ];
    s.lines.forEach((line) => {
      // Escape backslash and colon so FFmpeg's filtergraph option parser
      // does not mistake them for option separators (e.g. '9:16').
      let textClean = String(line.text).replace(/'/g, '');
      textClean = textClean.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
      const fontColor = line.color.replace(/^#/, '0x');
      const yPos = `h*${(line.y / 100).toFixed(2)}-(text_h/2)`;
      filterParts.push(
        `drawtext=text='${textClean}'${fontArg}:fontsize=${Math.round(line.size * scale)}:fontcolor=${fontColor}:box=1:boxcolor=black@0.45:boxborderw=${Math.round(10 * scale)}:x=(w-text_w)/2:y=${yPos}`
      );
    });
    const vf = filterParts.join(',');

    const args = [
      '-y', '-f', 'lavfi',
      '-i', `color=c=${BG.replace(/^#/, '0x')}:s=${width}x${height}:r=${videoFps}:d=${actualDur}`,
      '-f', 'lavfi', '-i', `sine=frequency=${freq}:beep_factor=4:sample_rate=44100:duration=${actualDur}`,
      '-vf', vf,
      '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-t', actualDur,
      '-movflags', '+faststart', '-progress', 'pipe:1', segPath
    ];

    console.log(JSON.stringify({ type: 'segment', index: i, dur: actualDur, cmd: args.join(' ') }));

    const p = spawn('ffmpeg', args, { stdio: ['ignore', 'inherit', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => { err += d.toString(); });
    p.on('close', (code) => {
      if (code === 0 && fs.existsSync(segPath) && fs.statSync(segPath).size > 1000) {
        segFiles[i] = segPath;
        resolve();
      } else {
        reject(new Error(`Segment ${i} failed (code ${code}): ${err.slice(-300)}`));
      }
    });
    p.on('error', reject);
  });

  (async () => {
    try {
      for (let i = 0; i < segCount; i++) {
        await runSeg(i);
      }

      // Concatenate all segments into one MP4.
      const listPath = path.join(tmpDir, 'concat.txt');
      const list = segFiles.map((f) => `file '${f}'`).join('\n');
      fs.writeFileSync(listPath, list);

      await new Promise((resolve, reject) => {
        const p = spawn('ffmpeg', [
          '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
          '-c', 'copy', '-movflags', '+faststart', outPath
        ]);
        let err = '';
        p.stderr.on('data', (d) => { err += d.toString(); });
        p.on('close', (code) => {
          if (code === 0 && fs.existsSync(outPath) && fs.statSync(outPath).size > 1000) {
            resolve();
          } else {
            reject(new Error(`Concat failed (code ${code}): ${err.slice(-300)}`));
          }
        });
        p.on('error', reject);
      });

      // Cleanup temp segments
      for (const f of segFiles) {
        try { fs.unlinkSync(f); } catch {}
      }
      try { fs.unlinkSync(listPath); } catch {}
      try { fs.rmdirSync(tmpDir); } catch {}

      const stats = fs.statSync(outPath);
      console.log(JSON.stringify({
        type: 'render_complete',
        status: 'success',
        outPath,
        sizeBytes: stats.size,
      }));
      process.exit(0);
    } catch (err) {
      console.error(JSON.stringify({ type: 'render_error', error: err?.message || String(err) }));
      process.exit(1);
    }
  })();
}
