import "@/app/global.css";
import type { Metadata } from "next";
import { RootProvider } from "fumadocs-ui/provider/next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://getvision.dev",
  ),
  robots: {
    index: true,
    follow: true,
  },
  verification: {
    google: "gRXIMDfMK13pfDWOy8lxvHMB6RhduDzBp9guQwAhU7A",
  },
};

export default function Layout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.className} dark`}
      style={{ colorScheme: "dark" }}
      suppressHydrationWarning
    >
      <body className="flex flex-col min-h-screen">
        {/* Dark theme only — no light mode, no toggle */}
        <RootProvider theme={{ enabled: false }}>{children}</RootProvider>
      </body>
    </html>
  );
}
