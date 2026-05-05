import {
  STORE_PRODUCT_MAX_PAGE_SIZE,
  STORE_PRODUCT_PAGE_SIZE,
} from "@modules/store/constants"

export const normalizeProductPage = (page?: number) => {
  if (typeof page !== "number" || !Number.isFinite(page) || page < 1) {
    return 1
  }

  return Math.floor(page)
}

export const normalizeProductLimit = (limit?: number) => {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit < 1) {
    return STORE_PRODUCT_PAGE_SIZE
  }

  return Math.min(Math.floor(limit), STORE_PRODUCT_MAX_PAGE_SIZE)
}

export const getProductRange = (page?: number, limit?: number) => {
  const normalizedPage = normalizeProductPage(page)
  const normalizedLimit = normalizeProductLimit(limit)
  const from = (normalizedPage - 1) * normalizedLimit

  return {
    page: normalizedPage,
    limit: normalizedLimit,
    from,
    to: from + normalizedLimit - 1,
  }
}
