import { formatDateYMD } from '@/utils/chartUtils';
import { toUserLocalDate } from '@/utils/timezoneUtils';

// Hafta başlangıcını (Pazartesi) bul - kullanıcı saat dilimine göre
export const getWeekStart = (date: Date | string): Date => {
  const d = toUserLocalDate(typeof date === 'string' ? new Date(date) : date);
  // JS getDay: Pazar=0, Pazartesi=1 ...
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Pazartesi = 1
  const monday = new Date(d);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
};

export const isFirstOfMonth = (date: Date | string): boolean => {
  const d = toUserLocalDate(typeof date === 'string' ? new Date(date) : date);
  return d.getDate() === 1;
};

export const isMonday = (date: Date | string): boolean => {
  const d = toUserLocalDate(typeof date === 'string' ? new Date(date) : date);
  return d.getDay() === 1;
};

export const average = (numbers: number[]): number => {
  if (!numbers || numbers.length === 0) return 0;
  return numbers.reduce((s, n) => s + n, 0) / numbers.length;
};

export const calculateVariance = (numbers: number[]): number => {
  if (!numbers || numbers.length <= 1) return 0;
  const mean = average(numbers);
  const variance = numbers.reduce((s, n) => s + Math.pow(n - mean, 2), 0) / (numbers.length - 1);
  return variance;
};

export const formatWeekKey = (date: Date | string): string => {
  const monday = getWeekStart(date);
  return formatDateYMD(monday);
};

export const getWeekLabel = (weekStartYMD: string): string => {
  const start = toUserLocalDate(weekStartYMD + 'T00:00:00.000Z');
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const startLabel = `${start.getDate()} ${months[start.getMonth()]}`;
  const endLabel = `${end.getDate()} ${months[end.getMonth()]}`;
  return `${startLabel} – ${endLabel}`;
};

export const getMonthKey = (date: Date | string): string => {
  const d = toUserLocalDate(typeof date === 'string' ? new Date(date) : date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

export const getMonthLabel = (monthKey: string): string => {
  // monthKey: YYYY-MM
  const [y, m] = monthKey.split('-').map((s) => parseInt(s, 10));
  const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
  const monthName = months[(m - 1) as number] || '';
  return `${monthName} ${y}`;
};

export const daysShort = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
export const monthsShort = ['O', 'Ş', 'M', 'N', 'M', 'H', 'T', 'A', 'E', 'E', 'K', 'A'];
export const monthsLongShort = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

// Percentile (quantile) calculation (0..1) using linear interpolation between order statistics
export const quantile = (numbers: number[], q: number): number => {
  const arr = (numbers || []).map(Number).filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  const n = arr.length;
  if (n === 0) return 0;
  if (q <= 0) return arr[0];
  if (q >= 1) return arr[n - 1];
  const pos = (n - 1) * q;
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);
  const weight = pos - lower;
  if (upper === lower) return arr[lower];
  return arr[lower] + (arr[upper] - arr[lower]) * weight;
};
