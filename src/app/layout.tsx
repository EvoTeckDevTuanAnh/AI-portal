import type { Metadata } from "next";
import GlobalChatBox from "@/components/global-chat-box";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Portal",
  description: "AI portal dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}<GlobalChatBox /></body>
    </html>
  );
}
