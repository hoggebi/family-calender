import { CalendarData, EventItem, Member } from './types';

export const pad = (n: number) => String(n).padStart(2, '0');
export const dateStr = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const todayStr = () => {
  const t = new Date();
  return dateStr(t.getFullYear(), t.getMonth(), t.getDate());
};
export const monthKey = (y: number, m: number) => `${y}-${pad(m + 1)}`;

// memberIds가 있으면 그걸, 없으면(옛날 데이터) memberId 하나짜리 배열로
export function memberIdsOf(entity: { memberId: string | null; memberIds?: string[] }): string[] {
  if (entity.memberIds && entity.memberIds.length) return entity.memberIds;
  return entity.memberId ? [entity.memberId] : [];
}

export function membersOf(data: CalendarData, ids: string[]): Member[] {
  return ids.map((id) => data.members.find((m) => m.id === id)).filter((m): m is Member => Boolean(m));
}

// 담당자가 여러 명이면 색이 자연스럽게 섞이는 그라데이션으로 표시
export function multiColor(colors: string[]): string {
  if (colors.length === 0) return '#999';
  if (colors.length === 1) return colors[0];
  return `linear-gradient(90deg, ${colors.join(', ')})`;
}

export function findMemberByLabel(data: CalendarData, label: string): string | null {
  if (!label) return null;
  const exact = data.members.find((m) => m.name === label);
  if (exact) return exact.id;
  const partial = data.members.find((m) => label.includes(m.name) || m.name.includes(label));
  return partial ? partial.id : null;
}

// 특정 날짜(YYYY-MM-DD)에 해당하는 일반 일정 + 반복 일정을 합쳐서 반환
export function getEventsForDate(data: CalendarData, ds: string) {
  const dow = new Date(ds + 'T00:00:00').getDay();
  const normal: (EventItem & { isRecurring?: boolean })[] = data.events.filter((e) => e.date === ds);
  const recurring = (data.recurring || [])
    .filter((r) => r.weekdays.includes(dow) && !(r.exceptions || []).includes(ds))
    .map((r) => ({
      id: r.id,
      date: ds,
      title: r.title,
      time: r.time,
      memberId: r.memberId,
      memberIds: r.memberIds,
      memo: r.memo,
      isRecurring: true as const,
    }));
  return [...normal, ...recurring].sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));
}

export type WeekCell = { day: number | null; ds: string | null };

export function buildWeeks(y: number, m: number): WeekCell[][] {
  const firstDow = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const flat: WeekCell[] = [];
  for (let i = 0; i < firstDow; i++) flat.push({ day: null, ds: null });
  for (let d = 1; d <= daysInMonth; d++) flat.push({ day: d, ds: dateStr(y, m, d) });
  while (flat.length % 7 !== 0) flat.push({ day: null, ds: null });
  const weeks: WeekCell[][] = [];
  for (let i = 0; i < flat.length; i += 7) weeks.push(flat.slice(i, i + 7));
  return weeks;
}
