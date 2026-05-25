export type SortOptions =
  | "featured"
  | "best_selling"
  | "alpha_asc"
  | "alpha_desc"
  | "price_asc"
  | "price_desc"
  | "date_old_new"
  | "date_new_old"

export type AvailabilityFilter = "in_stock" | "out_of_stock"

export type PriceRangeFilter = {
  min?: number
  max?: number
}

export type PriceRangeBounds = {
  min: number
  max: number
}

export type ViewMode = "grid-4" | "grid-5" | "list"

export const isViewMode = (value: unknown): value is ViewMode =>
  value === "grid-4" || value === "grid-5" || value === "list"

export const PRICE_SLIDER_CONFIG = {
  min: 0,
  defaultMax: 2000,
  step: 10,
}
