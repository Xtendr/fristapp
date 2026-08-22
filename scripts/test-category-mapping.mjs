import assert from "node:assert/strict"

import { mapExternalCategoryTags } from "../supabase/functions/_shared/category-mapping.ts"

assert.equal(mapExternalCategoryTags(["en:milks"]), "dairy_eggs")
assert.equal(mapExternalCategoryTags(["da:frugt-og-groent"]), "fruit_vegetables")
assert.equal(mapExternalCategoryTags(["en:fishes"]), "meat_fish")
assert.equal(mapExternalCategoryTags(["en:breads"]), "bread_bakery")
assert.equal(mapExternalCategoryTags(["en:prepared-meals"]), "meals_leftovers")
assert.equal(mapExternalCategoryTags(["en:beverages"]), "drinks")
assert.equal(mapExternalCategoryTags(["en:pesto"]), "condiments")
assert.equal(mapExternalCategoryTags(["en:snacks"]), "snacks")
assert.equal(mapExternalCategoryTags(["en:pasta"]), "pantry_staples")
assert.equal(mapExternalCategoryTags(["en:unknown-category"]), "other")
assert.equal(mapExternalCategoryTags(null), "other")

console.log("Category mapping tests passed")
