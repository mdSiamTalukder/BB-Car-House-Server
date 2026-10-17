/**
 * Read-only verification against the real .env and a real Neon database:
 * signs in with the seeded admin and exercises the protected routes.
 * Never prints credentials or tokens.
 *
 * Usage: CHECK_PORT=5071 npx tsx scripts/verify-live.ts
 */
import "dotenv/config";

const BASE = `http://localhost:${process.env.CHECK_PORT ?? "5071"}`;

function assert(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` ${detail}` : ""}`);
  if (!ok) process.exitCode = 1;
}

async function main() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_EMAIL / ADMIN_PASSWORD are not set in server/.env");
  }

  const login = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    })
  });

  const loginBody: any = await login.json();
  assert("POST /api/auth/login", login.ok, `(${login.status})`);
  assert("login returns a token", typeof loginBody?.data?.token === "string");

  const token = loginBody?.data?.token;

  const me = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const meBody: any = await me.json();
  assert("GET /api/auth/me", me.ok, `(${me.status})`);
  assert("me returns the admin email", meBody?.data?.user?.email === process.env.ADMIN_EMAIL);
  assert("me returns a user id", typeof meBody?.data?.user?.id === "string");
  assert("me never leaks passwordHash", meBody?.data?.user?.passwordHash === undefined);

  const cars = await fetch(`${BASE}/api/cars?pageSize=3`);
  const carsBody: any = await cars.json();
  assert("GET /api/cars (live Neon query)", cars.ok, `(${cars.status})`);
  assert("cars response is an array", Array.isArray(carsBody?.data?.cars));
  assert("pagination meta present", typeof carsBody?.meta?.pagination?.total === "number");

  const bySlug = carsBody?.data?.cars?.[0]?.slug;
  if (bySlug) {
    const detail = await fetch(`${BASE}/api/cars/slug/${bySlug}`);
    assert("GET /api/cars/slug/:slug", detail.ok, `(${detail.status})`);
  }

  const inquiries = await fetch(`${BASE}/api/inquiries`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert("GET /api/inquiries (admin)", inquiries.ok, `(${inquiries.status})`);

  const dashboard = await fetch(`${BASE}/api/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const dashBody: any = await dashboard.json();
  assert("GET /api/admin/dashboard", dashboard.ok, `(${dashboard.status})`);
  assert("dashboard has car totals", typeof dashBody?.data?.cars?.total === "number");

  const badLogin = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: "definitely-wrong-password" })
  });
  assert("POST /api/auth/login (wrong password)", badLogin.status === 401, `(${badLogin.status})`);
}

main().catch((error) => {
  console.error("  FAIL  verification crashed:", error);
  process.exitCode = 1;
});