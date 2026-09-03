import { NextResponse } from 'next/server';
import { redis, CALENDAR_KEY } from '@/lib/redis';
import { CalendarData, DEFAULT_MEMBERS, EMPTY_DATA } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const raw = await redis.get<CalendarData>(CALENDAR_KEY);
    if (!raw) {
      await redis.set(CALENDAR_KEY, EMPTY_DATA);
      return NextResponse.json(EMPTY_DATA);
    }
    // 예전 데이터에 필드가 없을 경우를 대비한 보정
    const data: CalendarData = {
      members: raw.members && raw.members.length ? raw.members : DEFAULT_MEMBERS,
      events: raw.events || [],
      recurring: raw.recurring || [],
      notices: raw.notices || {},
    };
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: 'load_failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CalendarData;
    if (!body || !Array.isArray(body.events)) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    await redis.set(CALENDAR_KEY, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}
