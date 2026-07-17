import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, JetBrains_Mono, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n/provider";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["400", "500"],
  display: "swap",
});
// IBM Plex Mono: cifras/codigos/SLA en el tema Claro (via --font-plex-mono; ver globals.css).
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CredixNexus",
  description: "Plataforma ITSM + Transformación audit-grade para Credix",
};

// Evita el flash de tema: aplica data-theme desde localStorage antes del paint.
const themeScript = `try{var t=localStorage.getItem('credix.theme');if(t==='claro'||t==='nexus'){document.documentElement.dataset.theme=t;}var l=localStorage.getItem('credix.locale');if(l==='es'||l==='en'){document.documentElement.lang=l;}}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      data-theme="nexus"
      className={`${jakarta.variable} ${inter.variable} ${jetbrains.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <ThemeProvider>
          <I18nProvider>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
