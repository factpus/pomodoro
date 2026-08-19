import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return { name: 'Pomodoro Together', short_name: 'Pomodoro', description: '仲間と集中時間を共有するポモドーロタイマー', start_url: '/', display: 'standalone', background_color: '#070b17', theme_color: '#070b17', lang: 'ja', icons: [{ src: '/favicon.ico', sizes: 'any', type: 'image/x-icon' }] };
}
