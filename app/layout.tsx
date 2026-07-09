import type { Metadata } from 'next';
import { Inter, Outfit } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit' });

export const metadata: Metadata = {
  title: 'MoodFlix — The Cinematic AI Recommender',
  description: 'Answer a few mood questions and let AI find the perfect movie for you tonight.',
  keywords: ['movie recommender', 'AI movies', 'mood-based movies', 'film recommendations'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="bg-background text-foreground antialiased font-sans selection:bg-primary/30 min-h-screen">
        {children}
      </body>
    </html>
  );
}
