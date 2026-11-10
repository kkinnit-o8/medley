import type { Metadata, Viewport } from "next";
import { config } from "@/medley.config";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(config.siteUrl),
  title: `${config.siteName}: the daily run of games`,
  description: `${config.tagline} A handful of daily puzzles played back to back, then see how you did against everyone else.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6f2" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1114" },
  ],
};

// Applies a saved theme before the first paint, so there is no flash.
const themeScript = `(function(){try{var t=localStorage.getItem("medley-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
