import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ping Pong Tournament",
  description: "Live single-elimination ping pong tournament bracket",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-bg-primary text-text-primary font-display">
        {children}
      </body>
    </html>
  );
}
