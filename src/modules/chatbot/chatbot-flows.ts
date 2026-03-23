/**
 * Chatbot Conversation Flows
 * Decision tree definitions for all chatbot conversations
 */

import { QuickReply } from './types'

// Main menu quick replies
export const MAIN_MENU_REPLIES: QuickReply[] = [
    { id: 'track', label: '📦 Track My Order', value: 'track_order' },
    { id: 'club', label: '⭐ Club Membership', value: 'club_info' },
    { id: 'rewards', label: '🎁 Reward Points', value: 'rewards' },
    { id: 'payment', label: '� Payment Info', value: 'payment_info' },
    { id: 'delivery', label: '🚚 Delivery Info', value: 'delivery_info' },
    { id: 'order', label: '🛒 How to Order', value: 'how_to_order' },
    { id: 'contact', label: '📞 Contact Us', value: 'contact' },
]

// Sub-menu quick replies
export const BACK_TO_MENU: QuickReply = {
    id: 'back',
    label: '← Back to Menu',
    value: 'main_menu'
}

export const CLUB_REPLIES: QuickReply[] = [
    { id: 'discount_calc', label: '🧮 How is discount calculated?', value: 'club_discount_calc' },
    { id: 'how_join', label: '🎯 How to become a member?', value: 'club_how_join' },
    { id: 'my_savings', label: '💰 My total savings', value: 'club_savings' },
    BACK_TO_MENU
]

export const REWARDS_REPLIES: QuickReply[] = [
    { id: 'balance', label: '💎 Check my balance', value: 'rewards_balance' },
    { id: 'how_use', label: '🎯 How to use points?', value: 'rewards_how_use' },
    { id: 'how_earn', label: '📈 How to earn more?', value: 'rewards_how_earn' },
    BACK_TO_MENU
]

export const ORDER_TRACK_REPLIES: QuickReply[] = [
    { id: 'my_orders', label: '📋 My Orders', value: 'my_orders' },
    { id: 'enter_id', label: '🔍 Enter Order ID', value: 'enter_order_id' },
    BACK_TO_MENU
]

export const DELIVERY_REPLIES: QuickReply[] = [
    { id: 'time', label: '⏱️ Delivery Time', value: 'delivery_time' },
    { id: 'free', label: '🎉 Free Shipping', value: 'free_shipping' },
    { id: 'track', label: '📦 Track Order', value: 'track_order' },
    BACK_TO_MENU
]

export const CONTACT_REPLIES: QuickReply[] = [
    { id: 'call', label: '📞 Call Us', value: 'contact_call' },
    { id: 'email', label: '📧 Email Us', value: 'contact_email' },
    { id: 'visit', label: '📍 Store Locations', value: 'contact_locations' },
    BACK_TO_MENU
]

export const PAYMENT_REPLIES: QuickReply[] = [
    { id: 'online', label: '💳 Online Payment', value: 'payment_online' },
    { id: 'cod', label: '💵 Cash on Delivery', value: 'cod_info' },
    { id: 'security', label: '🔒 Is it Secure?', value: 'payment_security' },
    { id: 'discounts', label: '🎉 Payment Discounts', value: 'payment_discounts' },
    BACK_TO_MENU
]

