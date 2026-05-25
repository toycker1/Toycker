import {
  PRICE_SLIDER_CONFIG,
  PriceRangeBounds,
  PriceRangeFilter,
} from "@modules/store/components/refinement-list/types"

type PriceRangeInput = {
  min?: number
  max?: number
}

export type PriceSliderDomain = {
  min: number
  max: number
}

const normalizeBound = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined
  }

  return Number.isFinite(value) ? value : undefined
}

const floorToStep = (value: number, step: number) =>
  Math.floor(value / step) * step

const ceilToStep = (value: number, step: number) =>
  Math.ceil(value / step) * step

export const sanitizePriceRange = (input?: PriceRangeInput): PriceRangeFilter | undefined => {
  if (!input) {
    return undefined
  }

  const min = normalizeBound(input.min)
  const max = normalizeBound(input.max)

  if (min === undefined && max === undefined) {
    return undefined
  }

  if (min !== undefined && max !== undefined && min > max) {
    return { min: max, max: min }
  }

  return { min, max }
}

export const sanitizePriceRangeBounds = (input?: PriceRangeInput): PriceRangeBounds | undefined => {
  if (!input) {
    return undefined
  }

  const min = normalizeBound(input.min)
  const max = normalizeBound(input.max)

  if (min === undefined || max === undefined) {
    return undefined
  }

  if (min > max) {
    return { min: max, max: min }
  }

  return { min, max }
}

export const getPriceSliderDomain = ({
  bounds,
  selectedRange,
}: {
  bounds?: PriceRangeBounds
  selectedRange?: PriceRangeFilter
}): PriceSliderDomain => {
  const step = PRICE_SLIDER_CONFIG.step
  const defaultMin = PRICE_SLIDER_CONFIG.min
  const defaultMax = PRICE_SLIDER_CONFIG.defaultMax

  const boundedMin = bounds
    ? Math.max(defaultMin, floorToStep(bounds.min, step))
    : defaultMin
  const boundedMax = bounds
    ? Math.max(defaultMin, ceilToStep(bounds.max, step))
    : defaultMax

  const selectedMin = normalizeBound(selectedRange?.min)
  const selectedMax = normalizeBound(selectedRange?.max)

  const min = Math.max(
    defaultMin,
    Math.min(
      boundedMin,
      selectedMin !== undefined ? floorToStep(selectedMin, step) : boundedMin
    )
  )
  let max = Math.max(
    boundedMax,
    selectedMax !== undefined ? ceilToStep(selectedMax, step) : boundedMax,
    selectedMin !== undefined ? ceilToStep(selectedMin, step) : boundedMax
  )

  if (max <= min) {
    max = min + step
  }

  return { min, max }
}

export const getPriceSliderValues = (
  selectedRange: PriceRangeFilter | undefined,
  domain: PriceSliderDomain
) => {
  const min = normalizeBound(selectedRange?.min) ?? domain.min
  const max = normalizeBound(selectedRange?.max) ?? domain.max

  if (min > max) {
    return [max, min]
  }

  return [min, max]
}

export const toCommittedPriceRange = (
  selectedRange: PriceRangeFilter,
  domain: PriceSliderDomain
): PriceRangeFilter => {
  const normalized = sanitizePriceRange(selectedRange) ?? {}
  const min = normalized.min !== undefined && normalized.min > domain.min
    ? Math.round(normalized.min)
    : undefined
  const max = normalized.max !== undefined && normalized.max < domain.max
    ? Math.round(normalized.max)
    : undefined

  return { min, max }
}
