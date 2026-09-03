# 호 가족 일정

Vercel에 실제로 배포해서 가족 누구나(클로드 없이) 열면 바로 공유되는 캘린더입니다.
오늘도 호 English 앱과 같은 방식(Next.js + Vercel + Upstash Redis + Gemini API)으로 만들었습니다.

## 1. GitHub에 올리기

1. GitHub에서 새 저장소를 만듭니다 (예: `family-calendar`).
2. 이 폴더(family-calendar-app) 안의 파일 전부를 그 저장소에 올립니다.
   - 평소처럼 GitHub 앱(폰)으로 파일 하나씩 업로드해도 되고, 컴퓨터가 있다면 `git push`로 한번에 올려도 됩니다.

## 2. Vercel에 배포하기

1. https://vercel.com 에서 "Add New… → Project"
2. 방금 만든 GitHub 저장소를 선택해서 Import
3. Framework는 Next.js로 자동 인식됩니다. 그대로 Deploy 진행하지 말고, 아래 3번(환경변수) 먼저 넣고 Deploy 하세요.

## 3. 환경변수 설정 (Vercel 프로젝트 → Settings → Environment Variables)

기존 "오늘도 호 English" 프로젝트에서 쓰던 값을 그대로 복사해서 넣으면 됩니다.

| 이름 | 값 |
|---|---|
| `GEMINI_API_KEY` | 기존 프로젝트에 있는 값과 동일하게 |
| `UPSTASH_REDIS_REST_URL` | 기존 프로젝트에 있는 값과 동일하게 (같은 Upstash DB를 재사용해도 되고, 새로 하나 만들어도 됩니다) |
| `UPSTASH_REDIS_REST_TOKEN` | 기존 프로젝트에 있는 값과 동일하게 |

기존 프로젝트와 같은 Upstash DB를 재사용해도, 이 앱은 `family-calendar:data:v1` 이라는
전용 키(`lib/redis.ts`)만 쓰기 때문에 오늘도 호 English 데이터와 절대 섞이지 않습니다.

값을 다 넣은 뒤 Deploy를 누르면 끝입니다. 몇 분 뒤 `https://(프로젝트이름).vercel.app` 같은
진짜 주소가 생기고, 그 링크는 클로드 없이 아무 폰/컴퓨터에서 열어도 똑같이 저장되고 공유됩니다.

## 참고

- 가족 구성원(호 할아버지 / 호 할머니 / 호 엄마)은 코드에 고정되어 있습니다 (`lib/types.ts`의 `DEFAULT_MEMBERS`).
  이름·아이콘·색을 바꾸고 싶으면 그 파일만 수정하면 됩니다.
- 공휴일 데이터(`lib/holidays.ts`)는 2025~2027년까지 반영되어 있습니다. 이후 연도는 추가로 알려주시면 채워드릴게요.
- "빠른 일정 입력"과 "공지사항"의 AI 날짜 인식은 서버(`app/api/parse/route.ts`)에서 Gemini로 처리하므로,
  API 키가 브라우저에 노출되지 않습니다.
