# Timezone Guidance (UTC vs User-Local)

This project uses a clear split between UTC-based day keys and user‑local date windows.

- Streaks and server‑side day keys → Use UTC day key
  - Helper: `getUtcDayKey(date): string` → `YYYY-MM-DD` computed with UTC calendar day
  - Helper: `calcDayDiffUTC(a, b): number` → integer diff of UTC day keys

- Aggregation windows and chart grouping → Use user‑local window
  - Helper: `toUserLocalDate(date): Date` → start of user‑local day (00:00)
  - Helper: `getUserDateString(date): string` → `YYYY-MM-DD` by user‑local day
  - Helper: `toLocalStartOfDay(date): Date` → system‑local midnight (thin wrapper)

Notes
- Keep “streak” logic UTC‑keyed and “chart/aggregation” user‑local.
- When comparing two dates by days, be explicit about UTC vs user‑local intent.
- Avoid mixing `new Date().toString()` with implicit timezone parsing; prefer ISO strings.

Examples
```ts
import { getUtcDayKey, calcDayDiffUTC, toUserLocalDate, getUserDateString } from '@/utils/timezoneUtils';

const streakKey = getUtcDayKey(new Date());      // e.g., '2025-01-02'
const dayDiff = calcDayDiffUTC('2025-01-01Z', '2025-01-03Z'); // 2

const start = toUserLocalDate('2025-01-02T18:00:00Z');
const label = getUserDateString('2025-01-02T18:00:00Z');
```
