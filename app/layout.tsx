import './globals.css';
import type { Metadata } from 'next';

// 이 페이지가 정적으로 캐시되어 "오늘" 날짜 표시가 오래된 상태로 굳는 것을 방지 —
// 매 요청마다 새로 렌더링하도록 강제
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '호 가족 일정',
  description: '호네 가족 공유 캘린더',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover" />
        <link
          rel="stylesheet"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@latest/dist/web/variable/pretendardvariable.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
