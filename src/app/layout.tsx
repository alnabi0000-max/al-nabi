import type { Metadata, Viewport } from "next";
import "./globals.css";
import { MasterControllerProvider } from "@/context/MasterControllerContext";
import { SecurityProvider } from "@/components/SecurityProvider";
import { AuthProviders } from "@/components/auth/AuthProviders";
import { ProducerChatProvider } from "@/context/ProducerChatContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { CosmicBackground } from "@/components/ui/CosmicBackground";
import { AppShellChrome } from "@/components/AppShellChrome";

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
  themeColor: "#05060a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /* Locale stays static here so the site remains prerenderable. MasterControllerProvider
   * corrects <html lang/dir> client-side once the stored locale preference loads. */
  return (
    <html lang="uz" suppressHydrationWarning>
      <body>
        <MasterControllerProvider>
          <CosmicBackground />
          <LanguageProvider>
            <AuthProviders>
              <SecurityProvider>
                <ProducerChatProvider>
                  <AppShellChrome>{children}</AppShellChrome>
                </ProducerChatProvider>
              </SecurityProvider>
            </AuthProviders>
          </LanguageProvider>
        </MasterControllerProvider>
      </body>
    </html>
  );
}
