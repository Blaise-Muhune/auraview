import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Aura - Global Friend Group Ranking App",
  description: "Rank your friends' aura based on personality, achievements, and character. Join the global community and discover who has the highest aura ranking worldwide.",
  keywords: ["aura", "friend ranking", "social app", "personality rating", "group ranking"],
  authors: [{ name: "Aura Team" }],
  creator: "Aura",
  publisher: "Aura",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  viewport: {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#8b5cf6' },
    { media: '(prefers-color-scheme: dark)', color: '#7c3aed' },
  ],
  manifest: '/api/manifest',
  icons: {
    icon: [
      { url: '/logo.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo.png', sizes: '16x16', type: 'image/png' },
      { url: '/logo.png', sizes: '192x192', type: 'image/png' },
      { url: '/logo.png', sizes: '512x512', type: 'image/png' },
    ],
    shortcut: '/logo.png',
    apple: [
      { url: '/logo.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Aura',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://aura-app.com',
    title: 'Aura - Global Friend Group Ranking App',
    description: 'Rank your friends\' aura based on personality, achievements, and character.',
    siteName: 'Aura',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aura - Global Friend Group Ranking App',
    description: 'Rank your friends\' aura based on personality, achievements, and character.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#8b5cf6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Aura" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className="antialiased flex flex-col min-h-screen">
        <ThemeProvider>
          <div className="flex-1 flex flex-col min-h-screen">
            {children}
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
