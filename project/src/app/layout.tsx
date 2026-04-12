import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/index.css';
import { Toaster } from './components/ui/sonner';
import ProgressBar from './components/ui/ProgressBar';
import { AuthProvider } from './lib/auth';
import { GoogleOAuthProvider } from '@react-oauth/google';

const GOOGLE_CLIENT_ID = "248743347580-gu2jrqkl9najo0ar07ek6pnqj8davv92.apps.googleusercontent.com";

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CoWatch - Watch Videos Together',
  description: 'Synchronized video playback for friends and family.',
};

import { ThemeProvider } from './components/ThemeProvider';
import { Suspense } from 'react';

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
