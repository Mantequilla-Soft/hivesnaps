/** Utility to detect and extract Hive poll data from json_metadata */

export interface PollDraft {
  question: string;
  choices: string[];       // 2–5 choices
  durationDays: number;    // 1, 3, 7, 14
  maxChoicesVoted: number;
  allowVoteChanges: boolean;
  hideResultsUntilVoted: boolean;
}

export interface PollMetadata {
  question: string;
  choices: string[];
  end_time: number;                  // Unix timestamp (seconds) — PeakD/Ecency standard
  max_choices_voted: number;
  allow_vote_changes: boolean;
  filters?: { account_age?: number };
  ui_hide_res_until_voted?: boolean;
}

interface JsonObject {
  [key: string]: unknown;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function tryParse(val: unknown): JsonObject | null {
  if (!val) return null;
  if (isJsonObject(val)) return val;
  if (typeof val !== 'string') return null;
  try {
    const parsed: unknown = JSON.parse(val);
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isPoll(jsonMetadata: string): boolean {
  const meta = tryParse(jsonMetadata);
  return meta?.content_type === 'poll';
}

export function extractPoll(jsonMetadata: string): PollMetadata | null {
  const meta = tryParse(jsonMetadata);
  if (!meta || meta.content_type !== 'poll') return null;

  const { question, choices, end_time, max_choices_voted, allow_vote_changes, filters, ui_hide_res_until_voted } = meta;

  // Validate choices: must be an array of 2+ non-empty strings
  const hasValidChoices =
    Array.isArray(choices) &&
    choices.length >= 2 &&
    choices.every((c): c is string => typeof c === 'string' && c.trim().length > 0);

  // Validate end_time: number (Unix seconds) or parseable ISO string
  const hasValidEndTime =
    typeof end_time === 'number' ||
    (typeof end_time === 'string' && !Number.isNaN(Date.parse(end_time)));

  if (typeof question !== 'string' || !hasValidChoices || !hasValidEndTime) {
    return null;
  }

  // Normalize end_time to Unix seconds (PeakD uses seconds; ISO strings are converted)
  const endTimeSeconds: number =
    typeof end_time === 'number'
      ? end_time
      : Math.floor(new Date(end_time as string).getTime() / 1000);

  const validatedChoices = choices as string[];

  // Clamp max_choices_voted to [1, choices.length]
  const normalizedMaxChoices =
    typeof max_choices_voted === 'number' &&
    Number.isInteger(max_choices_voted) &&
    max_choices_voted >= 1
      ? Math.min(max_choices_voted, validatedChoices.length)
      : 1;

  return {
    question,
    choices: validatedChoices,
    end_time: endTimeSeconds,
    max_choices_voted: normalizedMaxChoices,
    allow_vote_changes: typeof allow_vote_changes === 'boolean' ? allow_vote_changes : false,
    filters: isJsonObject(filters) ? (filters as { account_age?: number }) : undefined,
    ui_hide_res_until_voted: typeof ui_hide_res_until_voted === 'boolean' ? ui_hide_res_until_voted : false,
  };
}
