const MAX_EDGE = 1600
const MAX_BYTES = 2 * 1024 * 1024

async function canvasBlob(
  canvas: HTMLCanvasElement,
  type: "image/webp" | "image/jpeg",
  quality: number
) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}

export async function prepareCaptureImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.")

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext("2d", { alpha: false })
  if (!context) {
    bitmap.close()
    throw new Error("This image could not be prepared.")
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  for (const type of ["image/webp", "image/jpeg"] as const) {
    for (const quality of [0.84, 0.72, 0.6, 0.48]) {
      const blob = await canvasBlob(canvas, type, quality)
      if (blob && blob.size <= MAX_BYTES) return blob
    }
  }

  throw new Error("The image is too large. Move closer and try again.")
}
