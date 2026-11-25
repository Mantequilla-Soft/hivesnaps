import { normalizeApp, normalizeTag, type MuteRule } from '@snapie/content-filter';

export type ParsedRuleInput = { rule: MuteRule } | { error: string };

const APP_PREFIX = /^app\s*:\s*/i;

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
    if (hashAt === -1) return { rule: { kind: 'app', app } };
    const tag = normalizeTag(rest.slice(hashAt));
    if (!tag) return { error: 'Add a tag after #, like app:hivesuite #scratchcard.' };
    return { rule: { kind: 'app_tag', app, tag } };
  }

  if (/\s/.test(text.replace(/^#+/, '').trim())) {
    return { error: 'One tag at a time, without spaces.' };
  }
  const tag = normalizeTag(text);
  if (!tag) return { error: 'Type a #tag or app:name.' };
  return { rule: { kind: 'tag', tag } };
}
