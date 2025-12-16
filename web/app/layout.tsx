import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "niels-gpt",
  description: "tiny llm with attention visualization",
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
