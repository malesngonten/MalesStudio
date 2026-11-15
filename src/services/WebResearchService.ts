/**
 * Web Research Service
 * Integrasi search engine:
 *  - Tavily (primary, butuh API key)
 *  - DuckDuckGo HTML (gratis, tanpa API key)
 *  - Bing HTML (gratis, tanpa API key)
 *  - SearXNG (alternatif open-source self-hosted, butuh URL)
 *
 * Semua operasi berjalan di backend. API Key disimpan di .env, terpisah dari API Key model AI.
 */

import type { WebResearchResult, WebSearchHit, WebPageContent, WebSearchOptions } from '../types';

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '';
const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const TAVILY_EXTRACT_URL = 'https://api.tavily.com/extract';
const SEARXNG_URL = process.env.SEARXNG_URL || '';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const JINA_READER_URL = 'https://r.jina.ai/';

/**
 * Cari informasi di internet.
 * Urutan prioritas:
 *  1. Tavily (jika TAVILY_API_KEY tersedia)
 *  2. DuckDuckGo HTML (gratis, tanpa API key)
 *  3. Bing HTML (gratis, tanpa API key)
 *  4. SearXNG (jika SEARXNG_URL tersedia)
 */
export async function webSearch(
  query: string,
  options: WebSearchOptions = {}
): Promise<{ results: WebSearchHit[]; error?: string }> {
  const maxResults = options.maxResults ?? 5;
  const searchDepth = options.searchDepth ?? 'basic';

  // --- 1. Tavily (primary, butuh API key) ---
  if (TAVILY_API_KEY) {
    try {
      const res = await fetch(TAVILY_SEARCH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      console.warn('[WebResearch] Tavily gagal, coba DuckDuckGo:', err?.message);
    }
  }

  // --- 2. DuckDuckGo HTML (gratis, tanpa API key) ---
  try {
    const ddg = await webSearchDuckDuckGo(query, maxResults);
    if (ddg.results.length > 0) return ddg;
  } catch (err: any) {
    console.warn('[WebResearch] DuckDuckGo gagal, coba Bing:', err?.message);
  }

  // --- 3. Bing HTML (gratis, tanpa API key) ---
  try {
    const bing = await webSearchBing(query, maxResults);
    if (bing.results.length > 0) return bing;
  } catch (err: any) {
    console.warn('[WebResearch] Bing gagal, coba SearXNG:', err?.message);
  }

  // --- 4. SearXNG (open-source, butuh URL) ---
  if (SEARXNG_URL) {
    try {
      const sx = await webSearchSearXng(query, maxResults);
      if (sx.results.length > 0) return sx;
    } catch (err: any) {
      console.warn('[WebResearch] SearXNG gagal:', err?.message);
    }
  }

  return {
    results: [],
    error: 'Tidak ada provider pencarian yang tersedia. Atur TAVILY_API_KEY di .env, atau gunakan DuckDuckGo/Bing (tanpa API key, otomatis dicoba).',
  };
}

/* ------------------------------------------------------------------ */
/* DuckDuckGo HTML scraping                                           */
/* ------------------------------------------------------------------ */

async function webSearchDuckDuckGo(
  query: string,
  maxResults: number
): Promise<{ results: WebSearchHit[]; error?: string }> {
  const url = 'https://html.duckduckgo.com/html/';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
    },
    body: `q=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    return { results: [], error: `DuckDuckGo HTTP ${res.status}` };
  }
  const html = await res.text();
  const results: WebSearchHit[] = [];

  // Tangkap blok hasil: <a class="result__a" href="..." rel="nofollow">Title</a>
  // dan cuplikan: <a class="result__snippet">...</a>
  const resultRegex =
    /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = resultRegex.exec(html)) !== null && results.length < maxResults) {
    let href = match[1];
    const title = stripTags(match[2]).trim();
    const snippet = stripTags(match[3]).trim();

    // DuckDuckGo pakai redirect URL (uddg=...)
    if (href.startsWith('/l/?kh=-1&uddg=')) {
      try {
        href = decodeURIComponent(new URL(href, 'https://duckduckgo.com').searchParams.get('uddg') || href);
      } catch {}
    }

    if (title && href) {
      results.push({
        url: href,
        title,
        content: snippet,
        source: 'duckduckgo',
      });
    }
  }
  return { results };
}

/* ------------------------------------------------------------------ */
/* Bing HTML scraping                                                 */
/* ------------------------------------------------------------------ */

async function webSearchBing(
  query: string,
  maxResults: number
): Promise<{ results: WebSearchHit[]; error?: string }> {
  const url = 'https://www.bing.com/search';
  const res = await fetch(`${url}?q=${encodeURIComponent(query)}&count=${maxResults}&setlang=id-ID`, {
    headers: {
      'User-Agent': UA,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    return { results: [], error: `Bing HTTP ${res.status}` };
  }
  const html = await res.text();
  const results: WebSearchHit[] = [];

  // Setiap hasil Bing berada di <li class="b_algo">...</li>
  const algoRegex = /<li class="b_algo"[\s\S]*?<\/li>/gi;
  let match;
  while ((match = algoRegex.exec(html)) !== null && results.length < maxResults) {
    const block = match[0];

    // Judul + URL
    const aMatch = block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
    const url = aMatch ? aMatch[1] : '';
    const title = aMatch ? stripTags(aMatch[2]).trim() : '';

    // Cuplikan
    const snippetMatch = block.match(
      /<p[^>]*>([\s\S]*?)<\/p>/i
    );
    const snippet = snippetMatch ? stripTags(snippetMatch[1]).trim() : '';

    if (title && url) {
      results.push({
        url,
        title,
        content: snippet,
        source: 'bing',
      });
    }
  }
  return { results };
}

/* ------------------------------------------------------------------ */
/* SearXNG (open-source, butuh URL)                                   */
/* ------------------------------------------------------------------ */

async function webSearchSearXng(
  query: string,
  maxResults: number
): Promise<{ results: WebSearchHit[]; error?: string }> {
  const base = SEARXNG_URL.endsWith('/') ? SEARXNG_URL.slice(0, -1) : SEARXNG_URL;
  const searchUrl = new URL(base.replace(/\/+$/, '') + '/search');
  searchUrl.searchParams.set('q', query);
  searchUrl.searchParams.set('format', 'json');
  searchUrl.searchParams.set('language', 'id');
  searchUrl.searchParams.set('safesearch', '0');

  const res = await fetch(searchUrl.toString(), {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    return { results: [], error: `SearXNG HTTP ${res.status}` };
  }
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

/* ------------------------------------------------------------------ */
/* Web Read                                                           */
/* ------------------------------------------------------------------ */

export async function webRead(url: string): Promise<{ content: WebPageContent; error?: string }> {
  // --- 1. Jina AI Reader (gratis, tanpa API key, works great) ---
  try {
    const jinaUrl = JINA_READER_URL + url;
    console.log('[WebResearch] Trying Jina Reader:', jinaUrl);
    const res = await fetch(jinaUrl, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/markdown, text/plain, */*',
      },
      signal: AbortSignal.timeout(45000),
    });
    console.log('[WebResearch] Jina Reader response:', res.status, res.statusText);
    if (res.ok) {
      const markdown = await res.text();
      console.log('[WebResearch] Jina Reader content length:', markdown.length);
      if (markdown && markdown.trim().length > 50) {
        const title = extractTitleFromJina(markdown) || url;
        return {
          content: {
            url,
            title,
            content: markdown,
            source: 'jina-reader',
          },
        };
      }
    }
  } catch (err: any) {
    console.error('[WebResearch] Jina Reader ERROR:', err?.message);
    console.warn('[WebResearch] Jina Reader gagal, coba Tavily:', err?.message);
  }

  // --- 2. Tavily extract (jika API key tersedia) ---
  if (TAVILY_API_KEY) {
    try {
      const res = await fetch(TAVILY_EXTRACT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

  // --- 3. Native fetch + ekstraksi teks ---
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      return {
        content: { url, title: url, content: '', source: 'fetch' },
        error: `HTTP ${res.status}`,
      };
    }
    const html = await res.text();
    const title = extractTitle(html);
    const textContent = extractTextFromHtml(html);
    return {
      content: { url, title, content: textContent, source: 'fetch' },
    };
  } catch (err: any) {
    return {
      content: { url, title: url, content: '', source: 'fetch' },
      error: err?.message || 'Gagal membuka halaman web',
    };
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function stripTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? match[1].trim() : '';
}

function extractTitleFromJina(markdown: string): string {
  // Jina AI Reader returns markdown; first non-empty line often is the title (# Title)
  const firstLine = markdown.trim().split('\n')[0];
  if (firstLine) {
    return firstLine.replace(/^#+\s*/, '').trim();
  }
  return '';
}

function extractTextFromHtml(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/gi, ' ')
    .replace(/<\/ (p|div|h[1-6]|li|tr|section|article|main|footer|header|nav|aside|blockquote|pre|hr|br)>/gi, '\n')
    .replace(/< (p|div|h[1-6]|li|tr|section|article|main|footer|header|nav|aside|blockquote|pre)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (text.length > 12000) {
    text = text.slice(0, 12000) + '\n\n... (konten dipotong)';
  }
  return text;
}

export function formatSearchContext(results: WebSearchHit[]): string {
  if (!results || results.length === 0) {
    return 'Tidak ada hasil pencarian yang ditemukan.';
  }
  const lines: string[] = [];
  results.forEach((r, i) => {
    lines.push(`[${i + 1}] ${r.title}\nURL: ${r.url}\nRingkasan: ${r.content}\n`);
  });
  return lines.join('\n---\n');
}

export function formatPageContent(page: WebPageContent): string {
  return `Sumber: ${page.title}\nURL: ${page.url}\n\n${page.content}`;
}
