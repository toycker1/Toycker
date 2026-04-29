"use client"

import type { ChangeEvent } from "react"
import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import {
  Image as ImageIcon,
  Mic,
  Pause,
  Play,
  Square,
  Star,
  Trash2,
  Video,
} from "lucide-react"
import { cn } from "@/lib/util/cn"
import type { ReviewVoiceRecorder } from "../types"

type ReviewFormVariant = "customer" | "admin"

type TextInputProps = {
  label: string
  value: string
  onChange: (_value: string) => void
  required?: boolean
  placeholder?: string
  variant: ReviewFormVariant
}

export function ReviewTextInput({
  label,
  value,
  onChange,
  required,
  placeholder,
  variant,
}: TextInputProps) {
  const isCustomer = variant === "customer"

  return (
    <div className={isCustomer ? "space-y-3" : "space-y-2"}>
      <label className="text-sm font-semibold text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type="text"
        required={required}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={
          isCustomer
            ? "w-full rounded-xl border border-ui-border-base bg-white px-4 py-3 text-ui-fg-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            : "w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        }
      />
    </div>
  )
}

export function ReviewTextarea({
  label,
  value,
  onChange,
  placeholder,
  variant,
}: {
  label: string
  value: string
  onChange: (_value: string) => void
  placeholder: string
  variant: ReviewFormVariant
}) {
  const isCustomer = variant === "customer"

  return (
    <div className={isCustomer ? "space-y-3" : "space-y-2"}>
      <label
        className={
          isCustomer
            ? "text-sm font-bold text-gray-900 uppercase tracking-widest pl-1"
            : "text-sm font-semibold text-gray-700"
        }
      >
        {label} <span className="text-red-500">*</span>
      </label>
      <textarea
        required
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={
          isCustomer
            ? "min-h-[160px] w-full rounded-2xl border border-gray-200 bg-white px-5 py-4 text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 placeholder:text-gray-400"
            : "min-h-[150px] w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
        }
      />
    </div>
  )
}

export function ReviewRatingPicker({
  value,
  onChange,
  variant,
}: {
  value: number
  onChange: (_rating: number) => void
  variant: ReviewFormVariant
}) {
  const isCustomer = variant === "customer"

  return (
    <div className={isCustomer ? "space-y-4" : "space-y-3"}>
      <span
        className={
          isCustomer
            ? "text-sm font-bold text-gray-900 uppercase tracking-widest pl-1"
            : "text-sm font-semibold text-gray-700"
        }
      >
        Overall Rating <span className="text-red-500">*</span>
      </span>
      <div
        className={
          isCustomer
            ? "flex items-center gap-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100 w-fit"
            : "flex w-fit items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
        }
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <button
            key={index}
            type="button"
            onClick={() => onChange(index + 1)}
            className={
              isCustomer
                ? "transition-all hover:scale-125 active:scale-95"
                : "transition hover:scale-110"
            }
          >
            <Star
              className={cn(
                isCustomer ? "h-8 w-8" : "h-7 w-7",
                index < value
                  ? isCustomer
                    ? "fill-indigo-500 text-indigo-500"
                    : "fill-amber-400 text-amber-400"
                  : "text-gray-300"
              )}
            />
          </button>
        ))}
        {value > 0 && (
          <span
            className={
              isCustomer
                ? "ml-2 text-lg font-black text-indigo-600"
                : "ml-2 text-sm font-bold text-gray-900"
            }
          >
            {value.toFixed(1)}
          </span>
        )}
      </div>
    </div>
  )
}

