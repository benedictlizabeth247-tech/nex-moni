import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { brand } from '@/lib/brand'

export const metadata: Metadata = {
  title: `${brand.name} | Your financial command center`,
  description: brand.description,
  generator: brand.name,
  applicationName: brand.name,
  openGraph: { title: brand.name, description: brand.description, images: [brand.logo] },
  twitter: { card: 'summary_large_image', title: brand.name, description: brand.description, images: [brand.logo] },
  icons: { icon: brand.icon, apple: brand.icon },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0D0F11' },
    { media: '(prefers-color-scheme: dark)', color: '#0D0F11' },
  ],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="bg-background">
      <body className="antialiased font-sans">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
