import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";

export const metadata: Metadata = {
  title: "EcoTani - Solusi Mitigasi Risiko Gagal Panen & Geospatial Pertanian",
  description: "EcoTani menghadirkan platform pemetaan sawah berbasis data geospasial dan satelit real-time untuk mendeteksi anomali cuaca, cek kelayakan lahan, dan mengamankan panen Anda.",
  manifest: "/manifest.json",
  icons: {
    icon: "/assets/logo.webp",
    apple: "/assets/logo.webp",
  }
};

export const viewport: Viewport = {
  themeColor: "#0c0c0c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full scroll-smooth dark">
      <body className="antialiased bg-bg-dark text-text-main min-h-screen flex flex-col">
        {children}
      </body>
    </html>
  );
}
