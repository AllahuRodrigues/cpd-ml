import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import ChatAssistant from "@/components/ChatAssistant";

export const metadata: Metadata = {
  title: "CPD x ROLSHR Theme Analysis",
  description: "UNDP CPD theme-coding matrix and IRRF linkage review",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <Nav />
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6"
        >
          {children}
        </main>
        <ChatAssistant />
      </body>
    </html>
  );
}
