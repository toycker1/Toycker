"use client"

import { ChatbotProvider, ChatbotWidget } from "@modules/chatbot"
import ContactHub from "@modules/layout/components/contact-hub"

export default function ChatbotShell() {
  return (
    <ChatbotProvider>
      <ContactHub />
      <ChatbotWidget hideLauncher={true} />
    </ChatbotProvider>
  )
}
