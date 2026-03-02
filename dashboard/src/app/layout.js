import "./globals.css";

export const metadata = {
  title: "DevGuard Dashboard",
  description: "Human-governed AI coding agent orchestration platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
