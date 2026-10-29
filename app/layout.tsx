import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Win-Win Approach",
  description:
    "A discussion platform for socioeconomic issues: Information, Discussion, Research, Modelling, Real-World Projects.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
