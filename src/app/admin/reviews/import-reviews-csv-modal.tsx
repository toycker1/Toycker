"use client"

import type { ChangeEvent } from "react"
import { useRef, useState } from "react"
import Papa from "papaparse"
import { Download, Loader2, Upload, X } from "lucide-react"
import { useRouter } from "next/navigation"

import Modal from "@/modules/common/components/modal"
import { REVIEW_IMPORT_COLUMNS } from "@/lib/csv/review-import"

const MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024

type ImportRowMessage = {
  rowNumber: number
  message: string
}

type ImportResult = {
  success: boolean
  imported: number
  skipped: number
  failed: number
  mediaImported: number
  errors: ImportRowMessage[]
  skippedRows: ImportRowMessage[]
  error?: string
  details?: string
}

type SubmitStatus = "idle" | "importing" | "complete"

export default function ImportReviewsCsvModal() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [status, setStatus] = useState<SubmitStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const resetState = () => {
    setSelectedFile(null)
    setStatus("idle")
    setErrorMessage(null)
    setResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const closeModal = () => {
    if (status === "importing") {
      return
    }

    setIsOpen(false)
    resetState()
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    setErrorMessage(null)
    setResult(null)

    if (!file) {
      setSelectedFile(null)
      return
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setErrorMessage("Please select a CSV file.")
      event.target.value = ""
      setSelectedFile(null)
      return
    }

    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      setErrorMessage("Maximum CSV import size is 5MB.")
      event.target.value = ""
      setSelectedFile(null)
      return
    }

    setSelectedFile(file)
  }

  const downloadTemplate = () => {
    const rows = [
      {
        product_handle: "wooden-learning-bus",
        product_id: "",
        rating: "5",
        title: "Excellent learning toy",
        content: "Good quality and my child loved it.",
        reviewer_name: "Priya",
        is_anonymous: "false",
        review_date: "2026-05-28",
        approval_status: "approved",
        media_urls:
          "https://cdn.example.com/reviews/bus-review-1.jpg;https://cdn.example.com/reviews/bus-review-2.mp4",
        source_review_id: "amazon-wooden-learning-bus-001",
      },
      {
        product_handle: "",
        product_id: "replace-with-product-id",
        rating: "4",
        title: "Nice gift option",
        content: "",
        reviewer_name: "",
        is_anonymous: "yes",
        review_date: "",
        approval_status: "",
        media_urls: "",
        source_review_id: "marketplace-review-002",
      },
    ]

    const csv = Papa.unparse({
      fields: [...REVIEW_IMPORT_COLUMNS],
      data: rows,
    })
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "review_import_template.csv"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  }

  const handleImport = async () => {
    if (!selectedFile) {
      setErrorMessage("Please choose a CSV file first.")
      return
    }

    setStatus("importing")
    setErrorMessage(null)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const response = await fetch("/api/admin/reviews/import", {
        method: "POST",
        body: formData,
      })
      const data = (await response.json()) as ImportResult

      if (!response.ok || !data.success) {
        setErrorMessage(
          data.details ? `${data.error}: ${data.details}` : data.error || "Import failed."
        )
        setStatus("idle")
        return
      }

      setResult(data)
      setStatus("complete")
      router.refresh()
    } catch {
      setErrorMessage("Network error occurred during import.")
      setStatus("idle")
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      setSelectedFile(null)
    }
  }

  return (
    <>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
        onClick={() => setIsOpen(true)}
      >
        <Upload className="h-4 w-4" />
        Import Reviews CSV
      </button>

      <Modal
        isOpen={isOpen}
        close={closeModal}
        size="large"
        panelPadding="none"
        overflowHidden
      >
        <div className="flex max-h-[90vh] flex-col">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Import Reviews CSV
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Create product reviews in bulk from a CSV file.
              </p>
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    CSV template
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    Use the required headers exactly as provided.
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={downloadTemplate}
                >
                  <Download className="h-4 w-4" />
                  Download Template
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">
                CSV file
              </label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                disabled={status === "importing"}
                className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 file:mr-4 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
              />
              {selectedFile && (
                <p className="text-sm text-gray-500">
                  Selected:{" "}
                  <span className="font-medium text-gray-700">
                    {selectedFile.name}
                  </span>
                </p>
              )}
            </div>

            {errorMessage && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {errorMessage}
              </div>
            )}

            {result && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <ResultStat label="Imported" value={result.imported} />
                  <ResultStat label="Skipped" value={result.skipped} />
                  <ResultStat label="Failed" value={result.failed} />
                  <ResultStat label="Media" value={result.mediaImported} />
                </div>

                {result.errors.length > 0 && (
                  <ResultList
                    title="Validation errors"
                    rows={result.errors}
                    tone="error"
                  />
                )}

                {result.skippedRows.length > 0 && (
                  <ResultList
                    title="Skipped rows"
                    rows={result.skippedRows}
                    tone="warning"
                  />
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-200 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={closeModal}
              disabled={status === "importing"}
            >
              Close
            </button>
            <button
              type="button"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={handleImport}
              disabled={!selectedFile || status === "importing"}
            >
              {status === "importing" && <Loader2 className="h-4 w-4 animate-spin" />}
              {status === "importing" ? "Importing..." : "Start Import"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

function ResultStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function ResultList({
  title,
  rows,
  tone,
}: {
  title: string
  rows: ImportRowMessage[]
  tone: "error" | "warning"
}) {
  const classes =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-amber-200 bg-amber-50 text-amber-800"

  return (
    <div className={`rounded-lg border ${classes}`}>
      <div className="border-b border-current/10 px-4 py-2 text-sm font-semibold">
        {title}
      </div>
      <div className="max-h-52 overflow-y-auto px-4 py-2">
        <ul className="space-y-1 text-sm">
          {rows.map((row) => (
            <li key={`${row.rowNumber}-${row.message}`}>
              Row {row.rowNumber}: {row.message}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
