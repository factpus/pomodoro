import Link from 'next/link';
import type { ReactNode } from 'react';

export default function InfoPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  return (
    <main className="info-shell">
      <nav className="info-nav"><Link href="/" className="brand">Pomodoro Together</Link><Link className="button button-secondary" href="/">タイマーを使う</Link></nav>
      <article className="info-article"><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{children}</article>
      <footer className="info-footer"><Link href="/guide">使い方</Link><Link href="/faq">FAQ</Link><Link href="/about">About</Link><Link href="/privacy">プライバシー</Link><Link href="/terms">利用規約</Link><Link href="/contact">問い合わせ</Link></footer>
    </main>
  );
}
