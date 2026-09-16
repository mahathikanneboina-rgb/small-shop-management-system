import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ShopProvider } from '../context/ShopContext';
import { AuthProvider } from '../context/AuthContext';
import { AppLayout } from '../components/layout/AppLayout';

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Small Shop Management System',
  description: 'Clean and simple retail shop management system for small businesses',
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <ShopProvider>
            <AppLayout>{children}</AppLayout>
          </ShopProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
