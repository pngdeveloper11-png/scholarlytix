import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
// Pointing to the trusted components folder now!
import { ThemeProvider } from '@/components/ThemeContext'; 

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Scholarlytix',
  description: 'The Intelligent EdTech Ecosystem',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}