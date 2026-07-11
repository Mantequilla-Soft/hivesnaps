// Some snapie.io sidecar endpoints return `created` timestamps without a
// trailing Z even though they're UTC — a naive parser reads them as local
// time, silently skewing age calculations. Force UTC before that happens.
export function normalizeToUtcTimestamp(created: string): string {
  return created.endsWith('Z') ? created : `${created}Z`;
}

export function formatRelativeShort(input: Date | string | number, nowInput?: Date | string | number): string {
  const date = input instanceof Date ? input : new Date(input);
  if (isNaN(date.getTime())) return '';
  const now = nowInput instanceof Date ? nowInput : nowInput ? new Date(nowInput) : new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const week = Math.floor(day / 7);

  if (sec < 10) return 'now';
  if (sec < 60) return `${sec}s`;
  if (min < 60) return `${min}m`;
  if (hr < 24) return `${hr}h`;
  if (day < 7) return `${day}d`;
  if (week < 5) return `${week}w`;

  // For older content, use short date like "Mar 3" or "Mar 3, 2023"
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m = months[date.getUTCMonth()];
  const d = date.getUTCDate();
  const y = date.getUTCFullYear();
  const nowY = now.getUTCFullYear();
  return y === nowY ? `${m} ${d}` : `${m} ${d}, ${y}`;
}
