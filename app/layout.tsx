import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Narrow } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

// Two weights of one superfamily, used with discipline (§4.3).
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  display: "swap",
});

const archivoNarrow = Archivo_Narrow({
  variable: "--font-archivo-narrow",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

// Run the server functions next to the Supabase database (eu-west-1, Ireland)
// so page data doesn't round-trip across the Atlantic on every navigation.
export const preferredRegion = "dub1";

export const metadata: Metadata = {
  title: "The Threeball",
  description: "A private league. Three players. One president. No appeals.",
  applicationName: "The Threeball",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "The Threeball",
  },
};

// theme_color matches the ink token (§6.5); paper background behind it.
export const viewport: Viewport = {
  themeColor: "#16241b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // let content extend into the safe-area insets (§10)
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoNarrow.variable} h-full`}
    >
      <body className="min-h-[100dvh] flex flex-col">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