export function ReviewAnonymousToggle({
  checked,
  onChange,
  variant,
}: {
  checked: boolean
  onChange: (_checked: boolean) => void
  variant: ReviewFormVariant
}) {
  const isCustomer = variant === "customer"

  return (
    <label
      className={
        isCustomer
          ? "flex items-center gap-4 text-sm font-bold text-gray-600 cursor-pointer group px-4 py-3 rounded-2xl border border-transparent transition-all hover:bg-gray-50 hover:border-gray-200"
          : "flex w-fit cursor-pointer items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className={
          isCustomer
            ? "h-6 w-6 rounded-lg border-2 border-gray-300 text-indigo-600 transition-all focus:ring-4 focus:ring-indigo-100 checked:bg-indigo-600"
            : "h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        }
      />
      <span
        className={
          isCustomer
            ? "uppercase tracking-widest group-hover:text-indigo-600 transition-colors"
            : undefined
        }
      >
        Post anonymously
      </span>
    </label>
  )
}

export function ReviewMediaUploader({
  files,
  inputResetKey,
  onFileChange,
  onRemoveFile,
  variant,
}: {
  files: File[]
  inputResetKey: number
  onFileChange: (_event: ChangeEvent<HTMLInputElement>) => void
  onRemoveFile: (_index: number) => void
  variant: ReviewFormVariant
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const isCustomer = variant === "customer"

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }, [inputResetKey])

  return (
    <div className={isCustomer ? "space-y-4" : "space-y-3"}>
      <span
        className={
          isCustomer
            ? "text-sm font-bold text-gray-900 uppercase tracking-widest pl-1"
            : "text-sm font-semibold text-gray-700"
        }
      >
        {isCustomer ? "Photos & Videos" : "Photos, Videos & Audio"}
      </span>
      <div className={isCustomer ? "flex flex-wrap gap-4" : "grid grid-cols-3 gap-3"}>
        {files.map((file, index) => (
          <div
            key={`${file.name}-${file.lastModified}-${index}`}
            className={
              isCustomer
                ? "relative h-24 w-24 overflow-hidden rounded-2xl border-2 border-white shadow-md ring-1 ring-gray-100"
                : "relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
            }
          >
            <ReviewMediaPreview file={file} variant={variant} />
            <button
              type="button"
              onClick={() => onRemoveFile(index)}
              className={
                isCustomer
                  ? "absolute right-1.5 top-1.5 rounded-full bg-white/90 p-1.5 text-red-500 shadow-sm transition-all hover:bg-white hover:text-red-600 active:scale-95"
                  : "absolute right-1 top-1 rounded-full bg-white p-1 text-red-500 shadow-sm transition hover:text-red-600"
              }
            >
              <Trash2 className={isCustomer ? "h-4 w-4" : "h-3.5 w-3.5"} />
            </button>
          </div>
        ))}
        <label
          className={
            isCustomer
              ? "flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 transition-all hover:border-indigo-50 hover:bg-indigo-50 hover:shadow-lg active:scale-95 group"
              : "flex aspect-square cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-500"
          }
        >
          <ImageIcon
            className={
              isCustomer
                ? "h-8 w-8 text-gray-300 group-hover:text-indigo-400 transition-colors"
                : "h-7 w-7"
            }
          />
          <span
            className={
              isCustomer
                ? "mt-2 text-[11px] font-bold text-gray-400 group-hover:text-indigo-500 uppercase"
                : "mt-2 text-xs font-bold"
            }
          >
            Add Media
          </span>
          <input
            key={inputResetKey}
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={onFileChange}
          />
        </label>
      </div>
    </div>
  )
}

