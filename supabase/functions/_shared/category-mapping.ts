export type CategorySystemKey =
  | "dairy_eggs"
  | "fruit_vegetables"
  | "meat_fish"
  | "bread_bakery"
  | "meals_leftovers"
  | "drinks"
  | "pantry_staples"
  | "condiments"
  | "snacks"
  | "other"

const CATEGORY_MAPPINGS: ReadonlyArray<readonly [CategorySystemKey, RegExp]> = [
  ["dairy_eggs", /dair|milk|cheese|yogurt|yoghurt|egg|mælk|ost/],
  ["fruit_vegetables", /fruit|vegetable|plant-based|frugt|grønt|groent/],
  ["meat_fish", /meat|fish|seafood|poultry|kød|fisk/],
  ["bread_bakery", /bread|bakery|pastr|biscuit|brød|bager/],
  ["meals_leftovers", /meal|prepared|pizza|sandwich|ready-to-eat/],
  ["drinks", /beverage|drink|juice|water|soda|coffee|tea/],
  ["condiments", /sauce|spread|condiment|dressing|pesto/],
  ["snacks", /snack|chocolate|candy|sweet|chips|crisp/],
  ["pantry_staples", /cereal|pasta|rice|flour|oil|legume|grain/],
]

export function mapExternalCategoryTags(tags: unknown): CategorySystemKey {
  if (!Array.isArray(tags)) return "other"
  const searchable = tags
    .filter((tag): tag is string => typeof tag === "string")
    .join(" ")
    .toLocaleLowerCase("da-DK")

  return CATEGORY_MAPPINGS.find(([, pattern]) => pattern.test(searchable))?.[0] ?? "other"
}
