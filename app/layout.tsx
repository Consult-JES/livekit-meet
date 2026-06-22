import '../styles/globals.css';
import '@livekit/components-styles';
import '@livekit/components-styles/prefabs';
import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://meet.accredit.store'),
  title: {
    default: 'Accredit Meet',
    template: '%s · Accredit Meet',
  },
  description: 'Secure video conferencing for Accredit courses and events.',
  openGraph: {
    title: 'Accredit Meet',
    images: [
      {
        url: '/images/accredit-open-graph.png',
        width: 1024,
        height: 1024,
        type: 'image/png',
      },
    ],
    siteName: 'Accredit Meet',
  },
  icons: {
    icon: [
      { rel: 'icon', url: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'icon', url: '/favicon.ico', sizes: 'any' },
    ],
    apple: [{ rel: 'apple-touch-icon', url: '/images/accredit-apple-touch.png', sizes: '180x180' }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#0F172A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-lk-theme="default">
        <Toaster />
        {children}
      </body>
    </html>
  );
}
