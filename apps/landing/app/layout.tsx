import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Transcribe-X - AI-Powered Transcription",
  description: "Transform your audio and video into accurate transcripts with AI-powered transcription technology.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

