import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import CategoryCheckboxList from "@/modules/admin/components/category-checkbox-list"
import CollectionCheckboxList from "@/modules/admin/components/collection-checkbox-list"
import { Category, Collection } from "@/lib/supabase/types"

function buildCategories(count = 25): Category[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `cat-${index + 1}`,
    name: `Category ${index + 1}`,
    handle: `category-${index + 1}`,
    description: null,
    parent_category_id: null,
    created_at: "2026-03-17T00:00:00.000Z",
    image_url: null,
  }))
}

function buildCollections(count = 25): Collection[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `col-${index + 1}`,
    title: `Collection ${index + 1}`,
    handle: `collection-${index + 1}`,
    created_at: "2026-03-17T00:00:00.000Z",
    image_url: null,
    products: [],
  }))
}

describe("CategoryCheckboxList", () => {
  it("shows 20 by default and searches across the full category dataset", () => {
    render(
      <CategoryCheckboxList
        categories={buildCategories()}
        selectedIds={[]}
        name="category_ids"
        defaultVisibleCount={20}
      />
    )

    expect(
      screen.getByText("Showing first 20 of 25. Search to find more.")
    ).toBeInTheDocument()
    expect(screen.getByText("Category 20")).toBeInTheDocument()
    expect(screen.queryByText("Category 21")).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("Search categories..."), {
      target: { value: "category-25" },
    })

    expect(screen.getByText("Category 25")).toBeInTheDocument()
    expect(screen.getByText("Showing 1 matching result.")).toBeInTheDocument()
  })

  it("keeps selected categories outside the default 20 visible", () => {
    render(
      <CategoryCheckboxList
        categories={buildCategories()}
        selectedIds={["cat-25"]}
        name="category_ids"
        defaultVisibleCount={20}
      />
    )

    expect(screen.getByText("Category 20")).toBeInTheDocument()
    expect(screen.queryByText("Category 21")).not.toBeInTheDocument()
    expect(screen.getByText("Category 25")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Showing first 20 of 25. 1 selected item kept visible."
      )
    ).toBeInTheDocument()
  })

  it("shows all categories by default when no visibility limit is provided", () => {
    render(
      <CategoryCheckboxList
        categories={buildCategories()}
        selectedIds={[]}
        name="category_ids"
      />
    )

    expect(screen.getByText("Category 25")).toBeInTheDocument()
    expect(
      screen.queryByText("Showing first 20 of 25. Search to find more.")
    ).not.toBeInTheDocument()
  })
})

describe("CollectionCheckboxList", () => {
  it("shows 20 by default and searches across the full collection dataset", () => {
    render(
      <CollectionCheckboxList
        collections={buildCollections()}
        selectedIds={[]}
        name="collection_ids"
        defaultVisibleCount={20}
      />
    )

    expect(
      screen.getByText("Showing first 20 of 25. Search to find more.")
    ).toBeInTheDocument()
    expect(screen.getByText("Collection 20")).toBeInTheDocument()
    expect(screen.queryByText("Collection 21")).not.toBeInTheDocument()

    fireEvent.change(screen.getByPlaceholderText("Search collections..."), {
      target: { value: "collection-25" },
    })

    expect(screen.getByText("Collection 25")).toBeInTheDocument()
    expect(screen.getByText("Showing 1 matching result.")).toBeInTheDocument()
  })

  it("keeps selected collections outside the default 20 visible", () => {
    render(
      <CollectionCheckboxList
        collections={buildCollections()}
        selectedIds={["col-25"]}
        name="collection_ids"
        defaultVisibleCount={20}
      />
    )

    expect(screen.getByText("Collection 20")).toBeInTheDocument()
    expect(screen.queryByText("Collection 21")).not.toBeInTheDocument()
    expect(screen.getByText("Collection 25")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Showing first 20 of 25. 1 selected item kept visible."
      )
    ).toBeInTheDocument()
  })

  it("shows all collections by default when no visibility limit is provided", () => {
    render(
      <CollectionCheckboxList
        collections={buildCollections()}
        selectedIds={[]}
        name="collection_ids"
      />
    )

    expect(screen.getByText("Collection 25")).toBeInTheDocument()
    expect(
      screen.queryByText("Showing first 20 of 25. Search to find more.")
    ).not.toBeInTheDocument()
  })
})