function ReviewMediaPreview({
  file,
  variant,
}: {
  file: File
  variant: ReviewFormVariant
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const isCustomer = variant === "customer"

  useEffect(() => {
    if (!file.type.startsWith("image/")) {
      setPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  if (file.type.startsWith("image/") && previewUrl) {
    return (
      <Image
        src={previewUrl}
        alt="review media preview"
        fill
        className="object-cover"
        sizes={isCustomer ? "96px" : "104px"}
        unoptimized
      />
    )
  }

  if (file.type.startsWith("video/")) {
    return (
      <div className={isCustomer ? "flex h-full w-full items-center justify-center bg-gray-50" : undefined}>
        <Video className={isCustomer ? "h-8 w-8 text-gray-400" : "h-7 w-7 text-gray-400"} />
      </div>
    )
  }

  return (
    <div className={isCustomer ? "flex h-full w-full items-center justify-center bg-gray-50" : undefined}>
      <Mic className={isCustomer ? "h-8 w-8 text-gray-400" : "h-7 w-7 text-gray-400"} />
    </div>
  )
}

export function ReviewVoiceRecorderPanel({
  voiceRecorder,
  variant,
}: {
  voiceRecorder: ReviewVoiceRecorder
  variant: ReviewFormVariant
}) {
  const isCustomer = variant === "customer"
  const timeLabel = `${Math.floor(voiceRecorder.duration / 60)
    .toString()
    .padStart(2, "0")}:${(voiceRecorder.duration % 60)
    .toString()
    .padStart(2, "0")}`

  return (
    <div className={isCustomer ? "space-y-4 pt-2" : "space-y-3"}>
      <span
        className={
          isCustomer
            ? "text-sm font-bold text-gray-900 uppercase tracking-widest pl-1"
            : "text-sm font-semibold text-gray-700"
        }
      >
        Voice Review (Optional)
      </span>

      {voiceRecorder.status === "error" && (
        <div
          className={
            isCustomer
              ? "rounded-xl bg-red-50 border border-red-100 p-4 text-sm text-red-700 font-medium"
              : "rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700"
          }
        >
          {voiceRecorder.errorMessage}
        </div>
      )}

      {(voiceRecorder.status === "idle" ||
        voiceRecorder.status === "error") &&
        !voiceRecorder.audioBlob && (
          <button
            type="button"
            onClick={voiceRecorder.startRecording}
            className={
              isCustomer
                ? "flex items-center gap-3 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-4 text-gray-500 transition-all hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-600 active:scale-95 w-full sm:w-auto"
                : "flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600"
            }
          >
            <Mic className={isCustomer ? "h-5 w-5" : "h-4 w-4"} />
            <span
              className={
                isCustomer ? "text-sm font-bold uppercase tracking-wider" : undefined
              }
            >
              Start Recording
            </span>
          </button>
        )}

      {(voiceRecorder.status === "recording" ||
        voiceRecorder.status === "paused") && (
        <div
          className={
            isCustomer
              ? "rounded-[2rem] border-2 border-red-100 bg-red-50 px-6 py-6 space-y-4 shadow-sm animate-in fade-in zoom-in duration-300"
              : "space-y-4 rounded-lg border border-red-100 bg-red-50 p-4"
          }
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {voiceRecorder.status === "recording" && isCustomer && (
                <div className="h-3 w-3 rounded-full bg-red-500 animate-ping" />
              )}
              <span
                className={
                  isCustomer
                    ? "text-sm font-bold text-red-900 uppercase tracking-widest"
                    : "text-sm font-bold text-red-700"
                }
              >
                {voiceRecorder.status === "recording" ? "Recording" : "Paused"}
              </span>
            </div>
            <span
              className={
                isCustomer
                  ? "text-lg font-mono font-bold text-red-600"
                  : "font-mono text-sm font-bold text-red-700"
              }
            >
              {timeLabel}
            </span>
          </div>

          {isCustomer ? (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={
                  voiceRecorder.status === "recording"
                    ? voiceRecorder.pauseRecording
                    : voiceRecorder.resumeRecording
                }
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white border border-red-100 px-4 py-3 text-sm font-bold text-red-600 transition hover:bg-red-100 active:scale-95 shadow-sm"
              >
                {voiceRecorder.status === "recording" ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {voiceRecorder.status === "recording" ? "Pause" : "Resume"}
              </button>
              <button
                type="button"
                onClick={voiceRecorder.stopRecording}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-700 active:scale-95 shadow-lg shadow-red-200"
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 transition-all hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
                onClick={
                  voiceRecorder.status === "recording"
                    ? voiceRecorder.pauseRecording
                    : voiceRecorder.resumeRecording
                }
              >
                {voiceRecorder.status === "recording" ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {voiceRecorder.status === "recording" ? "Pause" : "Resume"}
              </button>
              <button
                type="button"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-all hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                onClick={voiceRecorder.stopRecording}
              >
                <Square className="h-4 w-4" />
                Stop
              </button>
            </div>
          )}
        </div>
      )}

      {voiceRecorder.status === "stopped" && voiceRecorder.audioUrl && (
        <div
          className={
            isCustomer
              ? "rounded-[2rem] border-2 border-indigo-100 bg-indigo-50/50 p-6 space-y-4 shadow-sm"
              : "space-y-3 rounded-lg border border-indigo-100 bg-indigo-50 p-4"
          }
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={
                  isCustomer
                    ? "h-12 w-12 rounded-full bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-200"
                    : "flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600"
                }
              >
                <Mic className={isCustomer ? "h-6 w-6 text-white" : "h-4 w-4"} />
              </div>
              <div>
                <p
                  className={
                    isCustomer
                      ? "text-sm font-bold text-gray-900 uppercase"
                      : "text-sm font-bold text-gray-900"
                  }
                >
                  {isCustomer ? "Voice Review Locked" : "Voice review ready"}
                </p>
                <p
                  className={
                    isCustomer
                      ? "text-xs text-indigo-400 font-bold"
                      : "text-xs text-gray-500"
                  }
                >
                  {timeLabel}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={voiceRecorder.resetRecording}
              className={
                isCustomer
                  ? "rounded-full p-2.5 text-red-400 transition hover:bg-white hover:text-red-600 active:scale-95 shadow-sm"
                  : "rounded p-2 text-red-400 transition hover:bg-white hover:text-red-600"
              }
            >
              <Trash2 className={isCustomer ? "h-5 w-5" : "h-4 w-4"} />
            </button>
          </div>
          <audio
            controls
            src={voiceRecorder.audioUrl}
            className={isCustomer ? "w-full h-10 brightness-110 drop-shadow-sm" : "h-9 w-full"}
          />
        </div>
      )}
    </div>
  )
}
