import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EPAM Ping Pong Tournament",
  description: "EPAM office ping pong tournament bracket — live results",
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
