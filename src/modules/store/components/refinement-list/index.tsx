"use client"

import * as Slider from "@radix-ui/react-slider"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ReactNode, useEffect, useMemo, useState } from "react"
import { useOptionalStorefrontFilters } from "@modules/store/context/storefront-filters"

import {
  getPriceSliderDomain,
  getPriceSliderValues,
  TOYCKER_PRICE_RANGE_PRESETS,
  toCommittedPriceRange,
} from "@modules/store/utils/price-range"

import {
  AvailabilityFilter,
  PRICE_SLIDER_CONFIG,
  PriceRangeBounds,
} from "./types"

export type ActiveFilter = {
  label: string
  value: string
  paramKey: string | string[]
}

export type FilterOption = {
  label: string
  value: string
  count?: number
  collectionId?: string
}

export type FilterConfig = {
  availability?: FilterOption[]
  ages?: FilterOption[]
}

export type SelectedFilters = {
  availability?: AvailabilityFilter
  age?: string
  collection?: string
  priceMin?: number
  priceMax?: number
}

export type RefinementListProps = {
  searchQuery?: string | null
  activeFilters?: ActiveFilter[]
  filterOptions?: FilterConfig
  selectedFilters?: SelectedFilters
  priceBounds?: PriceRangeBounds
  onFiltersChange?: (_next: SelectedFilters) => void
}

type PriceRangeState = {
  min?: number
  max?: number
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
})

const formatCurrency = (value: number) => currencyFormatter.format(value)

const normalizePriceValue = (value: number | undefined) => {
  if (value === undefined || Number.isNaN(value) || !Number.isFinite(value)) {
    return undefined
  }

  return Math.max(value, PRICE_SLIDER_CONFIG.min)
}

const normalizePriceRange = (
  range: PriceRangeState
): PriceRangeState => {
  let min = normalizePriceValue(range.min)
  let max = normalizePriceValue(range.max)

  if (min !== undefined && max !== undefined && min > max) {
    const previousMin = min
    min = max
    max = previousMin
  }

  return {
    min,
    max,
  }
}

