import type { Metadata } from 'next';
import './globals.css';
import { ShopProvider } from '../context/ShopContext';
import { AppLayout } from '../components/layout/AppLayout';

export const metadata: Metadata = {
  title: 'Small Shop Management System',
  description: 'Clean and simple retail shop management system for small businesses',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ShopProvider>
          <AppLayout>{children}</AppLayout>
        </ShopProvider>
      </body>
    </html>
  );
}
