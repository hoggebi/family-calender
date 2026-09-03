import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '호 가족 일정',
  description: '호네 가족 공유 캘린더',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover" />
      </head>
      <body>{children}</body>
    </html>
  );
}
