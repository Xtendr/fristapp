"use client"

import { MinusIcon, PlusIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

export function QuantityStepper({
  id,
  name,
  value,
  onChange,
}: {
  id: string
  name: string
  value: number
  onChange: (value: number) => void
}) {
  const safeValue = Number.isFinite(value) ? Math.min(99, Math.max(1, value)) : 1

  return (
    <div className="flex items-center justify-between rounded-lg border border-input bg-background p-1">
      <input type="hidden" id={id} name={name} value={safeValue} />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={safeValue <= 1}
        aria-label="Decrease quantity"
        onClick={() => onChange(Math.max(1, safeValue - 1))}
      >
        <MinusIcon />
      </Button>
      <output htmlFor={id} className="min-w-10 text-center text-sm font-medium tabular-nums">
        {safeValue}
      </output>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        disabled={safeValue >= 99}
        aria-label="Increase quantity"
        onClick={() => onChange(Math.min(99, safeValue + 1))}
      >
        <PlusIcon />
      </Button>
    </div>
  )
}
