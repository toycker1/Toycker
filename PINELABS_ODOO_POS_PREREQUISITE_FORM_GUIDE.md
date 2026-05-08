# Pine Labs + Odoo POS Pre-Requisite Form Guide

This guide is based on:

- The provided Pine Labs `Pre requisite form.docx`.
- The screenshot of the Pine Labs One merchant portal.
- Pine Labs official in-store billing integration docs.
- Odoo official Pine Labs POS terminal docs.

## Short conclusion

For Toycker with Odoo POS, ask Pine Labs to onboard you for **Pine Labs Cloud / Billing Integration for Odoo POS**, not a Windows-only COM/VB6/wired integration, unless Pine Labs explicitly confirms that your Odoo deployment must use a local bridge.

Odoo's official Pine Labs POS setup asks for these Pine Labs credentials:

- `Merchant ID`
- `Store ID`
- `Client ID`
- `Security Token`

Odoo then lets you choose the allowed Pine Labs payment modes, including UPI QR. Pine Labs One (`https://one.pinelabs.com/`) is mainly a merchant operations/support portal; the integration setup is normally handled through Pine Labs onboarding/support or the Pine Labs developer/billing integration process, not from the support dashboard shown in the screenshot.

## Recommended integration choice

Select or write:

```text
Integration type: Cloud / Billing Integration for Odoo POS
Billing application type: Web application
Required payment modes: UPI QR, and Card if Toycker also wants card payment from Odoo POS
Required credentials: Merchant ID, Store ID, Client ID, Security Token
```

Do **not** present Toycker as a VB6 desktop POS unless you are integrating a different desktop billing product. The sample values in the document, such as `GST RETAIL CHEMIST`, `VB6`, and `SAMARTH SOFTWARE`, look like previous/sample merchant data and should not be copied for Toycker.

## What to fill in the form

| Form field | Recommended value for Toycker/Odoo POS | Notes |
|---|---|---|
| Name of Merchant | `TOYCKER INDIA` or the exact legal/KYC merchant name in your Pine Labs account | Match Pine Labs KYC/account records. |
| Native/Development POS (OS) | `Odoo POS web application; cashier device OS: Windows/Android/iOS as applicable` | If all counters use Windows PCs, mention Windows version. If tablets, mention Android/iPadOS version. |
| POS OS version on live Store | Fill actual cashier device OS version, for example `Windows 11 Pro 23H2` or `Android 12` | Odoo itself is browser-based; Pine may still want cashier terminal/device details. |
| Expected No. of POS for Integration | Number of checkout counters/Pine terminals to connect | Use the real count. If there are 17 counters, write `17`; otherwise do not copy the sample. |
| Memory (RAM) present on POS at Store | Actual cashier device RAM, for example `8 GB` | The form's sample `17` is not a RAM value; replace it. |
| Processor present on POS at Store | Actual CPU/device model | Example: `Intel i5`, `Intel Celeron`, `Android A910 terminal`, etc. |
| Type of EDC Device Proposed by Pine Labs | Actual Pine Labs terminal model, likely `A910` if that is your device | Confirm from the sticker/device settings or Pine Labs account. |
| Free Serial Port available? | `NO / Not required for Cloud integration` | Serial is relevant for wired integration. |
| Free USB Port available? | `NO / Not required for Cloud integration` unless Pine asks for a wired bridge | For a browser/Odoo cloud flow, USB should not be needed. |
| Integration On KIOSK | `NO` | Use `YES` only if this is an unattended self-checkout kiosk. |
| Specify KIOSK | `N/A` | If kiosk is yes, specify `Attendant` or `Unattended`. |
| Integration On Tablet/App | `YES - Integration on web application` | This is the closest match for Odoo POS. |
| Name of the Billing Application | `Odoo Point of Sale (Toycker)` | Use the exact Odoo POS name if customized. |
| Integrated Version of Billing Application | Your Odoo version, for example `Odoo 18` or `Odoo 19` | Do not write `NA`; Odoo version matters. |
| Company name of Application provider | `Odoo S.A. / Toycker implementation team` | If a vendor maintains your Odoo instance, include that vendor. |
| Wallet Integration required | `UPI` | If Toycker also wants cards through Pine Labs, add `Card + UPI`. |
| Software Development Platform | `Odoo web application; server-side Python; browser-based POS frontend` | If Pine's form forces a selection, write `Web application / Cloud API`. |
| Programming language/SDK | `Python + JavaScript; Odoo Pine Labs POS module; REST/JSON cloud API` | Do not select/write `VB6` for Odoo. |
| Nature of billing application | `Retail POS / invoicing / inventory / accounting` | Odoo covers all of these. |
| Web based browser compatibility | `Yes - Chrome/Edge supported; Odoo POS web app` | The sample says desktop app; replace it. |
| Contact Person for Billing Application | Toycker technical/admin contact name, phone, email | Use the person who can coordinate UAT with Pine/Odoo. |
| Account Holder Name of Pine Labs | Pine Labs account holder name and mobile number | Use the name/mobile on the Pine Labs account, not a sample value. |
| Does billing application claim printer port exclusively? | `NO` | Browser/Odoo POS should not lock a Windows printer port exclusively. |
| Is POS Printer available? | `YES` if Toycker prints Odoo receipts; otherwise `NO` | Pine terminal can print payment charge slips separately. |
| Type of printer | Use actual type: `LAN`, `USB`, `Bluetooth`, or `Browser/Odoo IoT printer` | Do not choose `LPT` unless actually using old parallel-port printing. |
| Model no. of POS Printer | Fill actual printer model | Example: Epson/Thermal printer model. |
| Other Printer Details with Printer Port | Fill printer IP/port only if relevant | Example: `LAN printer at 192.168.x.x`. Avoid sharing public secrets. |
| Is Internet connection available on store? | `YES` | Required for Odoo and Pine cloud/status APIs. |
| Is Internet connection available on POS? | `YES` | Required for Odoo POS and Pine Labs terminal/API flow. |
| Are Plutus IP and port accessible from POS? | `YES - to be confirmed/whitelisted during UAT` | Ask Pine to confirm exact UAT/prod endpoints and ports for your chosen integration. |
| Is GPRS backup connectivity required? | `YES` if Pine terminal SIM backup is required; otherwise `NO` | Recommended for stores where Wi-Fi/ISP outages would block checkout. |

