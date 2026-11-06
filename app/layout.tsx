import type { Metadata } from "next";
import { Special_Elite, Inter } from "next/font/google";
import { GameProvider } from "@/components/GameProvider";
import "./globals.css";

const typewriter = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-typewriter",
  display: "swap",
});

const ui = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Doodle Crimes",
  description: "A noir crime-scene drawing & guessing party game for adults.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${typewriter.variable} ${ui.variable} font-sans antialiased`}>
        <GameProvider>{children}</GameProvider>
      </body>
    </html>
  );
}
