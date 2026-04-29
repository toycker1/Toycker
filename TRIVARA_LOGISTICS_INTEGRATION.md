# Trivara Logistics Integration

This document tracks the Trivara Logistics integration for Toycker. It is written so a reviewer can quickly see what has been implemented, what is pending, and which credentials are used by each Trivara API.

## Goal

When an admin accepts an order in Toycker, Toycker should automatically send an order booking request to Trivara Logistics so the logistics partner receives pickup/shipment details.

Trivara-specific operations should stay inside **Admin > Logistics**. The normal **Admin > Orders** pages should continue to work normally for stores that do not use Trivara.

## Current Status

The core prototype is implemented in code and the Supabase migration has been applied to the linked **Toycker Development** project.

Live Trivara validation is still pending because real values have not yet been added for:

- `TRIVARA_API_KEY`
- `TRIVARA_CRN_NO`
- `TRIVARA_PICKUP_LOCATION_CODE`

## Implementation Checklist

### Database

- [x] Create `public.trivara_order_bookings`.
- [x] Store one Trivara booking record per Toycker order.
- [x] Store booking status: `pending`, `booked`, `failed`, `skipped`, `cancelled`.
- [x] Store Trivara reference number.
- [x] Store booking request and response payloads.
- [x] Store booking error message.
- [x] Store tracking response and tracking sync time.
- [x] Store print slip response and print slip sync time.
- [x] Store cancel response, cancel error, and cancel time.
- [x] Create `public.trivara_sync_snapshots`.
- [x] Store latest Total Orders sync response.
- [x] Store latest Pickup Locations sync response.
- [x] Store latest Services sync response.
- [x] Enable RLS on both Trivara tables.
- [x] Add updated-at triggers for both Trivara tables.
- [x] Apply migration `20260428120000_trivara_order_bookings.sql` to Toycker Development.
- [x] Take Supabase backup before applying the migration.

### Backend Integration

- [x] Add typed Trivara API client in `src/lib/integrations/trivara.ts`.
- [x] Add order booking API call.
- [x] Add order tracking API call.
- [x] Add print slip API call.
- [x] Add total orders API call.
- [x] Add cancel order API call.
- [x] Add pickup locations API call.
- [x] Add services API call.
- [x] Send Trivara requests as `FormData`.
- [x] Use correct Trivara header names: `Apikey` and `api_key`.
- [x] Parse JSON, text, and empty Trivara responses safely.
- [x] Avoid TypeScript `any` in the new Trivara integration code.
- [x] Add safe error handling for Logistics sync buttons so failed calls do not crash the app.
- [x] Store failed sync details in `trivara_sync_snapshots.error_message`.

### Automatic Booking Flow

- [x] Keep existing Toycker order acceptance flow.
- [x] Trigger Trivara booking after admin accepts an order.
- [x] Do not rollback the Toycker order if Trivara booking fails.
- [x] Record `skipped` when `TRIVARA_BOOKING_ENABLED` is not `true`.
- [x] Record `failed` when Trivara config or API call fails.
- [x] Record `booked` when Trivara booking succeeds.
- [x] Keep the existing Toycker fulfillment flow available.
- [ ] Validate automatic booking with real Trivara credentials.
- [ ] Confirm Trivara returns a usable reference number in the live response.

### Admin UI

- [x] Add **Logistics** to the Admin sidebar.
- [x] Create `/admin/logistics`.
- [x] Create `/admin/logistics/[orderId]`.
- [x] Keep Trivara UI separate from the normal order detail page.
- [x] Show logistics records in a table.
- [x] Show Toycker order number, customer, order status, payment, total, Trivara status, Trivara reference, and latest sync time.
- [x] Add status filters: All, Pending, Booked, Failed, Skipped, Cancelled.
- [x] Add search by order ID, customer email, or Trivara reference.
- [x] Add Retry Booking action.
- [x] Add Track action.
- [x] Add Print Slip action.
- [x] Add Cancel Trivara action.
- [x] Add Sync Pickup Locations action.
- [x] Add Sync Services action.
- [x] Add Sync Total Orders action.
- [x] Add toast messages for sync success/failure.
- [x] Show detailed request/response JSON on the logistics detail page.
- [ ] Improve print slip display if Trivara returns a direct PDF or label URL.
- [ ] Confirm the final UI with a real Trivara booked shipment.

