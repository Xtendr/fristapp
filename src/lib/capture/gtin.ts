export type BarcodeKind =
  | "EAN_8"
  | "EAN_13"
  | "UPC_A"
  | "UPC_E"
  | "UNKNOWN"

export type GtinResult =
  | { success: true; gtin: string }
  | { success: false; error: string }

function checkDigitIsValid(value: string): boolean {
  const digits = value.split("").map(Number)
  const supplied = digits.pop()
  if (supplied === undefined) return false

  let weightedSum = 0
  for (let index = digits.length - 1, offset = 0; index >= 0; index--, offset++) {
    weightedSum += digits[index] * (offset % 2 === 0 ? 3 : 1)
  }

  return (10 - (weightedSum % 10)) % 10 === supplied
}

function expandUpcE(value: string): string | null {
  const numberSystem = value.length === 8 ? value[0] : "0"
  const digits = value.length === 8 ? value.slice(1) : value
  if (!["0", "1"].includes(numberSystem) || digits.length !== 7) return null

  const payload = digits.slice(0, 6)
  const checkDigit = digits[6]
  const [a, b, c, d, e, f] = payload
  let manufacturer: string
  let product: string

  if (["0", "1", "2"].includes(f)) {
    manufacturer = `${a}${b}${f}00`
    product = `00${c}${d}${e}`
  } else if (f === "3") {
    manufacturer = `${a}${b}${c}00`
    product = `000${d}${e}`
  } else if (f === "4") {
    manufacturer = `${a}${b}${c}${d}0`
    product = `0000${e}`
  } else {
    manufacturer = `${a}${b}${c}${d}${e}`
    product = `0000${f}`
  }

  return `${numberSystem}${manufacturer}${product}${checkDigit}`
}

export function normalizeGtin(
  rawValue: string,
  kind: BarcodeKind = "UNKNOWN"
): GtinResult {
  const value = rawValue.trim().replace(/[\s-]/g, "")
  if (!/^\d+$/.test(value)) {
    return { success: false, error: "The barcode contains unsupported characters." }
  }

  let normalized = value
  if (kind === "UPC_E") {
    const expanded = expandUpcE(value)
    if (!expanded) {
      return { success: false, error: "This UPC-E barcode could not be expanded." }
    }
    normalized = `0${expanded}`
  } else if (value.length === 12 || kind === "UPC_A") {
    normalized = `0${value}`
  }

  if (![8, 13, 14].includes(normalized.length)) {
    return { success: false, error: "Frist supports EAN-8, EAN-13, UPC-A, and UPC-E barcodes." }
  }

  if (!checkDigitIsValid(normalized)) {
    return { success: false, error: "The barcode check digit is invalid." }
  }

  return { success: true, gtin: normalized }
}
