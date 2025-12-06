import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { Analytics } from "@vercel/analytics/next";
import NotificationPermissionBlocked from "@/components/firebase/NotificationPermissionBlocked";
// import { WebSocketProvider } from "@/lib/WebSocketContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: 'Real-time Chat App',
  description: 'A real-time chat application built with Next.js and TypeScript',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {/* <WebSocketProvider> */}
            {children}
            <Analytics />

            {/* ✅ Show notification blocked warning globally */}
            <NotificationPermissionBlocked />
          {/* </WebSocketProvider> */}
        </AuthProvider>
      </body>
    </html>
  );
}
