import { Metadata } from "next"
import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import CartTemplate from "@modules/cart/templates"

export const metadata: Metadata = {
    title: "Cart",
    description: "View your shopping cart",
}

export default async function CartPage() {
    const [cart, customer] = await Promise.all([
        retrieveCart(),
        retrieveCustomer(),
    ])

    return <CartTemplate cart={cart} customer={customer} />
}
