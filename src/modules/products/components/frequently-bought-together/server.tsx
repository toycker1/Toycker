import { listFrequentlyBoughtTogetherProducts } from "@lib/data/products"
import { Product } from "@/lib/supabase/types"
import FrequentlyBoughtTogether from "./index"

type FrequentlyBoughtTogetherServerProps = {
  product: Product
  clubDiscountPercentage?: number
}

export default async function FrequentlyBoughtTogetherServer({
  product,
  clubDiscountPercentage,
}: FrequentlyBoughtTogetherServerProps) {
  const relatedProducts = await listFrequentlyBoughtTogetherProducts(product.id)

  if (!relatedProducts.length) {
    return null
  }

  return (
    <FrequentlyBoughtTogether
      product={product}
      relatedProducts={relatedProducts}
      clubDiscountPercentage={clubDiscountPercentage}
    />
  )
}
