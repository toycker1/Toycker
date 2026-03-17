"use client"

import { deleteProduct } from "@/lib/data/admin"
import { ExclamationTriangleIcon, TrashIcon } from "@heroicons/react/24/outline"
import { MouseEvent, useState, useTransition } from "react"
import { cn } from "@lib/util/cn"
import { Loader2 } from "lucide-react"
import Modal from "@modules/common/components/modal"
import { Button } from "@modules/common/components/button"
import { useToast } from "@modules/common/context/toast-context"

type DeleteProductButtonProps = {
  productId: string
  productName: string
  redirectTo?: string
  variant?: "icon" | "button"
  className?: string
}

export default function DeleteProductButton({
  productId,
  productName,
  redirectTo,
  variant = "button",
  className
}: DeleteProductButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  const isNextRedirectError = (error: unknown): error is { digest: string } => {
    if (!error || typeof error !== "object") return false
    const digest = (error as { digest?: unknown }).digest
    return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")
  }

  const openDialog = (event?: MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault()
    event?.stopPropagation()
    setIsOpen(true)
  }

  const closeDialog = () => {
    if (!isPending) {
      setIsOpen(false)
    }
  }

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteProduct(productId, redirectTo)
        if (!redirectTo) {
          showToast(`"${productName}" was deleted successfully.`, "success", "Product Deleted")
        }
        setIsOpen(false)
      } catch (error) {
        if (isNextRedirectError(error)) {
          throw error
        }
        console.error("Failed to delete product:", error)
        showToast("Failed to delete product. Please try again.", "error", "Delete Failed")
      }
    })
  }

  if (variant === "icon") {
    return (
      <>
        <button
          onClick={openDialog}
          disabled={isPending}
          className={cn(
            "p-1.5 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50 disabled:opacity-50",
            className
          )}
          title="Delete Product"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          ) : (
            <TrashIcon className="h-4 w-4" />
          )}
        </button>
        <DeleteProductModal
          isOpen={isOpen}
          isPending={isPending}
          productName={productName}
          onClose={closeDialog}
          onConfirm={handleDelete}
        />
      </>
    )
  }

  return (
    <>
      <button
        onClick={openDialog}
        disabled={isPending}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50",
          className
        )}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <TrashIcon className="h-4 w-4" />
        )}
        {isPending ? "Deleting..." : "Delete Product"}
      </button>
      <DeleteProductModal
        isOpen={isOpen}
        isPending={isPending}
        productName={productName}
        onClose={closeDialog}
        onConfirm={handleDelete}
      />
    </>
  )
}

type DeleteProductModalProps = {
  isOpen: boolean
  isPending: boolean
  productName: string
  onClose: () => void
  onConfirm: () => void
}

function DeleteProductModal({
  isOpen,
  isPending,
  productName,
  onClose,
  onConfirm
}: DeleteProductModalProps) {
  return (
    <Modal isOpen={isOpen} close={onClose} size="small">
      <div className="space-y-5">
        <Modal.Title>
          <div className="flex items-center gap-x-2 text-red-600">
            <ExclamationTriangleIcon className="h-6 w-6" />
            <span>Delete Product</span>
          </div>
        </Modal.Title>
        <Modal.Description>
          <span className="leading-relaxed text-gray-600">
            Are you sure you want to delete <span className="font-semibold text-gray-900">{productName}</span>? This action cannot be undone.
          </span>
        </Modal.Description>
        <Modal.Footer>
          <Button variant="secondary" size="small" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant="danger" size="small" onClick={onConfirm} isLoading={isPending} disabled={isPending}>
            Delete Product
          </Button>
        </Modal.Footer>
      </div>
    </Modal>
  )
}
