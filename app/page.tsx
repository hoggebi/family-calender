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
  findMemberByLabel,
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

export default function Home() {
  const [data, setData] = useState<CalendarData>(EMPTY_DATA);
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
  const [formStatus, setFormStatus] = useState<{ text: string; error?: boolean }>({ text: '' });
  const [formBusy, setFormBusy] = useState(false);

  // quick add
  const [quickText, setQuickText] = useState('');
  const [quickStatus, setQuickStatus] = useState<{ text: string; error?: boolean }>({ text: '' });
  const [quickBusy, setQuickBusy] = useState(false);

  // notice
  const [noticeText, setNoticeText] = useState('');
  const [noticeStatus, setNoticeStatus] = useState<{ text: string; error?: boolean }>({ text: '' });
  const [noticeBusy, setNoticeBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/calendar');
        const json = (await res.json()) as CalendarData;
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

  function clearForm() {
    setEditingId(null);
    setFTitle('');
    setFTime('');
    setFMemo('');
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

  async function quickAdd() {
    const text = quickText.trim();
    if (!text) return;
    setQuickBusy(true);
    setQuickStatus({ text: 'AI가 문장을 읽고 있어요…' });
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'quick', text, members: data.members.map((mm) => mm.name) }),
      });
      const parsed = await res.json();
      if (parsed.error) throw new Error('parse failed');

      let memberId: string | null = null;
      if (parsed.personLabel && parsed.personLabel !== '미지정') {
        memberId = findMemberByLabel(data, parsed.personLabel);
      }
      const title = (parsed.title || text).trim();
      const time = parsed.time || '';
      const memo = parsed.memo || '';
      let confirmMsg = '';
      let next: CalendarData = data;

      if (parsed.type === 'weekly' && Array.isArray(parsed.weekdays) && parsed.weekdays.length) {
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        next = {
          ...data,
          recurring: [
            ...data.recurring,
            { id: 'r_' + Date.now(), memberId, personLabel: parsed.personLabel || '', title, time, weekdays: parsed.weekdays, memo },
          ],
        };
        confirmMsg = `매주 ${parsed.weekdays.map((w: number) => dayNames[w]).join(',')} 반복 일정으로 등록했어요: ${title}`;
      } else if (parsed.type === 'range' && parsed.startDate && parsed.endDate) {
        const groupId = 'g_' + Date.now();
        const events = [...data.events];
        let dcur = new Date(parsed.startDate + 'T00:00:00');
        const dend = new Date(parsed.endDate + 'T00:00:00');
        let count = 0;
        while (dcur <= dend && count < 31) {
          const ds = dateStr(dcur.getFullYear(), dcur.getMonth(), dcur.getDate());
          events.push({ id: 'e_' + Date.now() + '_' + count, date: ds, title, time, memberId, memo, groupId });
          dcur.setDate(dcur.getDate() + 1);
          count++;
        }
        next = { ...data, events };
        confirmMsg = `${parsed.startDate} ~ ${parsed.endDate} 일정으로 등록했어요: ${title}`;
      } else if (parsed.date) {
        next = { ...data, events: [...data.events, { id: 'e_' + Date.now(), date: parsed.date, title, time, memberId, memo }] };
        confirmMsg = `${parsed.date} 일정으로 등록했어요: ${title}`;
      } else {
        throw new Error('no date resolved');
      }

      if (parsed.personLabel && parsed.personLabel !== '미지정' && !memberId) {
        confirmMsg += ` ('${parsed.personLabel}'님은 가족 목록에 없어 색상 없이 등록했어요)`;
      }

      const ok = await persist(next);
      if (!ok) {
        setQuickStatus({ text: '저장에 실패했어요. 다시 시도해주세요.', error: true });
      } else {
        setQuickText('');
        setQuickStatus({ text: confirmMsg });
      }
    } catch (e) {
      setQuickStatus({ text: '문장을 이해하지 못했어요. 예: "호할아버지 화,목 오전 9시 수영"처럼 다시 적어주세요.', error: true });
    } finally {
      setQuickBusy(false);
    }
  }

  async function addNotice() {
    const val = noticeText.trim();
    if (!val) return;
    setNoticeBusy(true);
    setNoticeStatus({ text: 'AI가 날짜를 확인하고 있어요…' });
    const notice = { id: 'n_' + Date.now(), text: val, date: null as string | null, eventId: null as string | null };
    let events = data.events;
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'notice', text: val, monthKey: mKey }),
      });
      const parsed = await res.json();
      if (parsed && parsed.date) {
        const eventId = 'e_' + Date.now();
        events = [...events, { id: eventId, date: parsed.date, title: val, time: '', memberId: null, memo: '', isNotice: true, noticeId: notice.id }];
        notice.date = parsed.date;
        notice.eventId = eventId;
      }
    } catch (e) {
      // 날짜를 못 찾아도 공지 목록엔 남긴다
    }
    const notices = { ...data.notices, [mKey]: [...(data.notices[mKey] || []), notice] };
    const ok = await persist({ ...data, events, notices });
    setNoticeBusy(false);
    if (!ok) {
      setNoticeStatus({ text: '저장에 실패했어요. 다시 시도해주세요.', error: true });
      return;
    }
    setNoticeText('');
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
          placeholder="예: 15일 학부모 참관수업, 20일 관리비 납부일"
          value={noticeText}
          onChange={(e) => setNoticeText(e.target.value)}
        />
        <div className="notice-actions">
          <span className={`notice-status${noticeStatus.error ? ' error' : ''}`}>{noticeStatus.text}</span>
          <button className="btn btn-primary" disabled={noticeBusy} onClick={addNotice}>추가</button>
        </div>
      </div>

      <div className="family-strip">
        {data.members.map((mem) => (
          <div className="chip" key={mem.id}>
            <MemberBadge data={data} memberId={mem.id} size={26} />
            <span>{mem.name}</span>
          </div>
        ))}
      </div>

      <div className="nav-row">
        <button className="nav-btn" aria-label="이전 달" onClick={() => setCur(new Date(y, m - 1, 1))}>‹</button>
        <div className="month-label">{y}년 {m + 1}월</div>
        <button className="nav-btn" aria-label="다음 달" onClick={() => setCur(new Date(y, m + 1, 1))}>›</button>
        <button className="today-btn" onClick={() => { const d = new Date(); d.setDate(1); setCur(d); }}>오늘</button>
      </div>

      <div className="weekdays">
        <div style={{ color: 'var(--sun)' }}>일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div style={{ color: 'var(--sat)' }}>토</div>
      </div>

      <div className="grid">
        {weeks.map((week, wi) => {
          const segments: Record<string, { minCol: number; maxCol: number; title: string; color: string; startDs: string }> = {};
          let weekHasHoliday = false;
          week.forEach((cell, col) => {
            if (!cell.ds) return;
            if (HOLIDAYS[cell.ds]) weekHasHoliday = true;
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
          const spacerHeight = bars.length > 0 ? bars.length * 15 : 0;
          const overlayTop = 15 + (weekHasHoliday ? 10 : 0);

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

                  const dayEvents = (getEventsForDate(data, ds) as DisplayEvent[]).filter((e) => !e.groupId);
                  const shown = dayEvents.slice(0, 3);

                  return (
                    <div className={cls} key={ci} onClick={() => openDay(ds)}>
                      <div className="date-num">{cell.day}</div>
                      {holidayName && <div className="holiday-label">{holidayName}</div>}
                      {spacerHeight > 0 && <div style={{ height: spacerHeight }} />}
                      {shown.map((ev) => {
                        const mem = memberById(data, ev.memberId);
                        const bg = ev.isNotice ? '#111111' : mem ? mem.color : '#999';
                        const prefix = ev.isNotice ? '📌 ' : ev.isRecurring ? '🔁 ' : '';
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
                        top: idx * 15,
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
        <label className="quick-add-label">✏️ 빠른 일정 입력</label>
        <div className="quick-add-row">
          <input
            type="text"
            placeholder="예: 호할아버지 화,목 오전 9시 수영 / 나 추석연휴 25~28일 호랑 시즈오카"
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); quickAdd(); } }}
          />
          <button className="btn btn-primary" disabled={quickBusy} onClick={quickAdd}>추가</button>
        </div>
        <div className="quick-add-hint">문장으로 적으면 AI가 알아서 날짜를 읽고 달력에 넣어줘요. 매주 반복이면 "화,목마다"처럼, 여행처럼 며칠 이어지면 날짜 범위를 적어주세요.</div>
        <div className={`quick-add-status${quickStatus.error ? ' error' : ''}`}>{quickStatus.text}</div>
        {data.recurring.length > 0 && (
          <div>
            <div className="recurring-title">🔁 반복 일정</div>
            {data.recurring.map((r) => {
              const mem = memberById(data, r.memberId);
              const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
              const days = [...r.weekdays].sort().map((w) => dayNames[w]).join(',');
              return (
                <div className="recurring-row" key={r.id}>
                  <MemberBadge data={data} memberId={r.memberId} size={18} />
                  <span className="txt">{r.personLabel || mem?.name || '미지정'} · 매주 {days}{r.time ? ' ' + r.time : ''} {r.title}</span>
                  <button aria-label="반복 일정 삭제" onClick={() => deleteRecurring(r.id)}>×</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="footer-row">
        <button className="reset-link" onClick={resetAll}>전체 데이터 초기화</button>
      </div>

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
