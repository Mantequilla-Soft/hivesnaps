const TRANSLATE_URL = process.env.EXPO_PUBLIC_LIBRETRANSLATE_URL ?? 'https://translate.snapie.io';
const TRANSLATE_KEY = process.env.EXPO_PUBLIC_LIBRETRANSLATE_KEY ?? '';
const REQUEST_TIMEOUT_MS = 10_000;

const detectCache = new Map<string, string>();
const translateCache = new Map<string, string>();

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  pt: 'Portuguese',
  de: 'German',
  it: 'Italian',
  nl: 'Dutch',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  ru: 'Russian',
};

export function getLanguageName(code: string): string {
  return LANG_NAMES[code] ?? code.toUpperCase();
}

// Short fingerprint so edits to the same permlink invalidate stale cache entries.
function textFingerprint(text: string): string {
  return `${text.length}:${text.slice(0, 16)}:${text.slice(-16)}`;
}

function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export async function detectLanguage(permlink: string, text: string): Promise<string | null> {
  const cacheKey = `${permlink}:${textFingerprint(text)}`;
  if (detectCache.has(cacheKey)) return detectCache.get(cacheKey)!;

  try {
    const res = await fetchWithTimeout(`${TRANSLATE_URL}/detect`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, api_key: TRANSLATE_KEY }),
    });

    if (!res.ok) return null;

    const data: Array<{ language: string; confidence: number }> = await res.json();
    const top = data[0]?.language ?? null;
    if (top) detectCache.set(cacheKey, top);
    return top;
  } catch {
    return null;
  }
}

async function doTranslateRequest(text: string, targetLang: string): Promise<string> {
  const res = await fetchWithTimeout(`${TRANSLATE_URL}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      q: text,
      source: 'auto',
      target: targetLang,
      api_key: TRANSLATE_KEY,
    }),
  });

  if (res.status === 429) throw Object.assign(new Error('Rate limited'), { code: 429 });
  if (res.status === 503) throw Object.assign(new Error('Translation service unavailable'), { code: 503 });
  if (!res.ok) throw new Error(`Translation error: ${res.status}`);

  const data = await res.json();
  return data.translatedText as string;
}

export async function translateText(permlink: string, text: string, targetLang: string): Promise<string> {
  const cacheKey = `${permlink}:${targetLang}:${textFingerprint(text)}`;
  if (translateCache.has(cacheKey)) return translateCache.get(cacheKey)!;

  let result: string;
  try {
    result = await doTranslateRequest(text, targetLang);
  } catch (err: unknown) {
    const code = typeof err === 'object' && err !== null && 'code' in err
      ? (err as { code: unknown }).code
      : undefined;
    if (code === 429) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      result = await doTranslateRequest(text, targetLang);
    } else {
      throw err;
    }
  }

  translateCache.set(cacheKey, result);
  return result;
}
