import type { Metadata, Viewport } from "next";
import AdminShell from "./AdminShell";

// Installable PWA config — scoped to /admin so admins can "Add to Home Screen"
// on iOS and launch the panel as a standalone app.
export const metadata: Metadata = {
  title: "Diamond Taste — Admin",
  manifest: "/admin.webmanifest",
  appleWebApp: {
    capable: true,
    title: "DT Admin",
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: "/icons/admin-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#F7F2EC",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
