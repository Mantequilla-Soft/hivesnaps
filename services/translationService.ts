const TRANSLATE_URL = process.env.EXPO_PUBLIC_LIBRETRANSLATE_URL ?? 'https://translate.snapie.io';
const TRANSLATE_KEY = process.env.EXPO_PUBLIC_LIBRETRANSLATE_KEY ?? '';

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

export async function detectLanguage(permlink: string, text: string): Promise<string | null> {
  if (detectCache.has(permlink)) return detectCache.get(permlink)!;

  const res = await fetch(`${TRANSLATE_URL}/detect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ q: text, api_key: TRANSLATE_KEY }),
  });

  if (!res.ok) return null;

  const data: Array<{ language: string; confidence: number }> = await res.json();
  const top = data[0]?.language ?? null;
  if (top) detectCache.set(permlink, top);
  return top;
}

async function doTranslateRequest(text: string, targetLang: string): Promise<string> {
  const res = await fetch(`${TRANSLATE_URL}/translate`, {
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
  const cacheKey = `${permlink}:${targetLang}`;
  if (translateCache.has(cacheKey)) return translateCache.get(cacheKey)!;

  let result: string;
  try {
    result = await doTranslateRequest(text, targetLang);
  } catch (err: any) {
    if (err.code === 429) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      result = await doTranslateRequest(text, targetLang);
    } else {
      throw err;
    }
  }

  translateCache.set(cacheKey, result);
  return result;
}
