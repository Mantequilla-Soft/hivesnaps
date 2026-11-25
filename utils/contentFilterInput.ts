import { normalizeApp, normalizeTag, type MuteRule } from '@snapie/content-filter';

export type ParsedRuleInput = { rule: MuteRule } | { error: string };

const APP_PREFIX = /^app\s*:\s*/i;
/** A tag is one word: no spaces, commas or another '#'. */
const BAD_TAG = /[\s,#]/;

function parseTag(raw: string): { tag: string } | { error: string } {
  const tag = normalizeTag(raw);
  if (!tag) return { error: 'Type a #tag or app:name.' };
  if (BAD_TAG.test(tag)) return { error: 'One tag at a time, without spaces or commas.' };
  return { tag };
}

/**
 * Turns what the user typed into a rule:
 * - `#tag` or `tag` → hide that tag
 * - `app:name` → hide everything posted from that app
 * - `app:name #tag` → hide that app's posts with that tag
 */
export function parseRuleInput(raw: string): ParsedRuleInput {
  const text = raw.trim();
  if (!text) return { error: 'Type a #tag or app:name.' };

  if (APP_PREFIX.test(text)) {
    const rest = text.replace(APP_PREFIX, '');
    const hashAt = rest.indexOf('#');
    const appPart = hashAt === -1 ? rest : rest.slice(0, hashAt);
    const app = normalizeApp(appPart);
    if (!app) return { error: 'Add the app name after app:, like app:hiveword.' };
    if (hashAt === -1) {
      // "app:hivesuite scratchcard" almost always means a forgotten '#'.
      // (Apps whose name has spaces can still be hidden with "Hide posts
      // like this" on one of their posts.)
      if (/\s/.test(app)) {
        return { error: 'Put # before the tag, like app:hivesuite #scratchcard.' };
      }
      return { rule: { kind: 'app', app } };
    }
    const parsed = parseTag(rest.slice(hashAt));
    if ('error' in parsed) {
      return {
        error: parsed.error.startsWith('Type')
          ? 'Add a tag after #, like app:hivesuite #scratchcard.'
          : 'One tag at a time, like app:hivesuite #scratchcard.',
      };
    }
    return { rule: { kind: 'app_tag', app, tag: parsed.tag } };
  }

  const parsed = parseTag(text);
  if ('error' in parsed) return parsed;
  return { rule: { kind: 'tag', tag: parsed.tag } };
}
