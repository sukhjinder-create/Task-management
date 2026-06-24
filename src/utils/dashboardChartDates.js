const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RANGE_VALUES = new Set(["30d", "90d", "6m", "1y", "all"]);

function normalizeRange(range) {
  const value = String(range || "30d").toLowerCase();
  return RANGE_VALUES.has(value) ? value : "30d";
}

function utcDate(year, month, day = 1) {
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

export function parseDashboardChartDate(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  const text = String(value).trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return utcDate(match[1], match[2], match[3]);

  match = text.match(/^(\d{4})-(\d{2})$/);
  if (match) return utcDate(match[1], match[2], 1);

  match = text.match(/^(\d{2})-(\d{2})(?:-\d{2}-\d{2})?$/);
  if (match) return utcDate(new Date().getUTCFullYear(), match[1], match[2]);

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function dateCandidate(point) {
  return point?.bucketStart || point?.date || point?.snapshotDate || point?.month || point?.label;
}

function dayMonth(date) {
  return `${String(date.getUTCDate()).padStart(2, "0")} ${MONTHS[date.getUTCMonth()]}`;
}

function dayMonthYear(date) {
  return `${dayMonth(date)} ${date.getUTCFullYear()}`;
}

function monthLabel(date, includeYear = false) {
  const label = MONTHS[date.getUTCMonth()];
  return includeYear ? `${label} ${date.getUTCFullYear()}` : label;
}

function spansMultipleYears(points = []) {
  const years = new Set(
    points
      .map((point) => parseDashboardChartDate(dateCandidate(point)))
      .filter(Boolean)
      .map((date) => date.getUTCFullYear())
  );
  return years.size > 1;
}

export function formatDashboardChartDateLabel(point, range = "30d", allPoints = []) {
  const normalizedRange = normalizeRange(range);
  const date = parseDashboardChartDate(dateCandidate(point));
  if (!date) return point?.label ? String(point.label) : "";

  if (normalizedRange === "30d" || normalizedRange === "90d") {
    return dayMonth(date);
  }

  return monthLabel(date, normalizedRange === "all" || spansMultipleYears(allPoints));
}

export function formatDashboardChartTooltipLabel(point, range = "30d", allPoints = []) {
  const normalizedRange = normalizeRange(range);
  const start = parseDashboardChartDate(point?.bucketStart || dateCandidate(point));
  const end = parseDashboardChartDate(point?.bucketEnd);
  if (!start) return point?.tooltipLabel || point?.label || "";

  if (end && start.toISOString().slice(0, 10) !== end.toISOString().slice(0, 10)) {
    return `${dayMonthYear(start)} - ${dayMonthYear(end)}`;
  }

  if (normalizedRange === "30d" || normalizedRange === "90d") {
    return dayMonthYear(start);
  }

  return monthLabel(start, normalizedRange === "all" || spansMultipleYears(allPoints));
}

export function withDashboardChartDateLabels(points = [], range = "30d") {
  const rows = Array.isArray(points) ? points : [];
  return rows.map((point) => ({
    ...point,
    label: formatDashboardChartDateLabel(point, range, rows),
    tooltipLabel: formatDashboardChartTooltipLabel(point, range, rows) || point?.tooltipLabel,
  }));
}

export function dashboardChartTickInterval(range = "30d", pointCount = 0) {
  const normalizedRange = normalizeRange(range);
  const count = Number(pointCount) || 0;
  if (count <= 8) return 0;
  if (normalizedRange === "30d") return Math.ceil(count / 7) - 1;
  if (normalizedRange === "90d") return Math.ceil(count / 9) - 1;
  if (normalizedRange === "6m") return Math.ceil(count / 8) - 1;
  return Math.ceil(count / 10) - 1;
}
