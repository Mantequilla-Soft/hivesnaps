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
  end_time: string;                  // ISO datetime
  max_choices_voted: number;
  allow_vote_changes: boolean;
  filters?: { account_age?: number };
  ui_hide_res_until_voted?: boolean;
}

function tryParse(val: unknown): any {
  if (!val) return null;
  if (typeof val === 'object') return val as any;
  if (typeof val !== 'string') return null;
  try {
    return JSON.parse(val);
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

  if (
    typeof question !== 'string' ||
    !Array.isArray(choices) ||
    choices.length < 2 ||
    typeof end_time !== 'string'
  ) {
    return null;
  }

  return {
    question,
    choices: choices as string[],
    end_time,
    max_choices_voted: typeof max_choices_voted === 'number' ? max_choices_voted : 1,
    allow_vote_changes: typeof allow_vote_changes === 'boolean' ? allow_vote_changes : false,
    filters: filters ?? undefined,
    ui_hide_res_until_voted: typeof ui_hide_res_until_voted === 'boolean' ? ui_hide_res_until_voted : false,
  };
}
