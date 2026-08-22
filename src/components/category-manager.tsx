"use client"

import { useState, useTransition } from "react"
import { ArchiveIcon, ArrowDownIcon, ArrowUpIcon, ChevronDownIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CategoryIcon, CATEGORY_ICON_OPTIONS } from "@/lib/categories/icons"
import { archiveCategory, createCategory, reorderCategories, updateCategory } from "@/lib/categories/actions"
import { applyCategoryAssignments } from "@/lib/categories/actions"
import { suggestInventoryCategories, type InventoryCategorySuggestion } from "@/lib/categories/classifier"
import { useAppSession } from "@/lib/app-session"
import type { CategoryIconKey } from "@/lib/supabase/database.types"

function IconPicker({ value, onChange }: { value: CategoryIconKey; onChange: (value: CategoryIconKey) => void }) {
  return (
    <div className="grid grid-cols-5 gap-2" aria-label="Category icon">
      {CATEGORY_ICON_OPTIONS.map((iconKey) => (
        <button key={iconKey} type="button" aria-label={iconKey} aria-pressed={value === iconKey} onClick={() => onChange(iconKey)} className={`flex size-10 items-center justify-center rounded-lg border ${value === iconKey ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-muted-foreground"}`}>
          <CategoryIcon iconKey={iconKey} className="size-4" />
        </button>
      ))}
    </div>
  )
}

export function CategoryManager() {
  const { householdId, categories, inventory, refreshCategories, refreshInventory } = useAppSession()
  const rows = categories ?? []
  const [name, setName] = useState("")
  const [iconKey, setIconKey] = useState<CategoryIconKey>("shapes")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editIcon, setEditIcon] = useState<CategoryIconKey>("shapes")
  const [pending, startTransition] = useTransition()
  const [suggestions, setSuggestions] = useState<InventoryCategorySuggestion[] | null>(null)
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set())

  function refresh() {
    void refreshCategories()
    void refreshInventory()
  }

  function add() {
    startTransition(async () => {
      const result = await createCategory(name, iconKey)
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      setName("")
      setIconKey("shapes")
      refresh()
    })
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const next = [...rows]
    ;[next[index], next[target]] = [next[target], next[index]]
    startTransition(async () => {
      const result = await reorderCategories(next.map((category) => category.id))
      if ("error" in result) {
        toast.error(result.error)
        return
      }
      refresh()
    })
  }

  return (
    <details className="group rounded-xl border bg-card px-4">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between type-body">
        Categories
        <span className="flex items-center gap-2 type-meta-num">{rows.length}<ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" /></span>
      </summary>
      <div className="space-y-4 pb-4">
        <ul className="divide-y divide-border">
          {rows.map((category, index) => (
            <li key={category.id} className="py-3">
              {editingId === category.id ? (
                <div className="space-y-3">
                  <Input value={editName} maxLength={32} onChange={(event) => setEditName(event.target.value)} />
                  <IconPicker value={editIcon} onChange={setEditIcon} />
                  <div className="flex gap-2">
                    <Button size="sm" disabled={pending} onClick={() => startTransition(async () => { const result = await updateCategory(category.id, editName, editIcon); if ("error" in result) { toast.error(result.error); return }; setEditingId(null); refresh() })}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-muted"><CategoryIcon iconKey={category.iconKey} className="size-4" /></span>
                  <button type="button" className="min-h-10 min-w-0 flex-1 text-left text-sm font-medium" onClick={() => { setEditingId(category.id); setEditName(category.name); setEditIcon(category.iconKey) }}>{category.name}</button>
                  <Button variant="ghost" size="icon-sm" disabled={pending || index === 0} aria-label={`Move ${category.name} up`} onClick={() => move(index, -1)}><ArrowUpIcon /></Button>
                  <Button variant="ghost" size="icon-sm" disabled={pending || index === rows.length - 1} aria-label={`Move ${category.name} down`} onClick={() => move(index, 1)}><ArrowDownIcon /></Button>
                  {category.systemKey !== "other" ? <Button variant="ghost" size="icon-sm" disabled={pending} aria-label={`Archive ${category.name}`} onClick={() => startTransition(async () => { const result = await archiveCategory(category.id); if ("error" in result) { toast.error(result.error); return }; toast.success(result.reassigned ? `${result.reassigned} items moved to Other.` : `${category.name} archived.`); refresh() })}><ArchiveIcon /></Button> : null}
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="space-y-3 rounded-lg bg-muted/50 p-3">
          <p className="type-section">New category</p>
          <Input value={name} maxLength={32} placeholder="Category name" onChange={(event) => setName(event.target.value)} />
          <IconPicker value={iconKey} onChange={setIconKey} />
          <Button variant="outline" disabled={pending || !name.trim() || rows.length >= 24} onClick={add}><PlusIcon data-icon="inline-start" />Add category</Button>
        </div>
        <div className="space-y-3 rounded-lg border p-3">
          <div><p className="type-section">Organize uncategorized items</p><p className="mt-1 type-meta">Frist sends item names and your allowed categories. Nothing changes until you confirm.</p></div>
          {suggestions === null ? (
            <Button variant="outline" disabled={pending || !(inventory ?? []).some((item) => item.category?.id === rows.find((category) => category.systemKey === "other")?.id)} onClick={() => startTransition(async () => { try { const next = await suggestInventoryCategories(householdId); setSuggestions(next); setSelectedSuggestions(new Set(next.filter((entry) => entry.categoryId !== rows.find((category) => category.systemKey === "other")?.id).map((entry) => entry.itemId))) } catch (error) { toast.error(error instanceof Error ? error.message : "Items could not be organized.") } })}>Review suggestions</Button>
          ) : suggestions.length === 0 ? <p className="type-meta">There are no uncategorized items to organize.</p> : (
            <div className="space-y-2">
              {suggestions.map((suggestion) => {
                const item = inventory?.find((entry) => entry.id === suggestion.itemId)
                return <label key={suggestion.itemId} className="flex items-start gap-3 rounded-lg bg-muted/50 p-3 text-sm"><input type="checkbox" className="mt-0.5 size-4 accent-foreground" checked={selectedSuggestions.has(suggestion.itemId)} onChange={(event) => setSelectedSuggestions((current) => { const next = new Set(current); if (event.target.checked) next.add(suggestion.itemId); else next.delete(suggestion.itemId); return next })} /><span><span className="font-medium">{item?.displayName ?? "Item"}</span><span className="block text-xs text-muted-foreground">{suggestion.categoryName}{suggestion.reason ? ` · ${suggestion.reason}` : ""}</span></span></label>
              })}
              <div className="flex gap-2"><Button size="sm" disabled={pending || selectedSuggestions.size === 0} onClick={() => startTransition(async () => { const chosen = suggestions.filter((entry) => selectedSuggestions.has(entry.itemId)); const result = await applyCategoryAssignments(chosen.map((entry) => ({ itemId: entry.itemId, categoryId: entry.categoryId }))); if ("error" in result) { toast.error(result.error); return }; toast.success(`${result.updated} items organized.`); setSuggestions(null); refresh() })}>Apply selected</Button><Button size="sm" variant="ghost" onClick={() => setSuggestions(null)}>Cancel</Button></div>
            </div>
          )}
        </div>
      </div>
    </details>
  )
}
