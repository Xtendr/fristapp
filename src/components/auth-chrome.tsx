import { APP_NAME } from "@/lib/app"

export function AuthChrome({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
      <p className="text-sm font-medium tracking-tight">{APP_NAME}</p>
      <section className="mt-10 flex flex-col gap-2">
        <h1 className="text-lg font-medium tracking-tight">{title}</h1>
        {description ? (
          <p className="max-w-prose text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        ) : null}
      </section>
      <div className="mt-6">{children}</div>
    </div>
  )
}
