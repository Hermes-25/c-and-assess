import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' });

export const metadata: Metadata = {
  title: 'C&Assess | Assessment Platform',
  description: 'Online assessments, mock tests and performance analysis for C&A initiatives by Consulting & Analytics Club, IIT Guwahati.',
  openGraph: {
    title: 'C&Assess | Assessment Platform',
    description: 'Online assessments, mock tests and performance analysis for C&A initiatives by Consulting & Analytics Club, IIT Guwahati.',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'C&Assess | Assessment Platform',
    description: 'Online assessments, mock tests and performance analysis for C&A initiatives by Consulting & Analytics Club, IIT Guwahati.',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={montserrat.variable}>{children}</body></html>;
}
