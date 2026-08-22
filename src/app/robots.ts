import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://pomodoro-app-five-khaki.vercel.app').replace(/\/$/, '');
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/room/'] }, sitemap: `${base}/sitemap.xml` };
}
