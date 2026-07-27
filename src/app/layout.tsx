import type { Metadata } from "next";
import { Cormorant_Garamond, Noto_Sans_Thai, Noto_Serif_Thai } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/config";
import { getLang } from "@/lib/lang";

// Latin display face. Thai glyphs are not in this font and fall through to
// Noto Serif Thai via the --font-display stack in globals.css.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

const notoSerifThai = Noto_Serif_Thai({
  variable: "--font-noto-serif-thai",
  subsets: ["thai"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Warissara & Thanat",
  description: "ร่วมเป็นส่วนหนึ่งในวันสำคัญของเรา · Join us on our wedding day",
  openGraph: {
    title: "Warissara & Thanat",
    description: "ร่วมเป็นส่วนหนึ่งในวันสำคัญของเรา · Join us on our wedding day",
    type: "website",
  },
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The lang attribute drives the Thai line-height rule in globals.css, so it
  // has to follow the cookie rather than being hard-coded.
  const lang = await getLang();

  return (
    <html
      lang={lang}
      className={`${cormorant.variable} ${notoSerifThai.variable} ${notoSansThai.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
