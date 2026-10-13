import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Fun Mini Soccer — Every Match Matters.",
  description:
    "Buat kompetisi, kelola pertandingan, dan pantau klasemen mini soccer dalam satu tempat.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