## Options to select

Use this option set unless Pine Labs says your specific Odoo deployment requires a different path:

```text
Integration On Tablet/App: YES
Integration on web application: YES
Integration On KIOSK: NO
Wallet Integration required: UPI
Software Development Platform: Web application / Cloud API / Odoo
Programming language/SDK: Python + JavaScript / Odoo Pine Labs module
Free Serial Port available: NO / Not required
Free USB Port available: NO / Not required
Printer port exclusively claimed: NO
Internet available on store: YES
Internet available on POS: YES
GPRS backup: YES if you want fallback connectivity on the Pine terminal
```

If Pine asks for allowed payment modes, request:

```text
UPI QR only: AllowedPaymentMode = 10
Card only: AllowedPaymentMode = 1
All enabled terminal modes: AllowedPaymentMode = 0
Recommended for Toycker if card + UPI are both needed: enable Card and UPI on the terminal/account, then configure the same allowed modes in Odoo.
```

## What to ask Pine Labs Support

Send this to Pine Labs along with the filled form:

```text
We use Odoo Point of Sale for Toycker. Please onboard our Pine Labs terminal(s) for Odoo POS / Pine Labs Cloud Billing Integration.

Please provide UAT and Production credentials required by Odoo:
- Merchant ID
- Store ID
- Client ID
- Security Token

Please enable UPI QR payment from Odoo POS and card payment if supported on our account/terminal.

Please confirm:
1. Whether our integration should use Pine Labs Cloud/Billing Integration, not Windows COM/wired integration.
2. The UAT and Production API endpoints/ports we must allow from our Odoo server/network.
3. Whether our Odoo hosting location requires an India proxy or IP whitelisting.
4. The exact Pine Labs terminal model, Client ID, Store ID, and enabled payment modes for each store/device.
5. Whether Pine Labs will provide status callback/webhook URL support or whether Odoo should poll transaction status.
```

## Odoo-side setup checklist

After Pine Labs provides credentials:

1. Install/enable the Odoo `POS Pine Labs` payment terminal module.
2. Go to `Point of Sale > Configuration > Settings`.
3. Enable the Pine Labs payment terminal.
4. Go to `Point of Sale > Configuration > Payment Methods`.
5. Create a payment method with:
   - `Journal`: Bank
   - `Integration`: Terminal
   - `Integrate with`: Pine Labs
6. Enter Pine Labs credentials:
   - `Merchant ID`
   - `Store ID`
   - `Client ID`
   - `Security Token`
7. Select the Pine Labs allowed payment modes, such as UPI QR and/or cards.
8. Add that payment method to the POS configuration.
9. Use Pine Labs test mode/UAT first, then move to production after Pine Labs sign-off.

## Risks and clarifications

- If your Odoo database is hosted outside India, Odoo 19 documentation says Pine Labs may require traffic to route through an Indian IP/proxy. Confirm this before UAT.
- If Pine Labs insists on **Wired Integration**, Odoo's normal browser POS cannot directly instantiate Windows COM components. That would require a local bridge/agent or a custom Odoo integration, so get Pine Labs to confirm the integration mode in writing.
- Do not share the `Security Token` in screenshots, tickets, or public repos. Treat it like an API secret.
- The exact values for merchant legal name, account holder, device model, POS count, OS, RAM, processor, and printer model must come from Toycker's live setup.

## Source links reviewed

- Pine Labs Developer Portal for In-store Billing Integration: https://developer.pinelabs.com/in/instore
- Pine Labs Integration Guide: https://developer.pinelabs.com/in/instore/integration-guide
- Pine Labs Cloud Integration: https://developer.pinelabs.com/in/instore/cloud-integration
- Pine Labs Wired Integration Guide: https://developer.pinelabs.com/in/instore/wired-integration
- Pine Labs App-to-App Integration: https://developer.pinelabs.com/in/instore/app-integration
- Pine Labs Environments: https://developer.pinelabs.com/in/instore/environments
- Pine Labs FAQs: https://developer.pinelabs.com/in/instore/faqs
- Pine Labs Downloads: https://developer.pinelabs.com/in/instore/downloads
- Odoo 19 Pine Labs POS terminal docs: https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/payment_methods/terminals/pine_labs.html
- Odoo 19 payment terminals docs: https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/payment_methods/terminals.html

## Research note

I reviewed the provided Word form locally and ran 32 targeted web searches across Pine Labs/Odoo integration terms, including Odoo Pine Labs credentials, Pine Labs cloud integration, wired COM integration, UPI QR sale, allowed payment modes, Plutus endpoints, and Pine Labs developer onboarding.
