import type { Metadata } from "next"
import InstallPageClient from "./install-page-client"

export const metadata: Metadata = {
  title: "Install Toycker App",
  description:
    "Install the Toycker app for a faster shopping experience, exclusive deals, and offline access to your orders.",
  openGraph: {
    title: "Install Toycker App",
    description:
      "Get the Toycker app on your device for the best experience.",
    images: ["/assets/images/pwa-post.png"],
  },
}

export default function InstallPage() {
  return <InstallPageClient />
}
