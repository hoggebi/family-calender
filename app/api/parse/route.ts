import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { HOLIDAYS } from '@/lib/holidays';

// Vercel 서버리스 함수 기본 제한(보통 10초)보다 여유를 두어
// Gemini 응답이 조금 늦어도 중간에 끊기지 않도록 함
export const maxDuration = 30;

// 기존 오늘도 호 English 앱(lib/gemini.ts)과 동일한 방식으로 GEMINI_API_KEY를 사용합니다.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });
const MODEL = 'gemini-3.6-flash';

// 매번 3년치 공휴일(약 40개)을 전부 프롬프트에 넣으면 속도가 느려지므로,
// 오늘 기준 앞뒤 몇 달치만 추려서 보냄 (프롬프트 크기 = 응답 속도에 직결)
function nearbyHolidays(todayIso: string) {
  const start = new Date(todayIso + 'T00:00:00');
  start.setMonth(start.getMonth() - 2);
  const end = new Date(todayIso + 'T00:00:00');
  end.setMonth(end.getMonth() + 8);
  const startStr = start.toISOString().slice(0, 10);
  const endStr = end.toISOString().slice(0, 10);
  const out: Record<string, string> = {};
  for (const [d, name] of Object.entries(HOLIDAYS)) {
    if (d >= startStr && d <= endStr) out[d] = name;
  }
  return out;
}

function buildQuickAddPrompt(todayIso: string, membersList: string) {
  return `너는 한국어 가족 캘린더의 빠른입력 문장을 분석해서 JSON으로만 응답하는 파서야. 설명, 인사말, 코드블록 없이 JSON 객체 하나만 출력해.
현재 날짜: ${todayIso}
등록된 가족 구성원 이름: ${membersList}
공휴일/명절 참고자료 (YYYY-MM-DD: 이름): ${JSON.stringify(nearbyHolidays(todayIso))}

다음 스키마의 JSON만 출력해:
{
  "personLabel": string,
  "title": string,
  "time": string|null,
  "type": "once" | "range" | "weekly",
  "date": string|null,
  "startDate": string|null,
  "endDate": string|null,
  "weekdays": number[]|null,
  "memo": string|null
}
규칙:
- personLabel: 문장에서 언급된 사람. 등록된 가족 구성원 이름과 최대한 일치시켜 그 이름 그대로 적어. 애매하면 "미지정".
- title: 사람 이름과 요일/시간을 뺀 짧은 활동/일정 제목.
- time: "오전 9시", "저녁 7시반" 같은 표현을 "HH:MM" 24시간제로 변환. 시간 언급이 없으면 null.
- type: 특정 요일에 매주 반복되면 "weekly", 시작일~종료일이 있는 여러 날짜면 "range", 하루짜리 일정이면 "once".
- weekdays: 0=일,1=월,2=화,3=수,4=목,5=금,6=토.
- 날짜는 공휴일 참고자료와 현재 날짜를 기준으로 올바른 연도의 YYYY-MM-DD로 계산해.
- 날짜를 전혀 특정할 수 없으면 type은 "once", date는 오늘 날짜로 해.
- 다른 설명 없이 JSON만, 최대한 짧고 빠르게 출력해.`;
}

function buildNoticePrompt(todayIso: string, ky: number, km: number) {
  return `너는 한국어 공지사항 문장에서 날짜를 찾아 JSON으로만 응답하는 파서야. 설명, 인사말, 코드블록 없이 JSON 객체 하나만 출력해.
현재 날짜: ${todayIso}
이 문장은 ${ky}년 ${km}월 공지사항 목록에 적힌 거야. "15일"처럼 일자만 있으면 ${ky}년 ${km}월로 간주해.
공휴일/명절 참고자료 (YYYY-MM-DD: 이름): ${JSON.stringify(nearbyHolidays(todayIso))}

스키마: {"date": "YYYY-MM-DD" 또는 null}
문장에서 특정 날짜(또는 명절 이름)를 찾을 수 있으면 date를 채우고, 날짜를 전혀 알 수 없으면 null로 해.
다른 설명 없이 JSON만, 최대한 짧고 빠르게 출력해.`;
}

export async function POST(req: Request) {
  try {
    const { mode, text, members, monthKey } = await req.json();
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'text_required' }, { status: 400 });
    }
    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);

    let systemInstruction: string;
    if (mode === 'notice') {
      const [kyStr, kmStr] = (monthKey || todayIso.slice(0, 7)).split('-');
      systemInstruction = buildNoticePrompt(todayIso, Number(kyStr), Number(kmStr));
    } else {
      const membersList = Array.isArray(members) && members.length ? members.join(', ') : '(없음)';
      systemInstruction = buildQuickAddPrompt(todayIso, membersList);
    }

    const response = await ai.models.generateContent({
      model: MODEL,
      contents: text,
      config: {
        systemInstruction,
        temperature: 0,
        maxOutputTokens: 300,
        // 지원되는 모델이면 "생각하는 시간"을 꺼서 단순 추출 작업 속도를 높임
        // (지원 안 하는 모델이면 이 필드는 무시됨)
        thinkingConfig: { thinkingBudget: 0 },
      } as any,
    });

    const raw = response.text ?? '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return NextResponse.json(parsed);
  } catch (e) {
    console.error('parse error', e);
    return NextResponse.json({ error: 'parse_failed' }, { status: 500 });
  }
}
