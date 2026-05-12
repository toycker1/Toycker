"use client"

import { ReactNode } from "react"

import { ToastProvider } from "@modules/common/context/toast-context"
import ToastDisplay from "@modules/common/components/toast-display"

const Providers = ({ children }: { children: ReactNode }) => {
  return (
    <ToastProvider>
      <ToastDisplay />
      {children}
    </ToastProvider>
  )
}

export default Providers