const RefinementList = ({
  searchQuery,
  activeFilters,
  filterOptions,
  selectedFilters,
  priceBounds,
  onFiltersChange,
}: RefinementListProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const storefrontFilters = useOptionalStorefrontFilters()

  const fallbackFilters = selectedFilters ?? {}
  const shouldUseCustomState = Boolean(onFiltersChange)
  const effectiveFilters = shouldUseCustomState
    ? fallbackFilters
    : storefrontFilters
      ? {
        availability: storefrontFilters.filters.availability,
        age: storefrontFilters.filters.age,
        collection: storefrontFilters.filters.collectionId,
        priceMin: storefrontFilters.filters.priceRange?.min,
        priceMax: storefrontFilters.filters.priceRange?.max,
      }
      : fallbackFilters
  const resolvedSearchQuery = shouldUseCustomState
    ? searchQuery ?? undefined
    : storefrontFilters?.filters.searchQuery ?? searchQuery ?? undefined
  const selectedAvailability = effectiveFilters.availability
  const selectedAge = effectiveFilters.age
  const selectedPriceMin = effectiveFilters.priceMin
  const selectedPriceMax = effectiveFilters.priceMax
  const effectivePriceBounds = storefrontFilters?.priceBounds ?? priceBounds
  const selectedPriceRange = useMemo(
    () => ({
      min: selectedPriceMin,
      max: selectedPriceMax,
    }),
    [selectedPriceMin, selectedPriceMax]
  )
  const priceSliderDomain = useMemo(
    () => getPriceSliderDomain({
      bounds: effectivePriceBounds,
      selectedRange: selectedPriceRange,
    }),
    [effectivePriceBounds, selectedPriceRange]
  )

  const [priceRange, setPriceRange] = useState<PriceRangeState>(() =>
    normalizePriceRange({
      min: selectedPriceMin,
      max: selectedPriceMax,
    })
  )

  useEffect(() => {
    setPriceRange(
      normalizePriceRange({
        min: selectedPriceMin,
        max: selectedPriceMax,
      })
    )
  }, [selectedPriceMin, selectedPriceMax])

  const pushWithParams = (params: URLSearchParams) => {
    const queryString = params.toString()
    router.push(queryString ? `${pathname}?${queryString}` : pathname)
  }

  const updateSearchParams = (updater: (_params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams)
    updater(params)
    params.delete("page")
    pushWithParams(params)
  }

  const toggleCheckboxParam = (name: string, value: string) => {
    const ageOption = name === "age" ? filterOptions?.ages?.find((option) => option.value === value) : undefined

    if (!shouldUseCustomState && storefrontFilters) {
      if (name === "availability") {
        const typedValue = value as AvailabilityFilter
        const nextValue = storefrontFilters.filters.availability === typedValue ? undefined : typedValue
        storefrontFilters.setAvailability(nextValue)
        updateSearchParams((params) => {
          if (nextValue) {
            params.set("availability", nextValue)
          } else {
            params.delete("availability")
          }
        })
      } else if (name === "age") {
        const isActive = storefrontFilters.filters.age === value
        const nextValue = isActive ? undefined : value
        const nextCollection = isActive ? undefined : ageOption?.collectionId
        storefrontFilters.updateFilters({ age: nextValue, collectionId: nextCollection })
        updateSearchParams((params) => {
          if (nextValue) {
            params.set("age", nextValue)
          } else {
            params.delete("age")
          }

          if (nextCollection) {
            params.set("collection", nextCollection)
          } else {
            params.delete("collection")
          }
        })
      }
      return
    }

    if (onFiltersChange) {
      if (name === "availability") {
        const typedValue = value as AvailabilityFilter
        const nextValue = effectiveFilters.availability === typedValue ? undefined : typedValue
        onFiltersChange({
          ...effectiveFilters,
          availability: nextValue,
        })
      } else if (name === "age") {
        const nextValue = effectiveFilters.age === value ? undefined : value
        const nextCollection = nextValue ? ageOption?.collectionId : undefined
        onFiltersChange({
          ...effectiveFilters,
          age: nextValue,
          collection: nextCollection,
        })
      }
      return
    }

    updateSearchParams((params) => {
      const currentValue = params.get(name)
      const isActive = currentValue === value

      if (isActive) {
        params.delete(name)
      } else {
        params.set(name, value)
      }

      if (name === "age") {
        if (isActive) {
          params.delete("collection")
        } else if (ageOption?.collectionId) {
          params.set("collection", ageOption.collectionId)
        } else {
          params.delete("collection")
        }
      }
    })
  }

  const commitPriceRange = (range: PriceRangeState) => {
    const nextPrice = toCommittedPriceRange(range, priceSliderDomain)

    if (!shouldUseCustomState && storefrontFilters) {
      storefrontFilters.setPriceRange(
        nextPrice.min === undefined && nextPrice.max === undefined
          ? undefined
          : nextPrice
      )
      updateSearchParams((params) => {
        if (nextPrice.min !== undefined) {
          params.set("price_min", nextPrice.min.toString())
        } else {
          params.delete("price_min")
        }

        if (nextPrice.max !== undefined) {
          params.set("price_max", nextPrice.max.toString())
        } else {
          params.delete("price_max")
        }
      })
      return
    }

    if (onFiltersChange) {
      onFiltersChange({
        ...effectiveFilters,
        priceMin: nextPrice.min,
        priceMax: nextPrice.max,
      })
      return
    }

    const params = new URLSearchParams(searchParams)

    if (nextPrice.min !== undefined) {
      params.set("price_min", nextPrice.min.toString())
    } else {
      params.delete("price_min")
    }

    if (nextPrice.max !== undefined) {
      params.set("price_max", nextPrice.max.toString())
    } else {
      params.delete("price_max")
    }

    params.delete("page")
    pushWithParams(params)
  }

  const updatePriceRange = (range: PriceRangeState, commit?: boolean) => {
    const next = normalizePriceRange(range)
    setPriceRange(next)

    if (commit) {
      commitPriceRange(next)
    }
  }

  const updatePriceRangeValues = (values: number[], commit?: boolean) => {
    const [min, max] = values
    updatePriceRange({ min, max }, commit)
  }

  const resolvedFilters = useMemo(() => {
    const chips = [...(activeFilters ?? [])]

    const appendChip = (
      paramKey: string,
      value?: string,
      options?: FilterOption[]
    ) => {
      if (!value) {
        return
      }

      const matchedLabel = options?.find((option) => option.value === value)?.label
      chips.push({
        label: matchedLabel || value,
        value,
        paramKey,
      })
    }

    appendChip("availability", selectedAvailability, filterOptions?.availability)
    appendChip("age", selectedAge, filterOptions?.ages)

    if (selectedPriceMin !== undefined || selectedPriceMax !== undefined) {
      const formattedMin = formatCurrency(selectedPriceMin ?? PRICE_SLIDER_CONFIG.min)
      const formattedMax = selectedPriceMax !== undefined ? formatCurrency(selectedPriceMax) : "No limit"
      chips.push({
        label: `Price: ${formattedMin} - ${formattedMax}`,
        value: `${selectedPriceMin ?? PRICE_SLIDER_CONFIG.min}-${selectedPriceMax ?? "max"}`,
        paramKey: ["price_min", "price_max"],
      })
    }

    if (resolvedSearchQuery) {
      chips.push({
        label: `Search: "${resolvedSearchQuery}"`,
        value: resolvedSearchQuery,
        paramKey: "q",
      })
    }

    return chips
  }, [
    activeFilters,
    filterOptions,
    resolvedSearchQuery,
    selectedAvailability,
    selectedAge,
    selectedPriceMin,
    selectedPriceMax,
  ])

  const clearFilter = (paramKey: string | string[]) => {
    if (!shouldUseCustomState && storefrontFilters) {
      const keys = Array.isArray(paramKey) ? paramKey : [paramKey]
      keys.forEach((key) => {
        switch (key) {
          case "availability":
            storefrontFilters.setAvailability(undefined)
            break
          case "age":
            storefrontFilters.updateFilters({ age: undefined, collectionId: undefined }, { resetPage: true })
            break
          case "collection":
            storefrontFilters.setCollection(undefined)
            break
          case "price_min":
          case "price_max":
            storefrontFilters.setPriceRange(undefined)
            break
          case "q":
            storefrontFilters.setSearchQuery(undefined)
            break
          default:
            break
        }
      })
      return
    }

    if (onFiltersChange) {
      const keys = Array.isArray(paramKey) ? paramKey : [paramKey]
      const next: SelectedFilters = { ...effectiveFilters }
      keys.forEach((key) => {
        switch (key) {
          case "availability":
            next.availability = undefined
            break
          case "age":
            next.age = undefined
            next.collection = undefined
            break
          case "collection":
            next.collection = undefined
            break
          case "price_min":
          case "price_max":
            next.priceMin = undefined
            next.priceMax = undefined
            break
          default:
            break
        }
      })
      onFiltersChange(next)
      return
    }

    const params = new URLSearchParams(searchParams)
    const keys = Array.isArray(paramKey) ? paramKey : [paramKey]
    keys.forEach((key) => params.delete(key))
    if (keys.includes("age")) {
      params.delete("collection")
    }
    params.delete("page")
    pushWithParams(params)
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <section className="space-y-8">
        {resolvedFilters.length > 0 && (
          <div className="mb-5 flex flex-wrap gap-2" data-testid="active-filters">
            {resolvedFilters.map((filter) => (
              <button
                key={`${Array.isArray(filter.paramKey) ? filter.paramKey.join("-") : filter.paramKey}-${filter.value}`}
                type="button"
                onClick={() => clearFilter(filter.paramKey)}
                className="group/filter inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-3 py-1 text-xs font-medium text-slate-900 shadow-sm transition-colors hover:bg-gray-50"
                aria-label={`Remove ${filter.label}`}
              >
                <span>{filter.label}</span>
                <span className="text-gray-400 font-bold">x</span>
              </button>
            ))}
          </div>
        )}

        <div className="space-y-8">
          {filterOptions?.availability?.length ? (
            <FilterSection title="Availability">
              <CheckboxGroup
                options={filterOptions.availability}
                selectedValue={selectedAvailability}
                onChange={(value) => toggleCheckboxParam("availability", value)}
              />
            </FilterSection>
          ) : null}

          <FilterSection title="Price">
            <PriceRangeControls
              priceRange={priceRange}
              priceSliderDomain={priceSliderDomain}
              onRangeChange={updatePriceRange}
              onRangeValuesChange={updatePriceRangeValues}
            />
          </FilterSection>

          {filterOptions?.ages?.length ? (
            <FilterSection title="Shop by age">
              <CheckboxGroup
                options={filterOptions.ages}
                selectedValue={selectedAge}
                onChange={(value) => toggleCheckboxParam("age", value)}
              />
            </FilterSection>
          ) : null}
        </div>
      </section>
    </div>
  )
}

