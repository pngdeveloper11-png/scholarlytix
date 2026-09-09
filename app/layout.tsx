import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import PushNotificationManager from '../components/PushNotificationManager'; 

const inter = Inter({ subsets: ['latin'] });

// Required for PWA mobile rendering
export const viewport: Viewport = {
  themeColor: '#D0BCFF',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: 'Scholarlytix',
  description: 'The Intelligent EdTech Ecosystem',
  manifest: '/manifest.json', 
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ThemeProvider>
          <AuthProvider>
            <PushNotificationManager />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}