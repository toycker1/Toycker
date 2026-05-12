"use client"

import dynamic from "next/dynamic"
import { useEffect, useState } from "react"

const ChatbotShell = dynamic(
  () => import("@modules/layout/components/chatbot-shell"),
  {
    ssr: false,
    loading: () => null,
  }
)

type IdleWindow = Window & {
  requestIdleCallback?: (_callback: IdleRequestCallback) => number
  cancelIdleCallback?: (_handle: number) => void
}

export default function PublicContactHubLoader() {
  const [canLoad, setCanLoad] = useState(false)

  useEffect(() => {
    const idleWindow = window as IdleWindow

    if (idleWindow.requestIdleCallback) {
      const idleHandle = idleWindow.requestIdleCallback(() => setCanLoad(true))

      return () => idleWindow.cancelIdleCallback?.(idleHandle)
    }

    const timer = window.setTimeout(() => setCanLoad(true), 2000)

    return () => window.clearTimeout(timer)
  }, [])

  if (!canLoad) {
    return null
  }

  return <ChatbotShell />
}
