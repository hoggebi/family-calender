export type Member = {
  id: string;
  name: string;
  color: string;
  icon: string;
};

export type EventItem = {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  time: string; // "HH:MM" or ""
  memberId: string | null; // 이전 데이터 호환용 — 새 데이터는 memberIds 사용
  memberIds?: string[];
  memo: string;
  groupId?: string;
  isNotice?: boolean;
  noticeId?: string;
};

export type RecurringRule = {
  id: string;
  memberId: string | null; // 이전 데이터 호환용 — 새 데이터는 memberIds 사용
  memberIds?: string[];
  personLabel: string;
  title: string;
  time: string;
  weekdays: number[]; // 0=Sun ... 6=Sat
  memo: string;
  exceptions?: string[]; // 이 날짜들만 쉬는 반복 일정 (YYYY-MM-DD)
};

export type Notice = {
  id: string;
  text: string;
  date: string | null;
  eventId: string | null;
};

export type CalendarData = {
  members: Member[];
  events: EventItem[];
  recurring: RecurringRule[];
  notices: Record<string, Notice[]>; // key: "YYYY-MM"
};

// 구성원은 고정입니다 (호 할아버지 / 호 할머니 / 호 엄마)
export const DEFAULT_MEMBERS: Member[] = [
  { id: 'm_grandpa', name: '호 할아버지', color: '#5b7fa6', icon: '👨' },
  { id: 'm_grandma', name: '호 할머니', color: '#c97fa0', icon: '👩' },
  { id: 'm_mom', name: '호 엄마', color: '#e4674f', icon: '🤓' },
];

export const EMPTY_DATA: CalendarData = {
  members: DEFAULT_MEMBERS,
  events: [],
  recurring: [],
  notices: {},
};
