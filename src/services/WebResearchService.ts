/**
 * Web Research Service
 * Integrasi search engine Tavily (primary) & SearXNG (alternatif open-source).
 * Digunakan AI agent untuk mencari, membaca, dan menganalisis informasi dari internet
 * selama proses pembuatan video berbasis Remotion.
 *
 * Semua operasi berjalan di backend. API Key disimpan di .env, terpisah dari API Key model AI.
 */

import type { WebResearchResult, WebSearchOptions } from '../types';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const TAVILY_EXTRACT_URL = 'https://api.tavily.com/extract';
const SEARXNG_URL = process.env.SEARXNG_URL || '';

/**
 * Hasil pencarian web terstruktur yang dikembalikan ke AI sebagai tool result.
 */
export interface WebSearchHit {
  url: string;
  title: string;
  content: string;
  score?: number;
  publishedDate?: string;
  source: 'tavily' | 'searxng';
}

export interface WebPageContent {
  url: string;
  title: string;
  content: string;
  source: 'tavily' | 'fetch' | 'searxng';
}

/**
 * Cari informasi di internet menggunakan Tavily (primary) atau SearXNG (fallback).
 */
export async function webSearch(
  query: string,
  options: WebSearchOptions = {}
): Promise<{ results: WebSearchHit[]; error?: string }> {
  const maxResults = options.maxResults ?? 5;
  const searchDepth = options.searchDepth ?? 'basic';

  // --- 1. Coba Tavily (primary) ---
  if (TAVILY_API_KEY) {
    try {
      const res = await fetch(TAVILY_SEARCH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query,
          search_depth: searchDepth,
          max_results: maxResults,
          include_answer: true,
          include_raw_content: false,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const data = await res.json();
        const results: WebSearchHit[] = (data.results || []).map((r: any) => ({
          url: r.url,
          title: r.title || '',
          content: r.content || '',
          score: r.score,
          publishedDate: r.published_date,
          source: 'tavily',
        }));
        return { results };
      }
    } catch (err: any) {
      console.warn('[WebResearch] Tavily gagal, coba SearXNG:', err?.message);
    }
  }

  // --- 2. Fallback ke SearXNG (open-source) ---
  if (SEARXNG_URL) {
    try {
      const searchUrl = new URL(SEARXNG_URL.endsWith('/') ? SEARXNG_URL.slice(0, -1) : SEARXNG_URL);
      searchUrl.pathname = searchUrl.pathname.replace(/\/+$/, '') + '/search';
      searchUrl.searchParams.set('q', query);
      searchUrl.searchParams.set('format', 'json');
      searchUrl.searchParams.set('language', 'id');
      searchUrl.searchParams.set('safesearch', '0');

      const res = await fetch(searchUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; MalesNgontenStudio/1.0)',
        },
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const data = await res.json();
        const results: WebSearchHit[] = (data.results || [])
          .slice(0, maxResults)
          .map((r: any) => ({
            url: r.url,
            title: r.title || '',
            content: r.content || '',
            score: r.score,
            publishedDate: r.published_date,
            source: 'searxng',
          }));
        return { results };
      }
    } catch (err: any) {
      console.warn('[WebResearch] SearXNG gagal:', err?.message);
    }
  }

  return {
    results: [],
    error: 'Tidak ada provider pencarian yang tersedia. Konfigurasikan TAVILY_API_KEY atau SEARXNG_URL di .env',
  };
}

/**
 * Baca dan ekstrak konten halaman web berdasarkan URL.
 * Gunakan Tavily extract jika tersedia, fallback ke native fetch + ekstraksi teks sederhana.
 */
export async function webRead(url: string): Promise<{ content: WebPageContent; error?: string }> {
  // --- 1. Coba Tavily extract ---
  if (TAVILY_API_KEY) {
    try {
      const res = await fetch(TAVILY_EXTRACT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          urls: [url],
          include_images: false,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const data = await res.json();
        const result = (data.results || [])[0];
        if (result && result.raw_content) {
          return {
            content: {
              url: result.url || url,
              title: result.title || url,
              content: result.raw_content,
              source: 'tavily',
            },
          };
        }
      }
    } catch (err: any) {
      console.warn('[WebResearch] Tavily extract gagal, coba fetch langsung:', err?.message);
    }
  }

  // --- 2. Fallback: native fetch + ekstraksi teks sederhana ---
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MalesNgontenStudio/1.0; +https://malesngonten.studio)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return { content: { url, title: url, content: '', source: 'fetch' }, error: `HTTP ${res.status}` };
    }

    const html = await res.text();
    const title = extractTitle(html);
    const textContent = extractTextFromHtml(html);

    return {
      content: {
        url,
        title,
        content: textContent,
        source: 'fetch',
      },
    };
  } catch (err: any) {
    return {
      content: { url, title: url, content: '', source: 'fetch' },
      error: err?.message || 'Gagal membuka halaman web',
    };
  }
}

/**
 * Ekstrak judul dari HTML (sederhana, tanpa dependensi eksternal).
 */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

/**
 * Ekstrak teks terbaca dari HTML (menghapus tag, skrip, style, css, js).
 * Sederhana tetapi cukup untuk kebutuhan riset AI.
 */
function extractTextFromHtml(html: string): string {
  let text = html
    // Hapus skrip dan style
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // Hapus komentar HTML
    .replace(/<!--[\s\S]*?-->/gi, ' ')
    // Ganti tag blok dengan spasi/baris baru
    .replace(/<\/ (p|div|h[1-6]|li|tr|section|article|main|footer|header|nav|aside|blockquote|pre|hr|br)>/gi, '\n')
    .replace(/< (p|div|h[1-6]|li|tr|section|article|main|footer|header|nav|aside|blockquote|pre)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Hapus semua tag HTML tersisa
    .replace(/<[^>]+>/g, ' ')
    // Decode entitas HTML umum
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    // Kolaps whitespace berlebih
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Batasi panjang agar tidak membebani prompt AI (maksimal ~12.000 karakter)
  if (text.length > 12000) {
    text = text.slice(0, 12000) + '\n\n... (konten dipotong)';
  }

  return text;
}

/**
 * Gabungkan hasil pencarian menjadi konteks teks yang mudah dibaca AI,
 * lengkap dengan URL dan referensi sumber.
 */
export function formatSearchContext(results: WebSearchHit[]): string {
  if (!results || results.length === 0) {
    return 'Tidak ada hasil pencarian yang ditemukan.';
  }

  const lines: string[] = [];
  results.forEach((r, i) => {
    lines.push(
      `[${i + 1}] ${r.title}\nURL: ${r.url}\nRingkasan: ${r.content}\n`
    );
  });
  return lines.join('\n---\n');
}

/**
 * Gabungkan konten halaman web yang telah dibaca menjadi konteks teks.
 */
export function formatPageContent(page: WebPageContent): string {
  return `Sumber: ${page.title}\nURL: ${page.url}\n\n${page.content}`;
}
