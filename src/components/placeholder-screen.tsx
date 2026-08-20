export function PlaceholderScreen({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <section className="flex flex-col gap-2 px-4 py-2">
      <h1 className="text-lg font-medium tracking-tight">{title}</h1>
      <p className="max-w-prose text-sm leading-6 text-muted-foreground">
        {description}
      </p>
    </section>
  )
}