const FilterSection = ({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) => (
  <div className="space-y-3">
    <p className="text-sm font-bold uppercase tracking-wider text-slate-900">{title}</p>
    <div className="space-y-3">{children}</div>
  </div>
)

const CheckboxGroup = ({
  options,
  selectedValue,
  onChange,
}: {
  options: FilterOption[]
  selectedValue?: string
  onChange: (_value: string) => void
}) => (
  <div className="space-y-2">
    {options.map((option) => {
      const isChecked = selectedValue === option.value

      return (
        <label key={option.value} className="flex items-center gap-3 text-sm font-medium text-gray-700 cursor-pointer hover:text-slate-900 transition-colors">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={() => onChange(option.value)}
            className="h-4 w-4 rounded border-gray-300 text-slate-900 focus:ring-slate-900"
          />
          <span className="flex-1">
            {option.label}
            {typeof option.count === "number" && (
              <span className="text-gray-400 text-xs ml-1 font-normal"> ({option.count})</span>
            )}
          </span>
        </label>
      )
    })}
  </div>
)

const PriceRangeControls = ({
  priceRange,
  priceSliderDomain,
  onRangeChange,
  onRangeValuesChange,
}: {
  priceRange: PriceRangeState
  priceSliderDomain: { min: number; max: number }
  onRangeChange: (_range: PriceRangeState, _commit?: boolean) => void
  onRangeValuesChange: (_values: number[], _commit?: boolean) => void
}) => {
  const sliderValues = getPriceSliderValues(priceRange, priceSliderDomain)

  const handleSliderChange = (values: number[]) => {
    onRangeValuesChange(values)
  }

  const handleSliderCommit = (values: number[]) => {
    onRangeValuesChange(values, true)
  }

  const isPresetActive = (preset: PriceRangeState) =>
    (priceRange.min ?? undefined) === (preset.min ?? undefined) &&
    (priceRange.max ?? undefined) === (preset.max ?? undefined)

  const handlePresetClick = (preset: PriceRangeState) => {
    onRangeChange(preset, true)
  }

  return (
    <div className="space-y-3">
      <Slider.Root
        className="relative flex h-6 w-full touch-none select-none items-center"
        min={priceSliderDomain.min}
        max={priceSliderDomain.max}
        step={PRICE_SLIDER_CONFIG.step}
        value={sliderValues}
        minStepsBetweenThumbs={1}
        onValueChange={handleSliderChange}
        onValueCommit={handleSliderCommit}
        aria-label="Price range"
      >
        <Slider.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-gray-200">
          <Slider.Range className="absolute h-full rounded-full bg-slate-900" />
        </Slider.Track>
        <Slider.Thumb
          className="block h-4 w-4 rounded-full border-2 border-slate-900 bg-white shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          aria-label="Start price range"
        />
        <Slider.Thumb
          className="block h-4 w-4 rounded-full border-2 border-slate-900 bg-white shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
          aria-label="End price range"
        />
      </Slider.Root>
      <p className="text-sm font-medium text-slate-900">
        Price: {formatCurrency(sliderValues[0])} - {formatCurrency(sliderValues[1])}
      </p>
      <div className="flex flex-wrap gap-2" aria-label="Preset price ranges">
        {TOYCKER_PRICE_RANGE_PRESETS.map((preset) => {
          const isActive = isPresetActive(preset)

          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className={`rounded-md border px-3 py-2 text-xs font-bold transition ${
                isActive
                  ? "border-sky-600 bg-sky-50 text-slate-900 shadow-sm"
                  : "border-gray-300 bg-white text-slate-900 hover:border-slate-500"
              }`}
              aria-pressed={isActive}
            >
              {preset.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default RefinementList
