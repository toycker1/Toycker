import React from "react"
import Nav from "@modules/layout/templates/nav"
import Footer from "@modules/layout/templates/footer"
import MobileNav from "@modules/layout/components/mobile-nav"
import PublicContactHubLoader from "@modules/layout/components/public-contact-hub-loader"
import StorefrontProviders from "../storefront-providers"

export default function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <StorefrontProviders>
      <Nav />
      <main className="relative">
        {children}
      </main>
      <Footer />
      <MobileNav />
      <PublicContactHubLoader />
    </StorefrontProviders>
  )
}
