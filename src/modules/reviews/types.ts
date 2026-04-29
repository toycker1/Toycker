import type { ReviewData } from "@/lib/actions/reviews"

export type ReviewFormValues = {
  rating: number
  title: string
  content: string
  displayName: string
  isAnonymous: boolean
}

export type ReviewFileType = ReviewData["media"][number]["file_type"]

export type ReviewVoiceRecorder = {
  status:
    | "idle"
    | "requesting_permission"
    | "ready"
    | "recording"
    | "paused"
    | "stopped"
    | "error"
  audioBlob: Blob | null
  audioUrl: string | null
  duration: number
  errorMessage: string | null
  startRecording: () => Promise<void>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  resetRecording: () => void
}
