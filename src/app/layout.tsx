import type { Metadata, Viewport } from "next";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "EcoTani",
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
    <html lang="id" className={cn("h-full scroll-smooth dark", "font-sans", jakarta.variable)}>
      <body className="antialiased bg-bg-dark text-text-main min-h-screen flex flex-col">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
