import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { resolve, join } from "node:path"
import { execFileSync, execSync } from "node:child_process"
import { tmpdir } from "node:os"
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local")
  if (!existsSync(path)) {
    return
  }

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }
    const eq = trimmed.indexOf("=")
    if (eq === -1) {
      continue
    }
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}

function loadLocalSupabaseEnv() {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return
  }

  try {
    const output = execFileSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["supabase", "status", "-o", "env"],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }
    )
    for (const line of output.split(/\r?\n/)) {
      const eq = line.indexOf("=")
      if (eq === -1) {
        continue
      }
      const key = line.slice(0, eq).trim()
      const value = line.slice(eq + 1).trim().replace(/^"|"$/g, "")
      if (key === "API_URL" && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
        process.env.NEXT_PUBLIC_SUPABASE_URL = value
      }
      if (
        (key === "ANON_KEY" || key === "PUBLISHABLE_KEY") &&
        !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
      ) {
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = value
      }
    }
  } catch {
    // Local Supabase is optional; hosted credentials in .env.local are enough.
  }
}

loadEnvLocal()
loadLocalSupabaseEnv()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

if (!url || !key) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.\nCopy .env.example to .env.local after creating a Supabase project, or run `npx supabase start` first."
  )
  process.exit(1)
}

const suffix = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`
const password = "FristRls-test-1"

let failed = 0
let passed = 0

function anon() {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function asUser(accessToken) {
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

async function check(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.log(`FAIL  ${name}`)
    console.log(`      ${error instanceof Error ? error.message : error}`)
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function expireInvite(token) {
  const tokenHash = createHash("sha256").update(token).digest("hex")
  const file = join(tmpdir(), `frist-expire-${Date.now()}.sql`)
  writeFileSync(
    file,
    `update public.household_invites set expires_at = now() - interval '1 hour' where token_hash = '${tokenHash}' returning id;\n`
  )
  try {
    const output = execSync(`npx supabase db query --linked --file "${file}"`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    })
    if (!/\b[0-9a-f-]{36}\b/i.test(output)) {
      throw new Error(`failed to expire invite via linked SQL: ${output}`)
    }
  } finally {
    try {
      unlinkSync(file)
    } catch {
      // Temp file cleanup is best-effort.
    }
  }
}

async function signUp(label) {
  const email = `frist.rls.${label}.${suffix}@example.com`
  const client = anon()
  const { data, error } = await client.auth.signUp({ email, password })
  if (error || !data.user) {
    throw new Error(`${label} signup failed: ${error?.message ?? "no user"}`)
  }
  if (!data.session) {
    throw new Error(
      `${label} signup returned no session. Disable Confirm email in Auth settings for this prototype.`
    )
  }
  return {
    email,
    userId: data.user.id,
    accessToken: data.session.access_token,
  }
}

async function main() {
  console.log("Phase 1A RLS proof (two users, publishable key only)\n")
  console.log(`Target: ${url}\n`)

  const userA = await signUp("a")
  const userB = await signUp("b")
  const a = asUser(userA.accessToken)
  const b = asUser(userB.accessToken)

  const { data: houseA, error: houseAError } = await a.rpc("create_household", {
    p_name: "Household A",
  })
  if (houseAError || !houseA) {
    throw new Error(`A create_household failed: ${houseAError?.message}`)
  }

  const { data: houseB, error: houseBError } = await b.rpc("create_household", {
    p_name: "Household B",
  })
  if (houseBError || !houseB) {
    throw new Error(`B create_household failed: ${houseBError?.message}`)
  }

  await check("A selects only household A", async () => {
    const { data, error } = await a.from("households").select("id")
    assert(!error, error?.message ?? "select failed")
    assert(data?.length === 1, `expected 1 household, got ${data?.length}`)
    assert(data[0].id === houseA, "A saw a household that is not A")
  })

  await check("A cannot select B memberships", async () => {
    const { data, error } = await a
      .from("household_members")
      .select("household_id")
      .eq("household_id", houseB)
    assert(!error, error?.message ?? "select failed")
    assert((data ?? []).length === 0, "A saw household B members")
  })

  await check("A cannot select B invites", async () => {
    const { data, error } = await a
      .from("household_invites")
      .select("id")
      .eq("household_id", houseB)
    assert(!error, error?.message ?? "select failed")
    assert((data ?? []).length === 0, "A saw household B invites")
  })

  await check("direct membership INSERT is denied", async () => {
    const { error } = await a.from("household_members").insert({
      household_id: houseB,
      user_id: userA.userId,
      role: "owner",
    })
    assert(error, "direct membership insert unexpectedly succeeded")
  })

  await check("direct membership DELETE is denied", async () => {
    const { error } = await a
      .from("household_members")
      .delete()
      .eq("household_id", houseA)
      .eq("user_id", userA.userId)
    assert(error, "direct membership delete unexpectedly succeeded")
  })

  await check("direct household UPDATE is denied", async () => {
    const { error } = await a
      .from("households")
      .update({ name: "Hijacked table update" })
      .eq("id", houseA)
    assert(error, "direct household UPDATE unexpectedly succeeded")
  })

  await check("A cannot patch created_by", async () => {
    const { error } = await a
      .from("households")
      .update({ created_by: userB.userId })
      .eq("id", houseA)
    assert(error, "updating households.created_by unexpectedly succeeded")
  })

  await check("A can update own display_name", async () => {
    const { data, error } = await a
      .from("profiles")
      .update({ display_name: "User A" })
      .eq("id", userA.userId)
      .select("display_name")
    assert(!error, error?.message ?? "profile update failed")
    assert(data?.[0]?.display_name === "User A", "display_name was not updated")
  })

  await check("A cannot update created_at", async () => {
    const { error } = await a
      .from("profiles")
      .update({ created_at: new Date().toISOString() })
      .eq("id", userA.userId)
    assert(error, "updating profiles.created_at unexpectedly succeeded")
  })

  await check("B cannot update A's profile", async () => {
    const { data, error } = await b
      .from("profiles")
      .update({ display_name: "Hacked" })
      .eq("id", userA.userId)
      .select("id")
    assert(!error, error?.message ?? "cross-profile update errored instead of returning no rows")
    assert((data ?? []).length === 0, "B updated A's profile")
  })

  await check("anon cannot create_household", async () => {
    const { error } = await anon().rpc("create_household", { p_name: "Nope" })
    assert(error, "anon create_household unexpectedly succeeded")
  })

  await check("A cannot create_invite for B", async () => {
    const { error } = await a.rpc("create_invite", { p_household_id: houseB })
    assert(error, "create_invite for B unexpectedly succeeded")
  })

  await check("A cannot rename B", async () => {
    const { error } = await a.rpc("rename_household", {
      p_household_id: houseB,
      p_name: "Hijacked",
    })
    assert(error, "rename_household for B unexpectedly succeeded")
  })

  await check("A can rename A via RPC", async () => {
    const { error } = await a.rpc("rename_household", {
      p_household_id: houseA,
      p_name: "Household A",
    })
    assert(!error, error?.message ?? "rename_household for A failed")
  })

  let itemA
  await check("A can insert inventory into A", async () => {
    const { data, error } = await a
      .from("inventory_items")
      .insert({
        household_id: houseA,
        display_name: "Letmaelk",
        expiry_date: "2026-08-25",
        storage_location: "fridge",
        quantity: 1,
      })
      .select("id, added_by, household_id")
      .single()
    assert(!error && data, error?.message ?? "insert into A failed")
    assert(data.household_id === houseA, "inserted row landed in the wrong household")
    assert(data.added_by === userA.userId, "added_by was not the inserting user")
    itemA = data.id
  })

  await check("B can insert inventory into B", async () => {
    const { data, error } = await b
      .from("inventory_items")
      .insert({
        household_id: houseB,
        display_name: "Kyllingebryst",
        expiry_date: "2026-08-26",
        storage_location: "freezer",
        quantity: 2,
      })
      .select("id")
      .single()
    assert(!error && data, error?.message ?? "insert into B failed")
  })

  await check("A cannot read Household B inventory", async () => {
    const { data, error } = await a
      .from("inventory_items")
      .select("id")
      .eq("household_id", houseB)
    assert(!error, error?.message ?? "select failed")
    assert((data ?? []).length === 0, "A saw Household B inventory")
  })

  await check("A cannot insert into Household B", async () => {
    const { error } = await a.from("inventory_items").insert({
      household_id: houseB,
      display_name: "Hijacked milk",
      expiry_date: "2026-08-25",
      storage_location: "fridge",
    })
    assert(error, "A inserted inventory into B")
  })

  await check("A cannot update Household B inventory", async () => {
    const { data, error } = await a
      .from("inventory_items")
      .update({ display_name: "Hacked" })
      .eq("household_id", houseB)
      .select("id")
    assert(!error, error?.message ?? "cross-household update errored")
    assert((data ?? []).length === 0, "A updated B inventory")
  })

  await check("A cannot delete Household B inventory", async () => {
    const { data, error } = await a
      .from("inventory_items")
      .delete()
      .eq("household_id", houseB)
      .select("id")
    assert(!error, error?.message ?? "cross-household delete errored")
    assert((data ?? []).length === 0, "A deleted B inventory")
  })

  await check("A cannot move an item to Household B", async () => {
    const { error } = await a
      .from("inventory_items")
      .update({ household_id: houseB })
      .eq("id", itemA)
    assert(error, "A changed household_id to B")
  })

  await check("A cannot spoof added_by as B", async () => {
    const { data, error } = await a
      .from("inventory_items")
      .insert({
        household_id: houseA,
        display_name: "Spoofed",
        expiry_date: "2026-08-25",
        storage_location: "pantry",
        added_by: userB.userId,
      })
      .select("id, added_by")
      .single()
    if (error) {
      return
    }
    assert(
      data?.added_by === userA.userId,
      "A stored added_by as B"
    )
    await a.from("inventory_items").delete().eq("id", data.id)
  })

  await check("A can update and delete own inventory", async () => {
    const updated = await a
      .from("inventory_items")
      .update({ display_name: "Letmælk", quantity: 2 })
      .eq("id", itemA)
      .select("display_name, quantity")
      .single()
    assert(!updated.error, updated.error?.message ?? "update failed")
    assert(updated.data?.quantity === 2, "quantity was not updated")
    const removed = await a.from("inventory_items").delete().eq("id", itemA)
    assert(!removed.error, removed.error?.message ?? "delete failed")
  })

  const endpointA = `https://push.example.com/frist-a-${suffix}`
  const endpointB = `https://push.example.com/frist-b-${suffix}`
  let subA

  await check("A can insert own push subscription", async () => {
    const { data, error } = await a
      .from("push_subscriptions")
      .insert({
        endpoint: endpointA,
        p256dh: "p256dh-a",
        auth: "auth-a",
      })
      .select("id, user_id")
      .single()
    assert(!error && data, error?.message ?? "A push insert failed")
    assert(data.user_id === userA.userId, "push subscription user_id was not A")
    subA = data.id
  })

  await check("B can insert own push subscription", async () => {
    const { data, error } = await b
      .from("push_subscriptions")
      .insert({
        endpoint: endpointB,
        p256dh: "p256dh-b",
        auth: "auth-b",
      })
      .select("id")
      .single()
    assert(!error && data, error?.message ?? "B push insert failed")
  })

  await check("A cannot read B push subscriptions", async () => {
    const { data, error } = await a
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", endpointB)
    assert(!error, error?.message ?? "A select of B subscriptions errored")
    assert((data ?? []).length === 0, "A saw B push subscription")
  })

  await check("A cannot insert B's endpoint", async () => {
    const { error } = await a.from("push_subscriptions").insert({
      endpoint: endpointB,
      p256dh: "stolen",
      auth: "stolen",
    })
    assert(error, "A reused B's push endpoint")
  })

  await check("A cannot create a subscription for B", async () => {
    const { data, error } = await a
      .from("push_subscriptions")
      .insert({
        endpoint: `https://push.example.com/frist-spoof-${suffix}`,
        p256dh: "p256dh-spoof",
        auth: "auth-spoof",
        user_id: userB.userId,
      })
      .select("id, user_id")
      .single()
    if (error) {
      return
    }
    assert(data?.user_id === userA.userId, "A stored a push subscription as B")
    await a.from("push_subscriptions").delete().eq("id", data.id)
  })

  await check("A cannot change push subscription user_id", async () => {
    const { error } = await a
      .from("push_subscriptions")
      .update({ user_id: userB.userId })
      .eq("id", subA)
    assert(error, "A changed push subscription user_id")
  })

  await check("A cannot delete B push subscription", async () => {
    const { data, error } = await a
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", endpointB)
      .select("id")
    assert(!error, error?.message ?? "cross-user push delete errored")
    assert((data ?? []).length === 0, "A deleted B push subscription")
  })

  await check("anon cannot access push subscriptions", async () => {
    const { error, data } = await anon().from("push_subscriptions").select("id")
    assert(error || (data ?? []).length === 0, "anon read push_subscriptions")
  })

  await check("authenticated cannot read notification_deliveries", async () => {
    const { error, data } = await a.from("notification_deliveries").select("id")
    assert(
      error || (data ?? []).length === 0,
      "authenticated read notification_deliveries"
    )
  })

  await check("A can delete own push subscription", async () => {
    const { error } = await a.from("push_subscriptions").delete().eq("id", subA)
    assert(!error, error?.message ?? "A could not delete own subscription")
  })

  await check("A cannot accept a fake invite", async () => {
    const { error } = await a.rpc("accept_invite", {
      p_token: "this-token-is-not-real",
    })
    assert(error, "accept_invite with a fake token unexpectedly succeeded")
  })

  await check("private helper is not an API RPC", async () => {
    const { error } = await a.rpc("is_household_member", {
      p_household_id: houseA,
    })
    assert(error, "private.is_household_member was callable via PostgREST")
  })

  await check("Accept-Profile private cannot call helpers", async () => {
    const response = await fetch(`${url}/rest/v1/rpc/is_household_member`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${userA.accessToken}`,
        "Content-Profile": "private",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_household_id: houseA }),
    })
    assert(!response.ok, `private schema RPC returned HTTP ${response.status}`)
  })

  let inviteToken
  await check("A can create an invite for A", async () => {
    const { data, error } = await a.rpc("create_invite", {
      p_household_id: houseA,
    })
    assert(!error && data, error?.message ?? "create_invite failed")
    inviteToken = data
  })

  await check("stored invite token is hashed", async () => {
    const { data, error } = await a
      .from("household_invites")
      .select("token_hash")
      .eq("household_id", houseA)
    assert(!error, error?.message ?? "invite select failed")
    assert((data ?? []).length >= 1, "no invite rows")
    assert(
      data.every(
        (row) =>
          row.token_hash !== inviteToken && /^[a-f0-9]{64}$/.test(row.token_hash)
      ),
      "raw invite token was stored, or hash was not sha256 hex"
    )
  })

  await check("anon can preview a valid invite", async () => {
    const { data, error } = await anon().rpc("get_invite_preview", {
      p_token: inviteToken,
    })
    const preview = Array.isArray(data) ? data[0] : data
    assert(!error, error?.message ?? "preview failed")
    assert(preview?.status === "valid", `expected valid, got ${preview?.status}`)
    assert(
      preview?.household_name === "Household A",
      "preview leaked the wrong household or none"
    )
  })

  let expiredToken
  await check("expired invite cannot be accepted", async () => {
    const created = await a.rpc("create_invite", { p_household_id: houseA })
    assert(
      !created.error && created.data,
      created.error?.message ?? "expired-invite setup failed"
    )
    expiredToken = created.data
    expireInvite(expiredToken)
    const preview = await anon().rpc("get_invite_preview", {
      p_token: expiredToken,
    })
    const row = Array.isArray(preview.data) ? preview.data[0] : preview.data
    assert(row?.status === "expired", `expected expired, got ${row?.status}`)
    const accepted = await b.rpc("accept_invite", { p_token: expiredToken })
    assert(accepted.error, "accept_invite succeeded for an expired token")
  })

  await check("B can accept A's invite", async () => {
    const { data, error } = await b.rpc("accept_invite", {
      p_token: inviteToken,
    })
    assert(!error && data === houseA, error?.message ?? "accept_invite failed")
  })

  await check("duplicate accept is idempotent", async () => {
    const before = await a
      .from("household_members")
      .select("user_id")
      .eq("household_id", houseA)
    assert(!before.error, before.error?.message ?? "member select failed")
    const countBefore = before.data?.length ?? 0
    const second = await b.rpc("accept_invite", { p_token: inviteToken })
    assert(
      !second.error && second.data === houseA,
      second.error?.message ?? "second accept_invite failed"
    )
    const after = await a
      .from("household_members")
      .select("user_id")
      .eq("household_id", houseA)
    assert(!after.error, after.error?.message ?? "member select failed")
    assert(
      after.data?.length === countBefore,
      `duplicate accept changed membership count from ${countBefore} to ${after.data?.length}`
    )
    const userIds = (after.data ?? []).map((row) => row.user_id)
    assert(
      userIds.filter((id) => id === userB.userId).length === 1,
      "duplicate membership row was created"
    )
  })

  await check("B now sees both households", async () => {
    const { data, error } = await b.from("households").select("id")
    assert(!error, error?.message ?? "select failed")
    const ids = new Set((data ?? []).map((row) => row.id))
    assert(ids.has(houseA) && ids.has(houseB), "B did not see both households")
  })

  await check("member B cannot create an invite for A", async () => {
    const { error } = await b.rpc("create_invite", { p_household_id: houseA })
    assert(error, "member create_invite unexpectedly succeeded")
  })

  await check("member B cannot see A's invites", async () => {
    const { data, error } = await b
      .from("household_invites")
      .select("id")
      .eq("household_id", houseA)
    assert(!error, error?.message ?? "invite select failed")
    assert((data ?? []).length === 0, "member saw owner-only invites")
  })

  await check("last owner A cannot leave A", async () => {
    const { error } = await a.rpc("leave_household", {
      p_household_id: houseA,
    })
    assert(error, "last owner leave unexpectedly succeeded")
  })

  await check("A cannot remove themselves via remove_member", async () => {
    const { error } = await a.rpc("remove_member", {
      p_household_id: houseA,
      p_user_id: userA.userId,
    })
    assert(error, "self remove_member unexpectedly succeeded")
  })

  await check("member B cannot remove owner A", async () => {
    const { error } = await b.rpc("remove_member", {
      p_household_id: houseA,
      p_user_id: userA.userId,
    })
    assert(error, "member remove_member unexpectedly succeeded")
  })

  await check("member B can leave A", async () => {
    const { error } = await b.rpc("leave_household", {
      p_household_id: houseA,
    })
    assert(!error, error?.message ?? "member leave_household failed")
  })

  await check("after leaving, B no longer sees household A", async () => {
    const { data, error } = await b.from("households").select("id")
    assert(!error, error?.message ?? "select failed")
    const ids = new Set((data ?? []).map((row) => row.id))
    assert(!ids.has(houseA) && ids.has(houseB), "B still saw household A")
  })

  await check("last remaining owner still cannot leave", async () => {
    const { error } = await a.rpc("leave_household", {
      p_household_id: houseA,
    })
    assert(error, "last remaining owner leave unexpectedly succeeded")
  })

  await check("A can remove B after B rejoins", async () => {
    const accepted = await b.rpc("accept_invite", { p_token: inviteToken })
    assert(
      !accepted.error && accepted.data === houseA,
      accepted.error?.message ?? "re-accept failed"
    )
    const removed = await a.rpc("remove_member", {
      p_household_id: houseA,
      p_user_id: userB.userId,
    })
    assert(!removed.error, removed.error?.message ?? "remove_member failed")
    const { data, error } = await b.from("households").select("id")
    assert(!error, error?.message ?? "select failed")
    const ids = new Set((data ?? []).map((row) => row.id))
    assert(!ids.has(houseA), "B still saw household A after removal")
  })

  await check("revoked invite cannot be accepted", async () => {
    const created = await a.rpc("create_invite", { p_household_id: houseA })
    assert(
      !created.error && created.data,
      created.error?.message ?? "second invite failed"
    )
    const tokenHash = createHash("sha256").update(created.data).digest("hex")
    const listed = await a
      .from("household_invites")
      .select("id, token_hash")
      .eq("token_hash", tokenHash)
      .maybeSingle()
    assert(listed.data?.id, "could not load invite id to revoke")
    const revoked = await a.rpc("revoke_invite", { p_invite_id: listed.data.id })
    assert(!revoked.error, revoked.error?.message ?? "revoke failed")
    const accepted = await b.rpc("accept_invite", { p_token: created.data })
    assert(accepted.error, "accept_invite succeeded after revoke")
    const preview = await anon().rpc("get_invite_preview", {
      p_token: created.data,
    })
    const row = Array.isArray(preview.data) ? preview.data[0] : preview.data
    assert(row?.status === "revoked", `expected revoked, got ${row?.status}`)
  })

  console.log("")
  console.log(`${passed} passed, ${failed} failed`)
  if (failed > 0) {
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
