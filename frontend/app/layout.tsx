import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CAD Area Extractor",
  description: "Upload an AutoCAD drawing and get room sizes and areas for every floor.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
