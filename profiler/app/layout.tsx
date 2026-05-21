import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "LinkedIn Profile Audit — Free",
  description:
    "Upload your LinkedIn profile PDF. Get an instant score and a ghostwriter-rewritten version sent to your inbox. Free.",
  openGraph: {
    title: "LinkedIn Profile Audit — Free",
    description:
      "Upload your LinkedIn profile PDF. Get an instant score and a ghostwriter-rewritten version sent to your inbox. Free.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
