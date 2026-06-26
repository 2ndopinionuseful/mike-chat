import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mike — HVAC Second Opinion",
  description: "Get a second opinion on your HVAC quote before you commit.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{margin:0,padding:0,background:"#0f0f0f"}}>{children}</body>
    </html>
  );
}
