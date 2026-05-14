"use client"

import dynamic from "next/dynamic"
import type { RichTextEditorProps } from "./rich-text-editor"

const RichTextEditor = dynamic(() => import("./rich-text-editor"), {
  ssr: false,
  loading: () => (
    <div className="min-h-[190px] rounded-lg border border-gray-300 bg-gray-50" />
  ),
})

export default function RichTextEditorLoader(props: RichTextEditorProps) {
  return <RichTextEditor {...props} />
}
