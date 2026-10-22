import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "./ConvexClientProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CITADEL (CIMS)",
  description: "Oak Signal inventory management for cadet units",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Suspense>
          <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up" afterSignOutUrl="/sign-in">
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </ClerkProvider>
        </Suspense>
      </body>
    </html>
  );
}
