import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Nav } from "@/components/Nav";
import { UploadManagerProvider } from "@/components/UploadManager";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Alexandria All on four Lab",
  description: "Case management for Alexandria All on four Lab",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background md:flex-row">
        <UploadManagerProvider>
          <Nav />
          <main className="min-w-0 flex-1">{children}</main>
        </UploadManagerProvider>
      </body>
    </html>
  );
}
