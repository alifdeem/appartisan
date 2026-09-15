/**
 * Seed the three test accounts.
 *
 *   npm run db:seed
 *
 * Categories, transport zones and settings are seeded by migration
 * 0004_reference_data.sql, so this script only creates the users — the one
 * thing a SQL migration cannot do, because `auth.users` rows must go through
 * Supabase's Auth API to get a valid identity record.
 *
 * Idempotent: run it as many times as you like. Existing accounts are updated
 * in place rather than duplicated.
 *
 * Refuses to run against a production URL without SEED_ALLOW_PRODUCTION=true.
 * Seeding fake artisans into a live marketplace is not a recoverable mistake.
 */

import { randomBytes } from "node:crypto";

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "\n  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "  Copy .env.example to .env.local and fill them in first.\n",
  );
  process.exit(1);
}

if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
  console.error("\n  Refusing to seed test accounts in production.\n");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** Mirrors src/lib/dev/seed-accounts.ts — keep the two in step. */
const ACCOUNTS = [
  {
    role: "client" as const,
    phone: "+233241111111",
    fullName: "Ama Boateng",
    languages: ["English", "Twi"],
  },
  {
    role: "provider" as const,
    phone: "+233242222222",
    fullName: "Kwame Mensah",
    languages: ["English", "Twi", "Ga"],
  },
  {
    role: "admin" as const,
    phone: "+233243333333",
    fullName: "ArtisanGH Admin",
    languages: ["English"],
  },
];

const syntheticEmail = (phone: string) => `${phone.replace("+", "")}@phone.artisangh.app`;

async function findAuthUserByEmail(email: string) {
  // The admin API has no get-by-email, so page through. Fine at seed scale.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email === email);
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function upsertAccount(account: (typeof ACCOUNTS)[number]) {
  const email = syntheticEmail(account.phone);
  const metadata = {
    phone: account.phone,
    full_name: account.fullName,
    role: account.role,
    spoken_languages: account.languages,
    // The database trigger refuses to self-provision an admin unless this is
    // set. Only the seed script and a real admin invite ever set it.
    allow_admin: account.role === "admin",
  };

  const existing = await findAuthUserByEmail(email);

  if (existing) {
    await supabase.auth.admin.updateUserById(existing.id, { user_metadata: metadata });
    // The trigger only fires on insert, so keep the profile in step by hand.
    await supabase
      .from("profiles")
      .update({
        role: account.role,
        full_name: account.fullName,
        spoken_languages: account.languages,
        is_active: true,
      })
      .eq("id", existing.id);

    console.log(`  ↻ ${account.role.padEnd(8)} ${account.phone}  ${account.fullName}`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    password: randomBytes(32).toString("hex"),
    user_metadata: metadata,
  });

  if (error || !data.user) {
    throw new Error(`Could not create ${account.role}: ${error?.message}`);
  }

  console.log(`  + ${account.role.padEnd(8)} ${account.phone}  ${account.fullName}`);
  return data.user.id;
}

/**
 * The seeded artisan is pre-approved and placed in Osu, so matching has
 * something to find the moment Phase 3 lands. Roughly 5.56°W / 5.56°N.
 */
async function configureSeedProvider(profileId: string) {
  const { error } = await supabase
    .from("providers")
    .update({
      verification_status: "approved",
      availability: "online",
      bio: "Certified electrician with 9 years on residential and small commercial jobs across Greater Accra. Fuse boards, rewiring, faults and lighting.",
      years_experience: 9,
      base_city: "Accra",
      service_radius_km: 15,
      momo_number: "+233242222222",
      momo_network: "mtn",
      ghana_card_number: "GHA-729184003-5",
      application_submitted_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId);

  if (error) throw new Error(`Could not configure provider: ${error.message}`);

  // PostGIS point has to go through SQL — PostgREST cannot write geography
  // from JSON. `ST_MakePoint` takes longitude first, which is the classic way
  // to end up with an artisan somewhere off the coast of Somalia.
  const { error: locationError } = await supabase.rpc("set_provider_location", {
    p_provider_id: profileId,
    p_lng: -0.1826,
    p_lat: 5.5573,
  });

  if (locationError) {
    console.warn(
      `  ! Could not set provider location (${locationError.message}).\n` +
        `    Matching will not find this artisan until a location is set.`,
    );
  }

  // Electrical, so there is a category to match against.
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", "electrical")
    .maybeSingle();

  if (category) {
    await supabase
      .from("provider_categories")
      .upsert(
        { provider_id: profileId, category_id: category.id },
        { onConflict: "provider_id,category_id" },
      );
  }
}

async function main() {
  console.log(`\n  Seeding ${new URL(SUPABASE_URL!).host}\n`);

  const { count: categoryCount, error: categoryError } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true });

  if (categoryError) {
    console.error(
      `\n  Could not read categories: ${categoryError.message}\n` +
        `  Have the migrations in supabase/migrations/ been applied? Run \`npm run db:push\`.\n`,
    );
    process.exit(1);
  }

  if (!categoryCount) {
    console.error(
      "\n  No categories found. Apply 0004_reference_data.sql before seeding accounts.\n",
    );
    process.exit(1);
  }

  console.log("  Accounts");
  const ids: Record<string, string> = {};
  for (const account of ACCOUNTS) {
    ids[account.role] = await upsertAccount(account);
  }

  console.log("\n  Artisan profile");
  await configureSeedProvider(ids.provider);
  console.log("    approved · online · Electrical · Osu, Accra");

  console.log(
    `\n  Done. ${categoryCount} categories in place.\n` +
      `  Log in at /login with any of the numbers above.\n` +
      `  While SMS_PROVIDER=mock the code is ${process.env.DEV_OTP_CODE ?? "000000"}.\n`,
  );
}

main().catch((error) => {
  console.error("\n  Seed failed:", error instanceof Error ? error.message : error, "\n");
  process.exit(1);
});
