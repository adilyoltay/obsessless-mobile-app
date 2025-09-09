import type { TimeRange, DailyAverage, AggregatedData, MoodJourneyExtended } from '@/types/mood';

export type SelectionPayload = {
  date: string;
  index: number;
  totalCount: number;
  label: string;
  x: number;
  chartWidth: number;
  bucketCount: number;
} | null;

// Simple one-item memoization for formatXLabel
let _lastKey: string | null = null;
let _lastResult: string | null = null;

export function formatXLabel(item: DailyAverage | AggregatedData, timeRange: TimeRange, locale: string): string {
  const key = `${timeRange}|${(item as any).date}|${(item as any).label || ''}|${locale}`;
  if (_lastKey === key && _lastResult) return _lastResult;

  let result = '';
  if (timeRange === 'day') {
    const k = ((item as any).date || '') as string; // YYYY-MM-DD#HH
    const hh = k.includes('#') ? k.split('#')[1] : '00';
    const h = parseInt(hh, 10) || 0;
    result = String(h).padStart(2, '0');
  } else if (timeRange === 'week') {
    // Parse YYYY-MM-DD explicitly as local midnight
    const d = new Date(`${(item as DailyAverage).date}T00:00:00`);
    const daysShort = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
    result = daysShort[d.getDay()];
  } else if (timeRange === 'month') {
    const label = (item as AggregatedData).label || '';
    const match = label.match(/^(\d+)/);
    if (match) result = match[1];
    else {
      const d = new Date((item as AggregatedData).date);
      result = d.getDate().toString();
    }
  } else {
    const d = new Date((item as AggregatedData).date);
    result = new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
  }
  _lastKey = key;
  _lastResult = result;
  return result;
}

export function getXLabelVisibility(index: number, total: number, timeRange: TimeRange, contentWidth: number): boolean {
  if (timeRange === 'day') {
    const dw = contentWidth / Math.max(1, total);
    let step = 1;
    if (dw < 12) step = 4; // 0,4,8,12,16,20
    else if (dw < 18) step = 3; // 0,3,6,9,12,15,18,21
    else if (dw < 28) step = 2; // 0,2,4...
    else step = 1; // her saat
    return index % step === 0;
  }
  const minLabelPx = (timeRange === 'week') ? 18 : (timeRange === 'month') ? 22 : (timeRange === '6months') ? 28 : 36; // year
  const step = Math.max(1, Math.ceil((total * minLabelPx) / Math.max(1, contentWidth)));
  if (index === 0 || index === total - 1) return true;
  return index % step === 0;
}

export function emitSelectionHelper(args: {
  data: MoodJourneyExtended;
  timeRange: TimeRange;
  contentWidth: number;
  chartWidth: number;
  dayWindowStart: number;
  dayWindowSize: number;
  index: number | null;
  locale: string;
  AXIS_WIDTH: number;
  onSelectionChange?: (payload: SelectionPayload) => void;
}): void {
  const { data, timeRange, contentWidth, chartWidth, dayWindowStart, dayWindowSize, index, locale, AXIS_WIDTH, onSelectionChange } = args;
  const items = (timeRange === 'day')
    ? (((data.hourlyAverages || [])
        .slice(dayWindowStart, dayWindowStart + dayWindowSize)
        .map((h: any) => ({ date: h.dateKey })) ) as any[])
    : (data.aggregated?.data || []);
  const n = items.length;
  if (index === null || index < 0 || index > n - 1) {
    onSelectionChange?.(null);
    return;
  }

  let totalCount = 0;
  let hasData = false;
  if (timeRange === 'day') {
    const hourItem = items[index] as any; // { date: YYYY-MM-DD#HH }
    const rp = (data as any).rawHourlyDataPoints?.[hourItem.date]?.entries || [];
    totalCount = rp.length;
    hasData = totalCount > 0;
  } else {
    const b = items[index] as AggregatedData;
    totalCount = Number(b.count || 0);
    hasData = totalCount > 0;
  }

  if (!hasData || totalCount === 0) {
    let found = -1;
    for (let step = 1; step < n; step++) {
      const left = index - step;
      const right = index + step;
      const check = (k: number) => {
        if (k < 0 || k >= n) return false;
        if (timeRange === 'day') {
          const it: any = items[k];
          const rp = (data as any).rawHourlyDataPoints?.[it.date]?.entries || [];
          return rp.length > 0;
        } else {
          return Number((items[k] as any).count || 0) > 0;
        }
      };
      if (check(left)) { found = left; break; }
      if (check(right)) { found = right; break; }
    }
    if (found === -1) { onSelectionChange?.(null); return; }
    // Rekürsif çağrı yerine doğrudan payload üretelim
    return emitSelectionHelper({ ...args, index: found });
  }

  const dw = contentWidth / Math.max(1, n);
  const x = AXIS_WIDTH + (index * dw) + (dw / 2);
  let labelText = '';
  let dateSel = '';

  if (timeRange === 'day') {
    const it = items[index] as any; // { date: YYYY-MM-DD#HH }
    const [dstr, hh] = String(it.date).split('#');
    const d = new Date(`${dstr}T00:00:00.000Z`);
    const h = parseInt(hh || '0', 10);
    const mon = new Intl.DateTimeFormat(locale, { month: 'short' }).format(d);
    const day = d.getDate();
    const year = d.getFullYear();
    labelText = `${day} ${mon} ${year} • ${String(h).padStart(2, '0')}:00`;
    dateSel = it.date;
  } else {
    const b = items[index] as AggregatedData;
    if (timeRange === 'week') {
      const d = new Date(`${b.date}T00:00:00.000Z`);
      const monthsLongShort = ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'];
      labelText = `${d.getDate()} ${monthsLongShort[d.getMonth()]} ${d.getFullYear()}`;
    } else {
      labelText = (b as any).label || '';
    }
    dateSel = b.date;
  }

  onSelectionChange?.({ date: dateSel, index, totalCount, label: labelText, x, chartWidth, bucketCount: n });
}