// Flow messages
export const FLOW_MESSAGES = {
    // Welcome
    welcome: `Hi! 👋 I'm Toycker Assistant.

How can I help you today?`,

    // Club Membership
    club_intro: `⭐ **Toycker Club Membership**

Join our exclusive club and enjoy amazing benefits!

✅ **10% OFF** on all products, every time
✅ **5% Reward Points** on every purchase  
✅ Exclusive member-only offers

What would you like to know?`,

    club_discount_calc: `🧮 **How Club Discount Works**

As a Club Member, you get **10% OFF** on every product!

**Calculation:**
Original Price × 0.90 = Your Price

**Example:**
A toy priced at ₹1,000
→ Your discount: ₹100
→ You pay: ₹900 only! 🎉

The discount is automatically applied when you're logged in.`,

    club_how_join: `🎯 **How to Become a Club Member**

It's super easy! Just follow these steps:

1️⃣ Create an account (if you haven't)
2️⃣ Place an order of **₹999 or more**
3️⃣ You're automatically a Club Member! 🎉

That's it! No forms, no fees, no waiting.
Your very first big order makes you a member forever.`,

    // Payment Info
    payment_intro: `💳 **Payment Information**

We offer multiple secure payment options:

✅ **Online Payment** - Cards, UPI, Net Banking, Wallets
✅ **Cash on Delivery** - Pay when you receive

What would you like to know?`,

    payment_online: `💳 **Online Payment**

Pay securely using any of these methods:

**Accepted Payment Methods:**
• 💳 Credit/Debit Cards (Visa, Mastercard, RuPay)
• 📱 UPI (Google Pay, PhonePe, Paytm, etc.)
• 🏦 Net Banking (All major banks)
• 👛 Wallets (Paytm, Mobikwik, etc.)

**How it works:**
1️⃣ Add items to cart and checkout
2️⃣ Select "Online Payment"
3️⃣ Choose your preferred method
4️⃣ Complete payment securely
5️⃣ Order confirmed instantly! ✅

Payment is processed by **Easebuzz** - a trusted payment gateway.`,

    payment_security: `🔒 **100% Secure Payments**

Your payment security is our top priority!

**Security Features:**
✅ **256-bit SSL Encryption** - Bank-level security
✅ **PCI DSS Compliant** - International security standards
✅ **3D Secure** - Extra verification for cards
✅ **Trusted Gateway** - Powered by Easebuzz

**What this means for you:**
• Your card details are never stored on our servers
• All transactions are encrypted end-to-end
• Secure OTP verification for every payment
• Instant refunds for failed transactions

🛡️ Shop with confidence - we protect your money!`,

    payment_discounts: `🎉 **Payment Discounts \u0026 Offers**

**Club Member Discount (Online \u0026 COD):**
• Get **10% OFF** on all products automatically!
• Applies to both online payment \u0026 COD orders

**How discounts are applied:**
1️⃣ Your Club discount is applied first (if member)
2️⃣ Then any promo codes you enter
3️⃣ Finally, reward points (if used)

**Example:**
Original price: ₹1,000
Club discount (10%): -₹100
You pay: ₹900

**Note:** All discounts are clearly shown on the checkout page before you pay. No hidden charges!

💡 **Tip:** Become a Club Member to save 10% on every order!`,

    // COD
    cod_intro: `💵 **Cash on Delivery (COD)**

Pay when your order arrives - no advance payment needed!

**How it works:**
1️⃣ Add items to cart and checkout
2️⃣ Select "Cash on Delivery" as payment
3️⃣ We prepare and ship your order
4️⃣ Pay the delivery person when they arrive

**Payment at doorstep:**
• Cash
• UPI (if supported by delivery partner)

**Extra charges?**
None! COD is completely FREE. 🎉

**Note:** Club member discounts apply to COD orders too!`,

    // Rewards
    rewards_intro: `🎁 **Reward Points**

Earn points on every purchase and use them for discounts!

**How it works:**
• Club Members earn **5%** of order value as points
• 1 point = ₹1 discount
• Use points during checkout

What would you like to know?`,

    rewards_how_use: `🎯 **How to Use Reward Points**

Using your points is easy!

1️⃣ Add items to your cart
2️⃣ Go to checkout
3️⃣ You'll see "Apply Reward Points" option
4️⃣ Enter points to apply (1 point = ₹1)
5️⃣ Your total is reduced!

**Note:** You must be logged in to use points.`,

    rewards_how_earn: `📈 **How to Earn Reward Points**

**Club Members** earn 5% of order value as points!

**Example:**
Order total: ₹1,000
Points earned: 50 points (₹50 value!)

**Not a Club Member yet?**
Place an order of ₹999+ to join and start earning!`,

    // Delivery
    delivery_intro: `🚚 **Delivery Information**

We ship across India with reliable partners.

What would you like to know?`,

    delivery_time: `⏱️ **Delivery Timeframe**

**Standard Delivery:** 5-7 business days
*Actual time depends on your location*

**Order Processing:**
• Orders placed before 4 PM ship same day
• After 4 PM ships next business day

**Order Status Flow:**
📋 Ordered → 📦 Ready to Ship → 🚚 Shipped → 🏠 Delivered`,

    free_shipping: `🎉 **Free Shipping**
 
Get FREE shipping on orders above **₹500**!
 
Check your cart for the current free shipping offer.
 
**Tip:** Add a few more items to qualify for free shipping and save on delivery charges.`,

    // How to Order
    how_to_order: `🛒 **How to Place an Order**

**Step 1: Browse & Select**
• Find toys you love
• Click "Add to Cart"

**Step 2: Review Cart**
• Check items and quantities
• Apply discount codes (if any)

**Step 3: Checkout**
• Enter delivery address
• Choose payment method (Online or COD)

**Step 4: Confirm**
• Review order details
• Place order!

You'll receive confirmation via email. 📧`,

    // Order Tracking
    track_intro: `📦 **Track Your Order**

How would you like to track your order?`,

    track_guest: `🔍 **Track Your Order**

To track your order, you'll need your **Order Number** (like #4, #15, etc.)

You can find this number:
• In your order confirmation email
• On your account's "My Orders" page

Please visit the **My Orders** page to see your order status and tracking details!`,

    track_login_required: `🔐 **Login Required**

To see your orders, please log in to your account.

Once logged in, I can show you all your orders and their status!`,

    // Contact
    contact_intro: `📞 **Contact Us**

We're here to help! How would you like to reach us?`,

    // Fallback
    fallback: `I'm sorry, I didn't quite understand that. 

Would you like to go back to the main menu?`,

    // Thank you
    thank_you: `Thank you! Is there anything else I can help you with?`
}

// Generate unique message ID
export function generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}
