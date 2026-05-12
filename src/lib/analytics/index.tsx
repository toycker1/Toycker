"use client"

import { GoogleTagManager } from "@next/third-parties/google"
import { usePathname } from "next/navigation"
import Script from "next/script"

/**
 * Analytics component that loads Google Tag Manager and Contentsquare.
 * 
 * GTM (Google Tag Manager) is used to manage all tracking tags including:
 * - Google Analytics 4 (GA4)
 * - Any future marketing/analytics tags
 * 
 * Contentsquare provides:
 * - Heatmaps
 * - Session recordings
 * - User behavior analytics
 * 
 * Both scripts only load when environment variables are set.
 */

const ADMIN_PATH_PREFIX = "/admin"

export function ThirdPartyAnalytics() {
    const pathname = usePathname()
    const gtmId = process.env.NEXT_PUBLIC_GTM_ID
    const contentsquareId = process.env.NEXT_PUBLIC_CONTENTSQUARE_ID
    const isAdmin = pathname?.startsWith(ADMIN_PATH_PREFIX)

    if (isAdmin) {
        return null
    }

    // Only render analytics scripts if at least one ID is provided
    const hasGTM = gtmId !== undefined && gtmId !== ""
    const hasContentsquare = contentsquareId !== undefined && contentsquareId !== ""

    if (!hasGTM && !hasContentsquare) {
        return null
    }

    return (
        <>
            {/* Google Tag Manager - loads GA4 and other tracking through GTM */}
            {hasGTM && <GoogleTagManager gtmId={gtmId} />}

            {/* Contentsquare - for heatmaps and session recordings */}
            {hasContentsquare && (
                <Script
                    src={`https://t.contentsquare.net/uxa/${contentsquareId}.js`}
                    strategy="lazyOnload"
                />
            )}
        </>
    )
}

export default ThirdPartyAnalytics
