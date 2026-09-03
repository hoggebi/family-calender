import { Redis } from '@upstash/redis';

// 기존 오늘도 호 English 앱과 같은 Upstash Redis 프로젝트를 재사용해도 되고,
// 새 Upstash 데이터베이스를 만들어도 됩니다. 어느 쪽이든 이 프로젝트의
// Vercel 환경변수에 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 을 넣어주세요.
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL as string,
  token: process.env.UPSTASH_REDIS_REST_TOKEN as string,
});

// 다른 프로젝트(오늘도 호 English)의 동기화 키와 겹치지 않도록 전용 prefix 사용
export const CALENDAR_KEY = 'family-calendar:data:v1';
