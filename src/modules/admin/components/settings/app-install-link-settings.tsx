"use client"

import { useState, useEffect } from "react"
import AdminCard from "@modules/admin/components/admin-card"
import { CheckIcon, ClipboardDocumentIcon, ShareIcon } from "@heroicons/react/24/outline"

export default function AppInstallLinkSettings() {
  const [installUrl, setInstallUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [canShare, setCanShare] = useState(false)

  useEffect(() => {
    setInstallUrl(`${window.location.origin}/install`)
    setCanShare(typeof navigator !== "undefined" && "share" in navigator)
  }, [])

  const handleCopy = async () => {
    if (!installUrl) return
    await navigator.clipboard.writeText(installUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleShare = async () => {
    if (!installUrl || !canShare) return
    try {
      await navigator.share({
        title: "Install Toycker App",
        text: "Install the Toycker app for a faster shopping experience!",
        url: installUrl,
      })
    } catch {
      // user cancelled share sheet
    }
  }

  return (
    <AdminCard title="App Install Link">
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Share this link with anyone to let them install the Toycker app on their device.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={installUrl}
            readOnly
            className="flex-1 min-w-0 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 focus:outline-none"
          />
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-black transition-all whitespace-nowrap"
          >
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4" />
                Copied
              </>
            ) : (
              <>
                <ClipboardDocumentIcon className="h-4 w-4" />
                Copy
              </>
            )}
          </button>
          {canShare && (
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-all"
            >
              <ShareIcon className="h-4 w-4" />
              Share
            </button>
          )}
        </div>
        <p className="text-xs text-gray-400">
          Android users will see an &quot;Install App&quot; button. iPhone users will see
          step-by-step instructions.
        </p>
      </div>
    </AdminCard>
  )
}
