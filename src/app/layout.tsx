import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Test Scripts · Luzid",
  description:
    "Turn a screen recording into an editable test script with steps and screenshots.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
