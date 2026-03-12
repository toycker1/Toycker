const DEFAULT_WHATSAPP_LOGIN_EMAIL_DOMAIN = "wa.toycker.store"

export function isSyntheticWhatsAppEmail(
  email: string | null | undefined
): boolean {
  const trimmedEmail = email?.trim()

  if (!trimmedEmail) {
    return false
  }

  return trimmedEmail
    .toLowerCase()
    .endsWith(`@${DEFAULT_WHATSAPP_LOGIN_EMAIL_DOMAIN}`)
}

export function getCustomerFacingEmail(
  ...candidates: Array<string | null | undefined>
): string | null {
  for (const candidate of candidates) {
    const trimmedCandidate = candidate?.trim()

    if (!trimmedCandidate || isSyntheticWhatsAppEmail(trimmedCandidate)) {
      continue
    }

    return trimmedCandidate
  }

  return null
}