### Tests And Quality Checks

- [x] Add focused tests for order booking payload mapping.
- [x] Add focused tests for Trivara endpoint URLs and headers.
- [x] Add focused tests for booking disabled/skipped flow.
- [x] Run focused Vitest tests successfully.
- [x] Run targeted ESLint on touched files successfully.
- [x] Run production build successfully after implementation.
- [ ] Fix the existing `pnpm lint` script issue. Current script uses `next lint`, which is invalid in this Next.js version/setup.
- [ ] Run a complete end-to-end manual test with live/sandbox Trivara credentials.

### Credentials And Rollout

- [x] Add Trivara env vars to `.env.example`.
- [x] Support optional separate tracking and master API keys.
- [x] Fallback to `TRIVARA_API_KEY` when optional keys are blank.
- [ ] Add real `TRIVARA_API_KEY` to local/deployment environment.
- [ ] Add real `TRIVARA_CRN_NO` to local/deployment environment.
- [ ] Add real `TRIVARA_PICKUP_LOCATION_CODE` to local/deployment environment.
- [ ] Confirm with Trivara whether the API key is live or sandbox.
- [ ] Confirm with Trivara whether `TRIVARA_SERVICE_PARTNER` can stay blank.
- [ ] Keep `TRIVARA_BOOKING_ENABLED=false` until credentials are confirmed.
- [ ] Set `TRIVARA_BOOKING_ENABLED=true` only when ready to call Trivara.

## Trivara API Endpoints Implemented

| Feature | Endpoint | Header | Body fields |
| --- | --- | --- | --- |
| Order Booking | `POST https://app.trivaralogistics.in/api/users/V2/OrderBooking/create_order` | `Apikey` | `crn_no`, order/customer/address/package/payment/service fields |
| Order Tracking | `POST https://app.trivaralogistics.in/api/users/V2/OrderBooking/track_parcel` | `api_key` | `crn_no`, `reference_number` |
| Print Slip | `POST https://production.trivaralogistics.in/api/users/V2/OrderBooking/print_slip` | `Apikey` | `crn_no`, `reference_number` |
| Total Orders | `POST https://app.trivaralogistics.in/api/users/V2/OrderBooking/get_total_orders` | `Apikey` | `crn_no`, `start_date`, `end_date` |
| Cancel Order | `POST https://app.trivaralogistics.in/api/users/V2/OrderBooking/cancel_multiple_orders` | `Apikey` | `crn_no`, `reference_number` |
| Pickup Locations | `POST https://app.trivaralogistics.in/api/users/V2/OrderBooking/get_pickup_location` | `api_key` | `crn_no` |
| Services | `POST https://app.trivaralogistics.in/api/users/V2/Activity/get_services` | `api_key` | `crn_no` |

## Environment Variables

```env
TRIVARA_BOOKING_ENABLED=false
TRIVARA_API_BASE_URL=https://app.trivaralogistics.in
TRIVARA_PRINT_SLIP_API_BASE_URL=https://production.trivaralogistics.in
TRIVARA_API_KEY=your-trivara-api-key
TRIVARA_TRACKING_API_KEY=
TRIVARA_MASTER_API_KEY=
TRIVARA_CRN_NO=857252
TRIVARA_PICKUP_LOCATION_CODE=857252_2
TRIVARA_SERVICE=SURFACE
TRIVARA_SHIPMENT_TYPE=PARCEL
TRIVARA_SERVICE_PARTNER=
TRIVARA_DEFAULT_WEIGHT_GRAMS=1500
```

## API Key Usage

### `TRIVARA_API_KEY`

Primary Trivara API key. This is required for most operations.

Used for:

- Order Booking
- Print Slip
- Total Orders
- Cancel Order
- Tracking fallback when `TRIVARA_TRACKING_API_KEY` is blank
- Pickup Locations and Services fallback when `TRIVARA_MASTER_API_KEY` is blank

Header used:

- `Apikey` for Order Booking, Print Slip, Total Orders, and Cancel Order
- `api_key` only when used as fallback for Tracking, Pickup Locations, and Services

### `TRIVARA_TRACKING_API_KEY`

Optional dedicated tracking API key.

Used for:

- Order Tracking

Header used:

- `api_key`

