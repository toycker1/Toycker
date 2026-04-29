"use client"

import type { ChangeEvent } from "react"
import { useState } from "react"
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder"
import type { ReviewFormValues } from "../types"

const initialValues: ReviewFormValues = {
  rating: 0,
  title: "",
  content: "",
  displayName: "",
  isAnonymous: false,
}

export function validateReviewForm(values: ReviewFormValues) {
  if (values.rating === 0) {
    return "Please select a star rating."
  }

  if (!values.title.trim()) {
    return "Please enter a review title."
  }

  if (!values.content.trim()) {
    return "Please enter the review details."
  }

  if (!values.isAnonymous && !values.displayName.trim()) {
    return "Please enter a display name or post anonymously."
  }

  return null
}

export function useReviewForm(defaultValues: Partial<ReviewFormValues> = {}) {
  const [values, setValues] = useState<ReviewFormValues>({
    ...initialValues,
    ...defaultValues,
  })
  const [files, setFiles] = useState<File[]>([])
  const [mediaInputResetKey, setMediaInputResetKey] = useState(0)
  const voiceRecorder = useVoiceRecorder()

  const updateField = <Key extends keyof ReviewFormValues>(
    field: Key,
    value: ReviewFormValues[Key]
  ) => {
    setValues((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.currentTarget.files ?? [])

    event.currentTarget.value = ""
    setMediaInputResetKey((currentKey) => currentKey + 1)

    if (selectedFiles.length === 0) {
      return
    }

    setFiles((currentFiles) => [
      ...currentFiles,
      ...selectedFiles,
    ])
  }

  const removeFile = (index: number) => {
    setFiles((currentFiles) =>
      currentFiles.filter((_, currentIndex) => currentIndex !== index)
    )
    setMediaInputResetKey((currentKey) => currentKey + 1)
  }

  const reset = () => {
    setValues({
      ...initialValues,
      ...defaultValues,
    })
    setFiles([])
    setMediaInputResetKey((currentKey) => currentKey + 1)
    voiceRecorder.resetRecording()
  }

  return {
    values,
    files,
    mediaInputResetKey,
    voiceRecorder,
    updateField,
    handleFileChange,
    removeFile,
    validate: () => validateReviewForm(values),
    reset,
  }
}
