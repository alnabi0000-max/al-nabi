import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MasterControllerProvider } from "@/context/MasterControllerContext";
import { SecurityProvider } from "@/components/SecurityProvider";
import { AuthProviders } from "@/components/auth/AuthProviders";
import { ProducerChatProvider } from "@/context/ProducerChatContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AppShellChrome } from "@/components/AppShellChrome";
import {
  THEME_STORAGE_KEY,
  THEME_IDS,
  DEFAULT_THEME,
} from "@/lib/theme/themes";

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://alnabiy.app";
const SITE_TITLE = "Al-Nabi — AI Video & Image Generation Platform";
const SITE_DESCRIPTION =
  "Turn a prompt or script into cinematic AI video and images in minutes — Script-to-Movie, Producer Chat, and the Al-Nabi Native Engine, all in one studio.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · Al-Nabi",
  },
  description: SITE_DESCRIPTION,
  appleWebApp: { capable: true, statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: ["/favicon.svg"],
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Al-Nabi",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/og-image.svg",
        type: "image/svg+xml",
        width: 1200,
        height: 630,
        alt: "Al-Nabi",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.svg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#090A0F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* Static default — kept static (not per-request dynamic) so the whole site
   * stays prerenderable/cacheable. MasterControllerProvider already corrects
   * <html lang/dir> client-side once the stored locale preference loads. */
  const themeBoot = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var d=${JSON.stringify(DEFAULT_THEME)};var a=${JSON.stringify(THEME_IDS)};var t=localStorage.getItem(k)||d;if(a.indexOf(t)<0)t=d;document.documentElement.setAttribute("data-theme",t);}catch(e){document.documentElement.setAttribute("data-theme",${JSON.stringify(DEFAULT_THEME)});}})();`;

  return (
    <html lang="uz" data-theme={DEFAULT_THEME} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
      </head>
      <body>
        <MasterControllerProvider>
          <ThemeProvider>
            <LanguageProvider>
              <AuthProviders>
                <SecurityProvider>
                  <ProducerChatProvider>
                    <AppShellChrome>{children}</AppShellChrome>
                  </ProducerChatProvider>
                </SecurityProvider>
              </AuthProviders>
            </LanguageProvider>
          </ThemeProvider>
        </MasterControllerProvider>
      </body>
    </html>
  );
}
