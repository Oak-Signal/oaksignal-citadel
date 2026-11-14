import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Geist_Mono } from "next/font/google";
import { buttonVariants } from "@/components/ui/button";
import "./globals.css";

// 404 for URLs that match no route in either root layout. Signed-out visitors to unknown,
// non-public URLs are sent to sign-in by proxy.ts first (fail-closed), so this is mostly seen
// by signed-in members.

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
  title: "Page not found · CITADEL",
  description: "The page you are looking for does not exist.",
};

export default function GlobalNotFound() {
  return (
    <html lang="en" className={`${inter.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-4 py-16">
          <p className="text-lg font-bold tracking-[0.2em] text-primary">CITADEL</p>
          <h1 className="text-3xl font-semibold">Page not found</h1>
          <p className="text-muted-foreground">
            The page you are looking for does not exist or may have moved.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/" className={buttonVariants()}>
              Go to home page
            </Link>
            <Link href="/sign-in" className={buttonVariants({ variant: "outline" })}>
              Sign in
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
