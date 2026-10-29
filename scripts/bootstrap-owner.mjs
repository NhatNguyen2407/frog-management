import { spawnSync } from "node:child_process";
const email = (process.env.INITIAL_OWNER_EMAIL ?? "").trim().toLowerCase();
const slug = process.env.INITIAL_BUSINESS_UNIT_SLUG ?? "workshop";
if (
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
  !email ||
  !slug.match(/^[a-z0-9]+(-[a-z0-9]+)*$/)
) {
  console.error("Set INITIAL_OWNER_EMAIL and INITIAL_BUSINESS_UNIT_SLUG in .env.local first.");
  process.exit(1);
}
const sql = `insert into public.staff_allowlist(business_unit_id,email,role,active) select id,'${email.replaceAll("'", "''")}','owner',true from public.business_units where slug='${slug}' on conflict(business_unit_id,email) do update set role='owner',active=true returning id;`;
const target = process.argv.includes("--linked") ? "--linked" : "--local";
const result = spawnSync("supabase", ["db", "query", target, sql], {
  encoding: "utf8",
  shell: false,
});
if (result.error || result.status !== 0) {
  console.error(result.error?.message ?? result.stderr);
  process.exit(1);
}
console.log("Owner allowlist bootstrap completed. No Google account or customer was created.");
