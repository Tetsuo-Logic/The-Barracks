import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Narrow, JetBrains_Mono, Chakra_Petch } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

// Archivo for body, JetBrains Mono for the HUD readouts (labels + numerals).
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

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono-jb",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

// Angular, tactical display face for the wordmark + big headings.
const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

// Run the server functions next to the Supabase database (eu-west-1, Ireland)
// so page data doesn't round-trip across the Atlantic on every navigation.
export const preferredRegion = "dub1";

export const metadata: Metadata = {
  title: "The Barracks",
  description: "Games-night ops for the squad. Roll call, deployment checks, and the tribunal. 🪖",
  applicationName: "The Barracks",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "The Barracks",
  },
};

// theme_color matches the command-black background.
export const viewport: Viewport = {
  themeColor: "#0b100e",
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
      suppressHydrationWarning
      className={`${archivo.variable} ${archivoNarrow.variable} ${jetbrainsMono.variable} ${chakraPetch.variable} h-full`}
    >
      <body className="min-h-[100dvh] flex flex-col">
        {/* Apply the saved theme before paint (dark is the default). */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(localStorage.getItem('barracks-theme')==='light')document.documentElement.dataset.theme='light';}catch(e){}",
          }}
        />
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
