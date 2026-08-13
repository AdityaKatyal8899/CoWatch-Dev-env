import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/index.css';
import { Toaster } from './components/ui/sonner';
import ProgressBar from './components/ui/ProgressBar';
import { AuthProvider } from './lib/auth';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'CoWatch - Watch Videos Together in Real-Time',
    template: '%s | CoWatch'
  },
  description: 'Synchronized video playback, real-time voice rooms, and chat for friends and communities. Host watch parties instantly.',
  keywords: [
    'watch together', 'watch party', 'synchronized video', 'co-watch', 
    'stream movies with friends', 'virtual cinema', 'youtube sync', 'voice chat watch party'
  ],
  authors: [{ name: 'CoWatch Team' }],
  creator: 'CoWatch',
  icons: {
    icon: '/icon.ico',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://cowatch-theta.vercel.app',
    siteName: 'CoWatch',
    title: 'CoWatch - Watch Videos Together in Real-Time',
    description: 'Synchronize videos, chat, and talk with friends. Free and premium social streaming room hosting.',
    images: [
      {
        url: 'https://cowatch-theta.vercel.app/icon.ico',
        width: 512,
        height: 512,
        alt: 'CoWatch Watch Party Platform',
      }
    ],
  },
  twitter: {
    card: 'summary',
    title: 'CoWatch - Watch Videos Together',
    description: 'Synchronize videos, chat, and voice chat with your friends in real-time.',
    images: ['https://cowatch-theta.vercel.app/icon.ico'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

import { ThemeProvider } from './components/ThemeProvider';
import { Suspense } from 'react';
import { BackgroundNotificationListener } from './components/BackgroundNotificationListener';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <AuthProvider>
            <ThemeProvider>
              <BackgroundNotificationListener />
              <Suspense fallback={null}>
                <ProgressBar />
              </Suspense>
              {children}
              <Toaster 
                position="bottom-left"
                toastOptions={{
                  style: {
                    background: '#1a1a1a',
                    border: '1px solid rgba(124, 58, 237, 0.3)',
                    color: '#fff',
                  },
                  className: 'glass-card',
                }}
              />
            </ThemeProvider>
          </AuthProvider>
        </GoogleOAuthProvider>
      </body>
    </html>
  );
}
