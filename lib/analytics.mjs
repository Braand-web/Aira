export const ANALYTICS_DAYS = [7, 30, 90];
const DAY = 86_400_000;
const iso = date => date.toISOString().slice(0, 10);

// Compare completed calendar days in the advertising account's timezone.
export function analyticsRange(days = 30, timezone = 'UTC', now = Date.now()) {
  if (!ANALYTICS_DAYS.includes(days)) throw new RangeError('Période invalide.');
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit'}).formatToParts(now);
  const part = name => parts.find(item => item.type === name).value;
  const today = Date.parse(`${part('year')}-${part('month')}-${part('day')}T00:00:00Z`);
  return {days, timezone, since: iso(new Date(today - days * DAY)), until: iso(new Date(today - DAY)), previousSince: iso(new Date(today - days * 2 * DAY)), previousUntil: iso(new Date(today - (days + 1) * DAY))};
}

export function metricNumber(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || value === '' || (typeof value === 'string' && !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

export function summarizeAnalytics(rows) {
  const total = key => {
    const values = rows.map(row => metricNumber(row[key]));
    return values.some(value => value === null) ? null : values.reduce((sum, value) => sum + value, 0);
  };
  const spend = total('spend'), impressions = total('impressions'), clicks = total('clicks');
  return {spend, impressions, clicks, cpc: spend !== null && clicks > 0 ? spend / clicks : null, ctr: clicks !== null && impressions > 0 ? clicks / impressions * 100 : null, cpm: spend !== null && impressions > 0 ? spend / impressions * 1000 : null};
}

export function metricChange(current, previous) {
  return current === null || previous === null || previous <= 0 ? null : (current - previous) / previous * 100;
}

// A missing daily observation remains a gap, never a fabricated zero.
export function dailyAnalytics(rows, since, days) {
  const byDate = new Map(rows.map(row => [row.date_start, row]));
  const start = Date.parse(since + 'T00:00:00Z');
  return Array.from({length: days}, (_, index) => {
    const date = iso(new Date(start + index * DAY)), row = byDate.get(date);
    return {date, metrics: row ? summarizeAnalytics([row]) : null};
  });
}

export function analyticsCSV(rows, account, range) {
  const cell = value => {
    const text = String(value ?? '');
    // Campaign names can be user supplied; do not export spreadsheet formulas.
    return '"' + (/^(?:\s*[=+\-@]|[\t\r\n])/.test(text) ? "'" : '') + text.replaceAll('"', '""') + '"';
  };
  const values = [['Compte', 'Du', 'Au', 'Campagne', 'Dépenses (' + account.currency + ')', 'Impressions', 'Clics', 'CTR (%)', 'CPC (' + account.currency + ')', 'CPM (' + account.currency + ')'], ...rows.map(row => {
    const metrics = summarizeAnalytics([row]);
    return [account.name, range.since, range.until, row.campaign_name || 'Campagne sans nom', ...['spend', 'impressions', 'clicks', 'ctr', 'cpc', 'cpm'].map(key => metrics[key])];
  })];
  return '\ufeff' + values.map(row => row.map(cell).join(';')).join('\r\n');
}
