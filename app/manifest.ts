import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'APEDAT',
    short_name: 'APEDAT',
    description: 'APEDAT financial markets and wallet platform.',
    start_url: '/',
    display: 'standalone',
    background_color: '#0D0F11',
    theme_color: '#0D0F11',
    icons: [
      { src: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
