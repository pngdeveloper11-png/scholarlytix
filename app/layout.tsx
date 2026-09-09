import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeContext';
import { AuthProvider } from './context/AuthContext';
// 1. THE FIX: Imported the PushNotificationManager!
import PushNotificationManager from '../components/PushNotificationManager'; 

const inter = Inter({ subsets: ['latin'] });

// 2. THE FIX: This is how Next.js links the manifest.json automatically!
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