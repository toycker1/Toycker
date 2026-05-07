import { createCollection, getAdminProductOptions } from "@/lib/data/admin"
import Link from "next/link"
import AdminPageHeader from "@modules/admin/components/admin-page-header"
import { ChevronLeftIcon } from "@heroicons/react/24/outline"
import { CollectionForm } from "@/modules/admin/components/collection-form"

export default async function NewCollection() {
  const products = await getAdminProductOptions()

  return (
    <div className="space-y-8">
      <nav className="flex items-center gap-2 text-sm font-medium text-gray-500">
        <Link href="/admin/collections" className="flex items-center hover:text-gray-900">
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Collections
        </Link>
      </nav>

      <AdminPageHeader title="Create Collection" />

      <CollectionForm
        products={products}
        action={createCollection}
      />
    </div>
  )
}
