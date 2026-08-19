import { ImageResponse } from 'next/og';

export const alt = 'Pomodoro Together — 一緒なら、集中は続けやすい。';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 90, color: '#f8fafc', background: 'radial-gradient(circle at 15% 0%, #164e63, #070b17 60%)', fontFamily: 'sans-serif' }}><div style={{ color: '#67e8f9', fontSize: 28, letterSpacing: 6, textTransform: 'uppercase' }}>Focus together</div><div style={{ marginTop: 25, fontSize: 82, fontWeight: 800, letterSpacing: -4 }}>Pomodoro Together</div><div style={{ marginTop: 28, color: '#cbd5e1', fontSize: 38 }}>一緒なら、集中は続けやすい。</div><div style={{ marginTop: 55, display: 'flex', gap: 18 }}><span style={{ background: '#fb7185', borderRadius: 999, padding: '12px 24px', color: '#19080c', fontWeight: 700 }}>25:00 集中</span><span style={{ border: '2px solid #334155', borderRadius: 999, padding: '12px 24px' }}>リアルタイム共有</span></div></div>, size);
}
