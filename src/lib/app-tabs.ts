export const APP_TAB_HREFS = ["/", "/inventory", "/add", "/household"] as const

export type AppTabHref = (typeof APP_TAB_HREFS)[number]

export function isAppTabHref(pathname: string): pathname is AppTabHref {
  return (APP_TAB_HREFS as readonly string[]).includes(pathname)
}
