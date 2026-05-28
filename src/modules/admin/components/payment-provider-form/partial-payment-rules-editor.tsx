"use client"

import type { PartialPaymentRule } from "@/lib/supabase/types"
import { BadgePercent, IndianRupee, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"

type RuleDraft = {
  key: string
  id: string
  min_order_amount: string
  max_order_amount: string
  advance_percentage: string
  is_active: boolean
}

const createEmptyRule = (index: number): RuleDraft => ({
  key:
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `new-${Date.now()}-${index}`,
  id: "",
  min_order_amount: "0",
  max_order_amount: "",
  advance_percentage: "20",
  is_active: true,
})

const toRuleDraft = (rule: PartialPaymentRule, index: number): RuleDraft => ({
  key: rule.id || `rule-${index}`,
  id: rule.id,
  min_order_amount: String(rule.min_order_amount),
  max_order_amount:
    rule.max_order_amount === null ? "" : String(rule.max_order_amount),
  advance_percentage: String(rule.advance_percentage),
  is_active: rule.is_active,
})

export default function PartialPaymentRulesEditor({
  rules,
}: {
  rules: PartialPaymentRule[]
}) {
  const initialRules = useMemo(
    () =>
      rules.length
        ? rules.map(toRuleDraft)
        : [
            {
              ...createEmptyRule(0),
              min_order_amount: "0",
              max_order_amount: "",
            },
          ],
    [rules]
  )
  const [drafts, setDrafts] = useState<RuleDraft[]>(initialRules)

  const updateDraft = (
    key: string,
    field: keyof Omit<RuleDraft, "key" | "id">,
    value: string | boolean
  ) => {
    setDrafts((current) =>
      current.map((draft) =>
        draft.key === key ? { ...draft, [field]: value } : draft
      )
    )
  }

  const removeDraft = (key: string) => {
    setDrafts((current) =>
      current.length > 1 ? current.filter((draft) => draft.key !== key) : current
    )
  }

  return (
    <div className="md:col-span-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-gray-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-black text-white">
              <BadgePercent className="h-4 w-4" />
            </span>
            <div>
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-900">
                Partial Payment Ranges
              </h4>
              <p className="mt-1 text-xs font-medium text-gray-500">
                Rules are checked from top to bottom against the cart products total.
              </p>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            setDrafts((current) => [...current, createEmptyRule(current.length)])
          }
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-800 shadow-sm transition hover:border-gray-300 hover:bg-gray-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Range
        </button>
      </div>

      <div className="grid gap-3 border-b border-gray-100 px-5 py-4 text-xs text-gray-500 md:grid-cols-3">
        <div className="flex items-start gap-2">
          <IndianRupee className="mt-0.5 h-3.5 w-3.5 text-gray-400" />
          <span>
            Example: min <strong className="text-gray-700">0</strong> and max{" "}
            <strong className="text-gray-700">499</strong> applies up to ₹499.00.
          </span>
        </div>
        <div>
          Leave <strong className="text-gray-700">Max Total</strong> empty for the last open-ended range.
        </div>
        <div>
          Shipping is not used for range matching. Pay Now is still calculated from the final total.
        </div>
      </div>

      <div className="space-y-3 p-5">
        {drafts.map((draft, index) => (
          <div
            key={draft.key}
            className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50/40 p-4 md:grid-cols-[1fr_1fr_1fr_auto_auto]"
          >
            <input type="hidden" name="partial_rule_id" value={draft.id} />
            <input
              type="hidden"
              name="partial_rule_sort_order"
              value={index}
            />
            <input
              type="hidden"
              name="partial_rule_is_active"
              value={draft.is_active ? "true" : "false"}
            />

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Min Total
              </label>
              <input
                type="number"
                name="partial_rule_min_order_amount"
                min="0"
                step="0.01"
                value={draft.min_order_amount}
                onChange={(event) =>
                  updateDraft(draft.key, "min_order_amount", event.target.value)
                }
                className="block w-full rounded-lg border-gray-200 bg-white px-3 py-2 text-sm font-bold focus:border-black focus:ring-0"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Max Total
              </label>
              <input
                type="number"
                name="partial_rule_max_order_amount"
                min="0"
                step="0.01"
                placeholder="No limit"
                value={draft.max_order_amount}
                onChange={(event) =>
                  updateDraft(draft.key, "max_order_amount", event.target.value)
                }
                className="block w-full rounded-lg border-gray-200 bg-white px-3 py-2 text-sm font-bold focus:border-black focus:ring-0"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Advance %
              </label>
              <input
                type="number"
                name="partial_rule_advance_percentage"
                min="0.01"
                max="99.99"
                step="0.01"
                value={draft.advance_percentage}
                onChange={(event) =>
                  updateDraft(
                    draft.key,
                    "advance_percentage",
                    event.target.value
                  )
                }
                className="block w-full rounded-lg border-gray-200 bg-white px-3 py-2 text-sm font-bold focus:border-black focus:ring-0"
              />
            </div>

            <label className="flex items-center gap-2 self-end rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-600">
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(event) =>
                  updateDraft(draft.key, "is_active", event.target.checked)
                }
                className="rounded border-gray-300 text-black focus:ring-black"
              />
              Active
            </label>

            <button
              type="button"
              onClick={() => removeDraft(draft.key)}
              disabled={drafts.length === 1}
              className="inline-flex items-center justify-center self-end rounded-lg border border-gray-200 px-3 py-2 text-gray-400 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Remove partial payment range"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
