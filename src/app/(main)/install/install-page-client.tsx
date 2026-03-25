"use client"

import Image from "next/image"
import { Share2, Check, Download } from "lucide-react"
import { usePWA } from "@modules/layout/components/pwa-install-prompt/PWAContext"

export default function InstallPageClient() {
  const { showInstallPrompt } = usePWA()

  const handleShare = async () => {
    try {
      await navigator.share({
        title: "Install Toycker App",
        text: "Install the Toycker app for a faster shopping experience!",
        url: window.location.href,
      })
    } catch {
      // user cancelled or share not supported
    }
  }

  return (
    <div className="content-container py-8 sm:py-12">
      <div className="max-w-xl mx-auto ">
        {/* Banner */}
        <div className="relative w-full aspect-video max-h-[560px] rounded-2xl overflow-hidden shadow-xl">
          <Image
            src="/assets/images/pwa-post.png"
            alt="Toycker App"
            fill
            className="object-cover object-center"
            priority
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
          <div className="absolute bottom-5 left-5 right-5 text-white">
            <h1 className="text-2xl font-bold font-grandstander leading-tight drop-shadow">
              Get the Toycker App
            </h1>
            <p className="text-white/80 text-sm mt-0.5 drop-shadow">
              Experience the best of Toycker anywhere, anytime.
            </p>
          </div>
        </div>

        {/* Action content */}
        <div className="mt-8 space-y-6">
          {/* Value props */}
          <div className="space-y-3">
            {[
              "Faster shopping experience",
              "Offline access to your orders",
              "Exclusive app-only deals",
            ].map((benefit) => (
              <div key={benefit} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3 h-3 text-emerald-600" />
                </div>
                <span className="text-sm text-gray-700">{benefit}</span>
              </div>
            ))}
          </div>

          {/* Install button */}
          <button
            onClick={() => showInstallPrompt()}
            className="w-full flex items-center justify-center gap-2 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl transition-colors"
          >
            <Download className="w-5 h-5" />
            Install App
          </button>

          {/* Share link */}
          <div className="border-t border-gray-100 pt-6">
            <p className="text-xs text-gray-500 mb-3">Share this install link with others</p>
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 h-10 border border-gray-200 text-gray-700 font-medium text-sm rounded-xl hover:bg-gray-50 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share Install Link
            </button>
          </div>

          {/* Branding */}
          <div className="flex items-center justify-center gap-2 pt-2">
            <div className="w-6 h-6 rounded-md bg-emerald-600 flex items-center justify-center overflow-hidden">
              <Image src="/favicon.png" width={24} height={24} alt="T" unoptimized />
            </div>
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Toycker Official
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
