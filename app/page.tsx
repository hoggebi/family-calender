'use client';

import { useEffect, useMemo, useState } from 'react';
import './calendar.css';
import { HOLIDAYS } from '@/lib/holidays';
import { CalendarData, EventItem, EMPTY_DATA } from '@/lib/types';
import {
  dateStr,
  todayStr,
  monthKey as makeMonthKey,
  memberById,
  getEventsForDate,
  buildWeeks,
} from '@/lib/calendarUtils';

type DisplayEvent = EventItem & { isRecurring?: boolean };

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function MemberBadge({ data, memberId, isNotice, isRecurring, size = 18 }: { data: CalendarData; memberId: string | null; isNotice?: boolean; isRecurring?: boolean; size?: number }) {
  const mem = memberById(data, memberId);
  if (isNotice) {
    return <span className="icon-badge" style={{ background: '#111111', width: size, height: size, fontSize: Math.round(size * 0.62) }}>📌</span>;
  }
  if (mem?.icon) {
    return <span className="icon-badge" style={{ background: mem.color, width: size, height: size, fontSize: Math.round(size * 0.62) }}>{mem.icon}</span>;
  }
  return <span className="dot" style={{ background: mem ? mem.color : '#999' }} />;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

function formatRange(start: string, end: string) {
  const [, sm, sd] = start.split('-').map(Number);
  const [, em, ed] = end.split('-').map(Number);
  if (sm === em) return `${sm}/${sd}~${ed}`;
  return `${sm}/${sd}~${em}/${ed}`;
}

function MonthHighlights({
  data,
  y,
  m,
  onOpenRange,
  onOpenRecurring,
}: {
  data: CalendarData;
  y: number;
  m: number;
  onOpenRange: (ds: string) => void;
  onOpenRecurring: (rule: CalendarData['recurring'][number]) => void;
}) {
  const monthStart = dateStr(y, m, 1);
  const monthEnd = dateStr(y, m, new Date(y, m + 1, 0).getDate());

  const groups = new Map<string, { dates: string[]; title: string; memberId: string | null }>();
  data.events
    .filter((e) => e.groupId)
    .forEach((e) => {
      const g = groups.get(e.groupId as string);
      if (g) g.dates.push(e.date);
      else groups.set(e.groupId as string, { dates: [e.date], title: e.title, memberId: e.memberId });
    });
  const ranges = [...groups.values()]
    .map((g) => {
      const dates = [...g.dates].sort();
      return { ...g, start: dates[0], end: dates[dates.length - 1] };
    })
    .filter((r) => r.start <= monthEnd && r.end >= monthStart)
    .sort((a, b) => a.start.localeCompare(b.start));

  if (ranges.length === 0 && data.recurring.length === 0) return null;

  return (
    <div className="highlights">
      {ranges.map((r) => {
        const mem = memberById(data, r.memberId);
        return (
          <div
            className="highlight-bar"
            key={r.start + r.title}
            style={{ background: mem ? mem.color : '#999' }}
            onClick={() => onOpenRange(r.start)}
          >
            <span className="hi-badge">{mem?.icon ?? '📌'}</span>
            <span className="hi-text">{formatRange(r.start, r.end)} {r.title}</span>
          </div>
        );
      })}
      {data.recurring.map((r) => {
        const mem = memberById(data, r.memberId);
        const days = [...r.weekdays].sort().map((w) => DAY_NAMES[w]).join(',');
        return (
          <div
            className="highlight-bar"
            key={r.id}
            style={{ background: mem ? mem.color : '#999' }}
            onClick={() => onOpenRecurring(r)}
          >
            <span className="hi-badge">{mem?.icon ?? '🔁'}</span>
            <span className="hi-text">🔁 매주 {days} {r.title}</span>
          </div>
        );
      })}
    </div>
  );
}

type ListEntry = {
  sortKey: string;
  date: string;
  endDate?: string;
  title: string;
  time: string;
  memberId: string | null;
  isNotice?: boolean;
  memo: string;
  evId: string;
};

function buildListEntries(data: CalendarData): ListEntry[] {
  const groupsSeen = new Set<string>();
  const entries: ListEntry[] = [];
  data.events.forEach((e) => {
    if (e.groupId) {
      if (groupsSeen.has(e.groupId)) return;
      groupsSeen.add(e.groupId);
      const groupDates = data.events.filter((x) => x.groupId === e.groupId).map((x) => x.date).sort();
      entries.push({
        sortKey: groupDates[0],
        date: groupDates[0],
        endDate: groupDates[groupDates.length - 1],
        title: e.title,
        time: e.time,
        memberId: e.memberId,
        memo: e.memo,
        evId: e.id,
      });
    } else {
      entries.push({ sortKey: e.date, date: e.date, title: e.title, time: e.time, memberId: e.memberId, isNotice: e.isNotice, memo: e.memo, evId: e.id });
    }
  });
  return entries.sort((a, b) => a.sortKey.localeCompare(b.sortKey) || (a.time || '99').localeCompare(b.time || '99'));
}

function ListView({
  data,
  onGoToEntry,
  onEditRecurring,
}: {
  data: CalendarData;
  onGoToEntry: (ds: string, evId: string) => void;
  onEditRecurring: (rule: CalendarData['recurring'][number]) => void;
}) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const recList = data.recurring
    .filter((r) => {
      if (!q) return true;
      const mem = memberById(data, r.memberId);
      const days = [...r.weekdays].sort().map((w) => DAY_NAMES[w]).join(',');
      const text = `${r.title} ${mem?.name ?? ''} 매주 ${days} ${r.time} ${r.memo}`.toLowerCase();
      return text.includes(q);
    })
    .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'));

  const entries = buildListEntries(data).filter((en) => {
    if (!q) return true;
    const mem = memberById(data, en.memberId);
    const [, em, ed] = en.date.split('-').map(Number);
    const dow = DAY_NAMES[new Date(en.date + 'T00:00:00').getDay()];
    const dateForms = [en.date, `${em}/${ed}`, `${em}월 ${ed}일`, `${ed}일`, `${dow}요일`];
    if (en.endDate) {
      const [, eem, eed] = en.endDate.split('-').map(Number);
      dateForms.push(en.endDate, `${eem}/${eed}`, `${eem}월 ${eed}일`);
    }
    const text = `${en.title} ${mem?.name ?? ''} ${en.time} ${en.memo} ${dateForms.join(' ')}`.toLowerCase();
    return text.includes(q);
  });

  const groups: { key: string; label: string; rows: ListEntry[] }[] = [];
  entries.forEach((en) => {
    const [y, m] = en.date.split('-');
    const key = `${y}-${m}`;
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      g = { key, label: `${Number(y)}년 ${Number(m)}월`, rows: [] };
      groups.push(g);
    }
    g.rows.push(en);
  });

  return (
    <div className="tab-page">
      <input
        type="text"
        className="list-search-input"
        placeholder="🔍 날짜나 키워드로 검색 (예: 8/25, 수영, 호엄마)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {recList.length === 0 && entries.length === 0 ? (
        <div className="month-list-empty">{q ? '검색 결과가 없어요.' : '등록된 일정이 없어요.'}</div>
      ) : (
        <>
          {recList.length > 0 && (
            <div className="recurring-list-section">
              <div className="month-list-title">🔁 반복 일정</div>
              {recList.map((r) => {
                const days = [...r.weekdays].sort().map((w) => DAY_NAMES[w]).join(',');
                return (
                  <div className="month-list-row" key={r.id} onClick={() => onEditRecurring(r)}>
                    <MemberBadge data={data} memberId={r.memberId} size={20} />
                    <span className="month-list-txt">매주 {days} {r.title}</span>
                    <span className="month-list-time">{r.time}</span>
                  </div>
                );
              })}
            </div>
          )}

          {groups.map((g) => (
            <div className="month-list-group" key={g.key}>
              <div className="month-list-title">{g.label}</div>
              {g.rows.map((en) => {
                const d = Number(en.date.split('-')[2]);
                const dow = DAY_NAMES[new Date(en.date + 'T00:00:00').getDay()];
                return (
                  <div className="month-list-row" key={en.evId} onClick={() => onGoToEntry(en.date, en.evId)}>
                    <span className="month-list-date">
                      {en.endDate ? (
                        <><b>{d}</b>~{Number(en.endDate.split('-')[2])}일</>
                      ) : (
                        <><b>{d}</b>일({dow})</>
                      )}
                    </span>
                    <MemberBadge data={data} memberId={en.memberId} isNotice={en.isNotice} size={18} />
                    <span className="month-list-txt">{en.isNotice ? '📌 ' : ''}{en.title}</span>
                    <span className="month-list-time">{en.time}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function Home() {
  const [data, setData] = useState<CalendarData>(EMPTY_DATA);
  const [tab, setTab] = useState<'calendar' | 'list'>('calendar');
  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<{ text: string; error?: boolean }>({ text: '불러오는 중…' });

  const [cur, setCur] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  // day modal state
  const [dayOpen, setDayOpen] = useState(false);
  const [activeDs, setActiveDs] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fTime, setFTime] = useState('');
  const [fMemberId, setFMemberId] = useState<string | null>(null);
  const [fMemo, setFMemo] = useState('');
  const [fEndDate, setFEndDate] = useState('');
  const [formStatus, setFormStatus] = useState<{ text: string; error?: boolean }>({ text: '' });
  const [formBusy, setFormBusy] = useState(false);

  // 빠른 일정 입력 (AI 없이 직접 선택)
  const [qType, setQType] = useState<'once' | 'range' | 'weekly'>('once');
  const [qMemberId, setQMemberId] = useState<string | null>(null);
  const [qTitle, setQTitle] = useState('');
  const [qTime, setQTime] = useState('');
  const [qMemo, setQMemo] = useState('');
  const [qDate, setQDate] = useState('');
  const [qStartDate, setQStartDate] = useState('');
  const [qEndDate, setQEndDate] = useState('');
  const [qWeekdays, setQWeekdays] = useState<number[]>([]);
  const [quickStatus, setQuickStatus] = useState<{ text: string; error?: boolean }>({ text: '' });

  // notice (날짜는 직접 선택)
  const [noticeText, setNoticeText] = useState('');
  const [noticeDate, setNoticeDate] = useState('');
  const [noticeStatus, setNoticeStatus] = useState<{ text: string; error?: boolean }>({ text: '' });

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/calendar');
        const json = (await res.json()) as CalendarData;
        if (!res.ok) throw new Error('load failed');
        setData({
          members: json.members?.length ? json.members : EMPTY_DATA.members,
          events: json.events || [],
          recurring: json.recurring || [],
          notices: json.notices || {},
        });
        setBanner({ text: '' });
      } catch (e) {
        setBanner({ text: '불러오기에 실패했어요. 새로고침 해주세요.', error: true });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!qMemberId && data.members.length) setQMemberId(data.members[0].id);
  }, [data.members, qMemberId]);

  async function persist(next: CalendarData): Promise<boolean> {
    setData(next);
    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error('save failed');
      setBanner({ text: '' });
      return true;
    } catch (e) {
      setBanner({ text: '저장에 실패했어요. 인터넷 연결을 확인해주세요.', error: true });
      return false;
    }
  }

  const y = cur.getFullYear();
  const m = cur.getMonth();
  const mKey = makeMonthKey(y, m);
  const weeks = useMemo(() => buildWeeks(y, m), [y, m]);
  const today = todayStr();

  function openDay(ds: string, focusId?: string) {
    setActiveDs(ds);
    const dayEvents = getEventsForDate(data, ds) as DisplayEvent[];
    if (focusId) {
      const ev = dayEvents.find((e) => e.id === focusId);
      if (ev) {
        handleRowClick(ev);
        setDayOpen(true);
        return;
      }
    }
    clearForm();
    setDayOpen(true);
  }

  function goToEntryAndEdit(ds: string, evId: string) {
    const [ey, em] = ds.split('-').map(Number);
    setCur(new Date(ey, em - 1, 1));
    setTab('calendar');
    openDay(ds, evId);
  }

  function openRecurringFromList(rule: CalendarData['recurring'][number]) {
    const start = new Date();
    for (let i = 0; i < 60; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      if (rule.weekdays.includes(d.getDay())) {
        setCur(new Date(d.getFullYear(), d.getMonth(), 1));
        setTab('calendar');
        openDay(dateStr(d.getFullYear(), d.getMonth(), d.getDate()), rule.id);
        return;
      }
    }
  }

  function clearForm() {
    setEditingId(null);
    setFTitle('');
    setFTime('');
    setFMemo('');
    setFEndDate('');
    setFMemberId(data.members[0]?.id ?? null);
    setFormStatus({ text: '' });
  }

  function handleRowClick(ev: DisplayEvent) {
    if (ev.isRecurring) {
      if (confirm(`이 반복 일정을 삭제할까요?\n${ev.title} (매주 반복)`)) {
        deleteRecurring(ev.id);
      }
      return;
    }
    setEditingId(ev.id);
    setFTitle(ev.title);
    setFTime(ev.time || '');
    setFMemberId(ev.memberId);
    setFMemo(ev.memo || '');
    setFormStatus({ text: '' });
  }

  async function deleteRecurring(id: string) {
    const next = { ...data, recurring: data.recurring.filter((r) => r.id !== id) };
    await persist(next);
  }

  async function saveEvent() {
    const title = fTitle.trim();
    if (!title) {
      setFormStatus({ text: '제목을 입력해주세요.', error: true });
      return;
    }
    if (!activeDs) return;
    setFormBusy(true);
    setFormStatus({ text: '저장 중…' });

    let events = data.events;
    if (editingId) {
      events = events.map((e) => (e.id === editingId ? { ...e, title, time: fTime, memberId: fMemberId, memo: fMemo } : e));
    } else if (fEndDate && fEndDate > activeDs) {
      // 종료일이 시작일보다 뒤면 여러 날짜에 걸친 일정(이어진 막대)으로 저장
      const groupId = 'g_' + Date.now();
      const next = [...events];
      let dcur = new Date(activeDs + 'T00:00:00');
      const dend = new Date(fEndDate + 'T00:00:00');
      let count = 0;
      while (dcur <= dend && count < 60) {
        const ds = dateStr(dcur.getFullYear(), dcur.getMonth(), dcur.getDate());
        next.push({ id: 'e_' + Date.now() + '_' + count, date: ds, title, time: fTime, memberId: fMemberId, memo: fMemo, groupId });
        dcur.setDate(dcur.getDate() + 1);
        count++;
      }
      events = next;
    } else {
      events = [...events, { id: 'e_' + Date.now(), date: activeDs, title, time: fTime, memberId: fMemberId, memo: fMemo }];
    }
    const ok = await persist({ ...data, events });
    setFormBusy(false);
    if (!ok) {
      setFormStatus({ text: '저장에 실패했어요. 인터넷 연결을 확인하고 다시 시도해주세요.', error: true });
      return;
    }
    clearForm();
  }

  async function deleteEvent() {
    if (!editingId) return;
    if (!confirm('이 일정을 삭제할까요?')) return;
    const next = { ...data, events: data.events.filter((e) => e.id !== editingId) };
    await persist(next);
    clearForm();
  }

  function toggleQWeekday(w: number) {
    setQWeekdays((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w].sort()));
  }

  function clearQuickForm() {
    setQTitle('');
    setQTime('');
    setQMemo('');
    setQDate('');
    setQStartDate('');
    setQEndDate('');
    setQWeekdays([]);
  }

  async function quickAdd() {
    const title = qTitle.trim();
    if (!title) {
      setQuickStatus({ text: '제목을 입력해주세요.', error: true });
      return;
    }
    if (!qMemberId) {
      setQuickStatus({ text: '담당자를 선택해주세요.', error: true });
      return;
    }
    let next: CalendarData = data;

    if (qType === 'weekly') {
      if (!qWeekdays.length) {
        setQuickStatus({ text: '반복할 요일을 선택해주세요.', error: true });
        return;
      }
      next = {
        ...data,
        recurring: [
          ...data.recurring,
          { id: 'r_' + Date.now(), memberId: qMemberId, personLabel: memberById(data, qMemberId)?.name || '', title, time: qTime, weekdays: qWeekdays, memo: qMemo },
        ],
      };
    } else if (qType === 'range') {
      if (!qStartDate || !qEndDate) {
        setQuickStatus({ text: '시작일과 종료일을 선택해주세요.', error: true });
        return;
      }
      if (qEndDate < qStartDate) {
        setQuickStatus({ text: '종료일이 시작일보다 빠를 수 없어요.', error: true });
        return;
      }
      const groupId = 'g_' + Date.now();
      const events = [...data.events];
      let dcur = new Date(qStartDate + 'T00:00:00');
      const dend = new Date(qEndDate + 'T00:00:00');
      let count = 0;
      while (dcur <= dend && count < 60) {
        const ds = dateStr(dcur.getFullYear(), dcur.getMonth(), dcur.getDate());
        events.push({ id: 'e_' + Date.now() + '_' + count, date: ds, title, time: qTime, memberId: qMemberId, memo: qMemo, groupId });
        dcur.setDate(dcur.getDate() + 1);
        count++;
      }
      next = { ...data, events };
    } else {
      if (!qDate) {
        setQuickStatus({ text: '날짜를 선택해주세요.', error: true });
        return;
      }
      next = { ...data, events: [...data.events, { id: 'e_' + Date.now(), date: qDate, title, time: qTime, memberId: qMemberId, memo: qMemo }] };
    }

    setQuickStatus({ text: '저장 중…' });
    const ok = await persist(next);
    if (!ok) {
      setQuickStatus({ text: '저장에 실패했어요. 다시 시도해주세요.', error: true });
      return;
    }
    clearQuickForm();
    setQuickStatus({ text: '등록했어요.' });
  }

  async function addNotice() {
    const val = noticeText.trim();
    if (!val) return;
    const notice = { id: 'n_' + Date.now(), text: val, date: null as string | null, eventId: null as string | null };
    let events = data.events;
    if (noticeDate) {
      const eventId = 'e_' + Date.now();
      events = [...events, { id: eventId, date: noticeDate, title: val, time: '', memberId: null, memo: '', isNotice: true, noticeId: notice.id }];
      notice.date = noticeDate;
      notice.eventId = eventId;
    }
    const notices = { ...data.notices, [mKey]: [...(data.notices[mKey] || []), notice] };
    setNoticeStatus({ text: '저장 중…' });
    const ok = await persist({ ...data, events, notices });
    if (!ok) {
      setNoticeStatus({ text: '저장에 실패했어요. 다시 시도해주세요.', error: true });
      return;
    }
    setNoticeText('');
    setNoticeDate('');
    setNoticeStatus({ text: notice.date ? `등록했어요 · ${notice.date} 달력에도 표시돼요` : '등록했어요' });
  }

  async function deleteNotice(id: string) {
    if (!confirm('이 공지사항을 삭제할까요? 달력에 자동으로 등록된 일정도 함께 사라져요.')) return;
    const list = data.notices[mKey] || [];
    const notice = list.find((n) => n.id === id);
    const notices = { ...data.notices, [mKey]: list.filter((n) => n.id !== id) };
    const events = notice?.eventId ? data.events.filter((e) => e.id !== notice.eventId) : data.events;
    await persist({ ...data, events, notices });
  }

  async function resetAll() {
    if (!confirm('정말 모든 일정과 공지사항을 삭제할까요? 이 작업은 되돌릴 수 없고, 가족 모두에게 적용돼요.')) return;
    await persist({ ...EMPTY_DATA, members: data.members });
  }

  const noticeList = data.notices[mKey] || [];

  return (
    <div className="board">
      <header>
        <h1 className="title">호 가족 일정</h1>
        <p className="subtitle">가족 모두가 함께 보고 적어요</p>
      </header>

      <div className={`status-banner${banner.error ? ' error' : ''}`}>{banner.text}</div>

      <div className="family-strip">
        {data.members.map((mem) => (
          <div className="chip" key={mem.id}>
            <MemberBadge data={data} memberId={mem.id} size={26} />
            <span>{mem.name}</span>
          </div>
        ))}
      </div>

      <div className="tab-row">
        <button className={`tab-btn${tab === 'calendar' ? ' active' : ''}`} onClick={() => setTab('calendar')}>캘린더</button>
        <button className={`tab-btn${tab === 'list' ? ' active' : ''}`} onClick={() => setTab('list')}>일정 목록</button>
      </div>

      {tab === 'list' && (
        <ListView data={data} onGoToEntry={goToEntryAndEdit} onEditRecurring={openRecurringFromList} />
      )}

      {tab === 'calendar' && (
      <div className="tab-page">
      <div className="notice-box">
        <div className="notice-label">📌 {m + 1}월 주요 공지사항</div>
        <div>
          {noticeList.length === 0 ? (
            <div className="notice-empty">아직 등록된 공지사항이 없어요.</div>
          ) : (
            noticeList.map((n) => (
              <div className="notice-row" key={n.id}>
                <span className="txt" dangerouslySetInnerHTML={{ __html: (n.date ? `<b>${Number(n.date.split('-')[2])}일</b> ` : '') + escapeHtml(n.text) }} />
                <button aria-label="공지사항 삭제" onClick={() => deleteNotice(n.id)}>×</button>
              </div>
            ))
          )}
        </div>
        <textarea
          className="notice-textarea"
          placeholder="예: 학부모 참관수업, 관리비 납부일"
          value={noticeText}
          onChange={(e) => setNoticeText(e.target.value)}
        />
        <div className="field" style={{ marginTop: 8 }}>
          <label>날짜 (선택 — 달력에도 표시하려면)</label>
          <input type="date" value={noticeDate} onChange={(e) => setNoticeDate(e.target.value)} />
        </div>
        <div className="notice-actions">
          <span className={`notice-status${noticeStatus.error ? ' error' : ''}`}>{noticeStatus.text}</span>
          <button className="btn btn-primary" onClick={addNotice}>추가</button>
        </div>
      </div>

      <div className="nav-row">
        <button className="nav-btn" aria-label="이전 달" onClick={() => setCur(new Date(y, m - 1, 1))}>‹</button>
        <div className="month-label">{y}년 {m + 1}월</div>
        <button className="nav-btn" aria-label="다음 달" onClick={() => setCur(new Date(y, m + 1, 1))}>›</button>
        <button className="today-btn" onClick={() => { const d = new Date(); d.setDate(1); setCur(d); }}>오늘</button>
      </div>

      <MonthHighlights
        data={data}
        y={y}
        m={m}
        onOpenRange={(ds) => openDay(ds)}
        onOpenRecurring={(rule) => {
          const dim = new Date(y, m + 1, 0).getDate();
          let ds = dateStr(y, m, 1);
          for (let d = 1; d <= dim; d++) {
            if (rule.weekdays.includes(new Date(y, m, d).getDay())) {
              ds = dateStr(y, m, d);
              break;
            }
          }
          openDay(ds, rule.id);
        }}
      />

      <div className="weekdays">
        <div style={{ color: 'var(--sun)' }}>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div style={{ color: 'var(--sat)' }}>토</div>
      </div>

      <div className="grid">
        {weeks.map((week, wi) => {
          const segments: Record<string, { minCol: number; maxCol: number; title: string; color: string; startDs: string }> = {};
          week.forEach((cell, col) => {
            if (!cell.ds) return;
            data.events.filter((e) => e.date === cell.ds && e.groupId).forEach((ev) => {
              const mem = memberById(data, ev.memberId);
              if (!segments[ev.groupId as string]) {
                segments[ev.groupId as string] = { minCol: col, maxCol: col, title: ev.title, color: mem ? mem.color : '#999', startDs: cell.ds as string };
              } else {
                segments[ev.groupId as string].maxCol = col;
              }
            });
          });
          const bars = Object.values(segments);
          const spacerHeight = bars.length > 0 ? bars.length * 16 : 0;
          const overlayTop = 33;

          return (
            <div className="week-wrap" key={wi}>
              <div className="week-cells">
                {week.map((cell, ci) => {
                  if (!cell.day || !cell.ds) return <div className="cell empty" key={ci} />;
                  const ds = cell.ds;
                  const dow = new Date(y, m, cell.day).getDay();
                  const holidayName = HOLIDAYS[ds];
                  let cls = 'cell';
                  if (ds === today) cls += ' today';
                  if (holidayName) cls += ' holiday';
                  else if (dow === 0) cls += ' sun';
                  else if (dow === 6) cls += ' sat';

                  const allDayEvents = (getEventsForDate(data, ds) as DisplayEvent[]).filter((e) => !e.groupId);
                  const recurringEvents = allDayEvents.filter((e) => e.isRecurring);
                  const dayEvents = allDayEvents.filter((e) => !e.isRecurring);
                  const shown = dayEvents.slice(0, 3);

                  return (
                    <div className={cls} key={ci} onClick={() => openDay(ds)}>
                      <div className="cell-head">
                        <div className="date-num">{cell.day}</div>
                        {holidayName && <div className="holiday-label">{holidayName}</div>}
                      </div>
                      {spacerHeight > 0 && <div style={{ height: spacerHeight }} />}
                      {recurringEvents.map((ev) => {
                        const mem = memberById(data, ev.memberId);
                        return (
                          <div
                            className="mini-bar"
                            key={ev.id}
                            style={{ background: mem ? mem.color : '#999' }}
                            onClick={(e2) => { e2.stopPropagation(); openDay(ds, ev.id); }}
                          >
                            {ev.title}
                          </div>
                        );
                      })}
                      {shown.map((ev) => {
                        const mem = memberById(data, ev.memberId);
                        const bg = ev.isNotice ? '#111111' : mem ? mem.color : '#999';
                        const prefix = ev.isNotice ? '📌 ' : '';
                        return (
                          <div
                            className="note"
                            key={ev.id}
                            style={{ background: bg }}
                            onClick={(e2) => { e2.stopPropagation(); openDay(ds, ev.id); }}
                          >
                            {prefix}{ev.time ? ev.time + ' ' : ''}{ev.title}
                          </div>
                        );
                      })}
                      {dayEvents.length > 3 && <div className="more-tag">+{dayEvents.length - 3}개 더</div>}
                    </div>
                  );
                })}
              </div>
              {bars.length > 0 && (
                <div className="week-bars" style={{ top: overlayTop, height: spacerHeight }}>
                  {bars.map((bar, idx) => (
                    <div
                      className="range-bar"
                      key={idx}
                      style={{
                        left: `calc(${(bar.minCol * 100) / 7}% + 2px)`,
                        width: `calc(${((bar.maxCol - bar.minCol + 1) * 100) / 7}% - 4px)`,
                        top: idx * 16,
                        background: bar.color,
                      }}
                      onClick={() => openDay(bar.startDs)}
                    >
                      {bar.title}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="legend">
        <span style={{ color: 'var(--sun)' }}>■ 일요일·공휴일</span>
        <span style={{ color: 'var(--sat)' }}>■ 토요일</span>
      </div>

      <div className="quick-add">
        <label className="quick-add-label">✏️ 일정 빠르게 추가</label>

        <div className="field">
          <label>담당자</label>
          <div className="member-pick">
            {data.members.map((mem) => (
              <div key={mem.id} className={`chip${qMemberId === mem.id ? ' selected' : ''}`} onClick={() => setQMemberId(mem.id)}>
                <MemberBadge data={data} memberId={mem.id} size={20} />
                <span>{mem.name}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="field">
          <label>제목</label>
          <input type="text" maxLength={40} placeholder="예: 수영, 시즈오카 여행" value={qTitle} onChange={(e) => setQTitle(e.target.value)} />
        </div>

        <div className="field">
          <label>일정 종류</label>
          <div className="member-pick">
            <div className={`chip${qType === 'once' ? ' selected' : ''}`} onClick={() => setQType('once')}><span>하루</span></div>
            <div className={`chip${qType === 'range' ? ' selected' : ''}`} onClick={() => setQType('range')}><span>여러 날</span></div>
            <div className={`chip${qType === 'weekly' ? ' selected' : ''}`} onClick={() => setQType('weekly')}><span>매주 반복</span></div>
          </div>
        </div>

        {qType === 'once' && (
          <div className="field">
            <label>날짜</label>
            <input type="date" value={qDate} onChange={(e) => setQDate(e.target.value)} />
          </div>
        )}

        {qType === 'range' && (
          <div className="field">
            <label>시작일 ~ 종료일</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="date" value={qStartDate} onChange={(e) => setQStartDate(e.target.value)} />
              <input type="date" value={qEndDate} min={qStartDate || undefined} onChange={(e) => setQEndDate(e.target.value)} />
            </div>
          </div>
        )}

        {qType === 'weekly' && (
          <div className="field">
            <label>반복 요일</label>
            <div className="member-pick">
              {DAY_NAMES.map((label, w) => (
                <div key={w} className={`chip${qWeekdays.includes(w) ? ' selected' : ''}`} onClick={() => toggleQWeekday(w)}>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="field">
          <label>시간 (선택)</label>
          <input type="time" value={qTime} onChange={(e) => setQTime(e.target.value)} />
        </div>

        <div className="field">
          <label>메모 (선택)</label>
          <input type="text" maxLength={100} value={qMemo} onChange={(e) => setQMemo(e.target.value)} />
        </div>

        <div className="notice-actions">
          <span className={`quick-add-status${quickStatus.error ? ' error' : ''}`}>{quickStatus.text}</span>
          <button className="btn btn-primary" onClick={quickAdd}>추가</button>
        </div>
      </div>

      <div className="footer-row">
        <button className="reset-link" onClick={resetAll}>전체 데이터 초기화</button>
      </div>
      </div>
      )}

      {dayOpen && activeDs && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setDayOpen(false); }}>
          <div className="modal">
            <h2>{Number(activeDs.split('-')[1])}월 {Number(activeDs.split('-')[2])}일 일정{HOLIDAYS[activeDs] ? ` (${HOLIDAYS[activeDs]})` : ''}</h2>
            <div className="day-events-list">
              {(getEventsForDate(data, activeDs) as DisplayEvent[]).map((ev) => (
                <div className="day-event-row" key={ev.id} onClick={() => handleRowClick(ev)}>
                  <MemberBadge data={data} memberId={ev.memberId} isNotice={ev.isNotice} size={18} />
                  <span className="txt">{ev.isNotice ? '📌 ' : ev.isRecurring ? '🔁 ' : ''}{ev.title}</span>
                  <span className="time">{ev.time || ''}</span>
                </div>
              ))}
            </div>
            <div className="field">
              <label>제목</label>
              <input type="text" maxLength={40} placeholder="예: 병원 예약" value={fTitle} onChange={(e) => setFTitle(e.target.value)} />
            </div>
            <div className="field">
              <label>시간 (선택)</label>
              <input type="time" value={fTime} onChange={(e) => setFTime(e.target.value)} />
            </div>
            {!editingId && (
              <div className="field">
                <label>종료일 (선택 — 여러 날짜에 걸친 일정이면)</label>
                <input type="date" min={activeDs || undefined} value={fEndDate} onChange={(e) => setFEndDate(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label>누구 일정인가요?</label>
              <div className="member-pick">
                {data.members.map((mem) => (
                  <div
                    key={mem.id}
                    className={`chip${fMemberId === mem.id ? ' selected' : ''}`}
                    onClick={() => setFMemberId(mem.id)}
                  >
                    <MemberBadge data={data} memberId={mem.id} size={20} />
                    <span>{mem.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="field">
              <label>메모 (선택)</label>
              <textarea maxLength={200} value={fMemo} onChange={(e) => setFMemo(e.target.value)} />
            </div>
            <div className={`quick-add-status${formStatus.error ? ' error' : ''}`}>{formStatus.text}</div>
            <div className="modal-actions">
              {editingId && <button className="btn btn-danger" onClick={deleteEvent}>삭제</button>}
              <div style={{ flex: 1 }} />
              <button className="btn btn-secondary" onClick={() => setDayOpen(false)}>닫기</button>
              <button className="btn btn-primary" disabled={formBusy} onClick={saveEvent}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
