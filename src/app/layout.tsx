import type { Metadata } from "next";
import { IBM_Plex_Sans, Montserrat, Noto_Sans_Lao, Plus_Jakarta_Sans, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });
const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"], weight: ["500", "600", "700", "800"] });
const serif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"], weight: ["500", "600"] });
const lao = Noto_Sans_Lao({ variable: "--font-lao", subsets: ["lao"], weight: ["400", "500", "600", "700"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "Atlas Advisory",
  description: "Accounting, financial advisory and business services for Lao SMEs.",
  icons: { icon: "/brand/favicon.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const fonts = [plex, jakarta, serif, lao, montserrat].map((f) => f.variable).join(" ");
  return (
    <html lang="en" className={`${fonts} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
