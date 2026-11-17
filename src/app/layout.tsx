import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Store Sales Analytics', description: 'Sales and returns dashboard for May–October 2025' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
