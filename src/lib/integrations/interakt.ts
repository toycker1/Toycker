"use server"

type SendInteraktOtpParams = {
  destination: string // "91XXXXXXXXXX" from normalizePhone() in otp.ts
  otpCode: string
  userName: string // accepted but unused — keeps the call site in otp.ts unchanged
}

type SendInteraktOtpResult = {
  providerMessageId?: string
}

type InteraktSuccessResponse = {
  result: boolean
  message: string
  id: string
}

const INTERAKT_API_URL = "https://api.interakt.ai/v1/public/message/"

function getRequiredEnv(key: string): string {
  const value = process.env[key]?.trim()
  if (!value) throw new Error(`Missing required environment variable: ${key}`)
  return value
}

function getTrimmedEnv(key: string): string | null {
  const value = process.env[key]?.trim()
  return value || null
}

// destination is always "91XXXXXXXXXX" (12 chars) from normalizePhone() in otp.ts
function splitDestination(destination: string): {
  countryCode: string
  phoneNumber: string
} {
  if (destination.startsWith("91") && destination.length === 12) {
    return { countryCode: "+91", phoneNumber: destination.slice(2) }
  }
  return { countryCode: "+91", phoneNumber: destination }
}

async function parseResponse(
  response: Response
): Promise<InteraktSuccessResponse | null> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as InteraktSuccessResponse
  } catch {
    return null
  }
}

export async function sendInteraktOtp({
  destination,
  otpCode,
}: SendInteraktOtpParams): Promise<SendInteraktOtpResult> {
  const apiKey = getRequiredEnv("INTERAKT_API_KEY")
  const templateName = getRequiredEnv("INTERAKT_TEMPLATE_NAME")
  const languageCode = getTrimmedEnv("INTERAKT_LANGUAGE_CODE") ?? "en"

  const { countryCode, phoneNumber } = splitDestination(destination)

  const payload = {
    countryCode,
    phoneNumber,
    type: "Template" as const,
    template: {
      name: templateName,
      languageCode,
      bodyValues: [otpCode],
      // OTP must be the same in both bodyValues and buttonValues (Interakt requirement)
      buttonValues: { "0": [otpCode] },
    },
  }

  const response = await fetch(INTERAKT_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  })

  const responseBody = await parseResponse(response)

  if (!response.ok) {
    const detail =
      responseBody && typeof responseBody === "object" && "message" in responseBody
        ? `: ${String(responseBody.message)}`
        : ""
    throw new Error(`Interakt request failed with status ${response.status}${detail}`)
  }

  return {
    providerMessageId: responseBody?.id,
  }
}
