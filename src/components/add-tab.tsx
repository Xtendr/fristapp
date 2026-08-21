"use client"

import { useState } from "react"
import { CameraIcon, LayersIcon, PenLineIcon, ScanLineIcon } from "lucide-react"

import { BarcodeCapture } from "@/components/barcode-capture"
import { InventoryItemForm } from "@/components/inventory-item-form"
import { PhotoCapture } from "@/components/photo-capture"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useAppSession } from "@/lib/app-session"

const modes = [
  { id: "scan", label: "Scan", icon: ScanLineIcon },
  { id: "photo", label: "Photo", icon: CameraIcon },
  { id: "batch", label: "Batch", icon: LayersIcon },
  { id: "manual", label: "Manual", icon: PenLineIcon },
] as const

type AddMode = (typeof modes)[number]["id"]

export function AddTab() {
  const [mode, setMode] = useState<AddMode>("manual")
  const { activeTab } = useAppSession()
  const tabIsActive = !activeTab || activeTab === "/add"

  return (
    <section className="flex flex-col gap-5 px-4 py-2">
      <div>
        <h1 className="type-display">Add</h1>
        <p className="mt-1 type-body-secondary">Choose the fastest way to add food.</p>
      </div>

      <ToggleGroup
        value={[mode]}
        onValueChange={(value) => {
          const next = value[0] as AddMode | undefined
          if (next) setMode(next)
        }}
        className="grid w-full grid-cols-4 gap-2"
        aria-label="Add method"
      >
        {modes.map((item) => {
          const Icon = item.icon
          return (
            <ToggleGroupItem
              key={item.id}
              value={item.id}
              aria-label={item.label}
              className="h-20 min-w-0 flex-col gap-2 rounded-xl border border-transparent bg-muted px-1 text-xs text-muted-foreground hover:bg-muted aria-pressed:border-border aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
            >
              <Icon className="size-5" strokeWidth={mode === item.id ? 1.9 : 1.55} />
              <span>{item.label}</span>
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>

      {mode === "scan" && tabIsActive ? <BarcodeCapture /> : null}
      {mode === "photo" ? <PhotoCapture mode="photo" /> : null}
      {mode === "batch" ? <PhotoCapture mode="batch" /> : null}
      {mode === "manual" ? (
        <div className="rounded-xl border bg-card p-4">
          <InventoryItemForm mode="create" />
        </div>
      ) : null}
    </section>
  )
}
