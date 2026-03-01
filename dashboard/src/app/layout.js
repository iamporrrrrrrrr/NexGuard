import "./globals.css";

export const metadata = {
  title: "DevGuard Dashboard",
  description: "Human-governed AI coding agent orchestration platform",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
