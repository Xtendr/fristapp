"use client"

import { useState } from "react"
import { da } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"

function parseDateValue(value: string): Date | undefined {
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function toDateValue(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function offsetDate(days: number): Date {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date
}

function displayDate(value: string): string {
  const date = parseDateValue(value)
  if (!date) return "Choose a date"
  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date)
}

export function ExpiryDateField({
  id,
  name,
  value,
  onChange,
  required,
}: {
  id: string
  name: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Date | undefined>(parseDateValue(value))

  function openPicker() {
    setDraft(parseDateValue(value) ?? offsetDate(0))
  }

  return (
    <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
      <input type="hidden" id={id} name={name} value={value} required={required} />
      <DrawerTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
            onClick={openPicker}
          />
        }
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {displayDate(value)}
        </span>
        <CalendarIcon data-icon="inline-end" />
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Choose expiry date</DrawerTitle>
          <DrawerDescription>
            Select the date printed on the product.
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-3 overflow-y-auto px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Today", days: 0 },
              { label: "Tomorrow", days: 1 },
              { label: "+1 week", days: 7 },
            ].map((option) => (
              <Button
                key={option.label}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDraft(offsetDate(option.days))}
              >
                {option.label}
              </Button>
            ))}
          </div>
          <Calendar
            mode="single"
            selected={draft}
            defaultMonth={draft}
            onSelect={setDraft}
            locale={da}
            className="mx-auto w-full [--cell-size:2.75rem]"
          />
        </div>
        <DrawerFooter>
          <Button
            type="button"
            disabled={!draft}
            onClick={() => {
              if (draft) onChange(toDateValue(draft))
              setOpen(false)
            }}
          >
            Use date
          </Button>
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