If this is blank, Toycker uses `TRIVARA_API_KEY`.

### `TRIVARA_MASTER_API_KEY`

Optional dedicated master-data API key.

Used for:

- Pickup Locations
- Services

Header used:

- `api_key`

If this is blank, Toycker uses `TRIVARA_API_KEY`.

### `TRIVARA_CRN_NO`

Trivara customer CRN number.

Used in every Trivara API request:

- Order Booking
- Order Tracking
- Print Slip
- Total Orders
- Cancel Order
- Pickup Locations
- Services

### `TRIVARA_PICKUP_LOCATION_CODE`

Trivara pickup location code for the warehouse/pickup address.

Used for:

- Order Booking only

This must be a Trivara pickup location code, not a Google Maps code.

### `TRIVARA_SERVICE_PARTNER`

Courier partner code. Examples from Trivara docs:

- `DEL`
- `EKT`
- `XPB`
- `SMT`
- `DTDC`
- `DTDCA`

Used for:

- Order Booking only

Current decision: this can be blank if Trivara allows auto partner assignment.

## Data Flow

1. Customer places an order.
2. Admin clicks **Accept Order**.
3. Toycker changes the order status to accepted/ready to ship.
4. If `TRIVARA_BOOKING_ENABLED=false`, Toycker stores a Trivara row with status `skipped`.
5. If `TRIVARA_BOOKING_ENABLED=true`, Toycker builds the Trivara booking payload.
6. Toycker sends the booking request to Trivara.
7. Toycker stores the request, response, reference number, status, and error if any.
8. Admin manages Trivara tracking, print slip, cancellation, and sync tools from **Admin > Logistics**.

## Admin Logistics Pages

### `/admin/logistics`

Shows the logistics dashboard:

- Shipment rows from `trivara_order_bookings`
- Latest sync snapshots from `trivara_sync_snapshots`
- Sync buttons for Pickup Locations, Services, and Total Orders
- Toast messages for sync success/failure

### `/admin/logistics/[orderId]`

Shows one logistics record:

- Trivara booking status
- Trivara reference number
- Tracking status
- Toycker order summary
- Delivery address
- Booking request/response JSON
- Tracking response JSON
- Print slip response JSON
- Cancel response JSON

## Manual Testing Plan

### Safe test without calling Trivara

1. Keep `TRIVARA_BOOKING_ENABLED=false`.
2. Place a test order.
3. Accept the order in admin.
4. Confirm the order becomes ready to ship.
5. Confirm a row appears in `trivara_order_bookings`.
6. Confirm the row status is `skipped`.
7. Confirm the row appears in **Admin > Logistics**.

### Credential validation

1. Add real `TRIVARA_API_KEY`.
2. Add real `TRIVARA_CRN_NO`.
3. Use **Admin > Logistics > Sync Locations**.
4. Confirm either:
   - success toast appears and response is stored, or
   - failure toast appears and error is stored in latest syncs.
5. Use **Sync Services**.
6. Use **Sync Total Orders** with a date range.

### Live booking test

1. Confirm with Trivara that the API key/CRN can be used safely.
2. Add real `TRIVARA_PICKUP_LOCATION_CODE`.
3. Set `TRIVARA_BOOKING_ENABLED=true`.
4. Place a test order with complete shipping name, address, pincode, and phone.
5. Accept the order.
6. Confirm the logistics row is `booked` or `failed`.
7. If booked, confirm a Trivara reference number is stored.
8. Click **Track**.
9. Click **Print Slip**.
10. Use **Cancel Trivara** only if the shipment should really be cancelled in Trivara.

## Test API Status

No public Trivara sandbox or test API was found in the Postman documentation. The docs use:

- `https://app.trivaralogistics.in`
- `https://production.trivaralogistics.in`

Treat Trivara calls as live until Trivara confirms a sandbox API key, test CRN, or safe test process.

## Known Pending Decisions

- [ ] Confirm whether `TRIVARA_SERVICE_PARTNER` can remain blank for auto courier assignment.
- [ ] Confirm whether Print Slip returns PDF, URL, HTML, JSON, or another format in the real response.
- [ ] Confirm whether Trivara provides webhook callbacks for tracking updates.
- [ ] Decide whether to add customer-facing Trivara tracking later. Current implementation is admin-only.
