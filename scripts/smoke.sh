#!/usr/bin/env bash
# Smoke tests for routes that do not need a live database or Cloudinary account.
# Usage: ./scripts/smoke.sh [port]
#
# The child process is started with DATABASE_URL and the CLOUDINARY_* variables
# explicitly blanked. dotenv never overrides variables that already exist in
# process.env, so this keeps the assertions deterministic regardless of what is
# in your local .env.
set -uo pipefail

PORT="${1:-5057}"
BASE="http://localhost:${PORT}"
JWT_SECRET="test-secret-value-that-is-at-least-32-chars-long"
PASS=0
FAIL=0

start_server() {
  PORT="$PORT" \
  JWT_SECRET="$JWT_SECRET" \
  CLIENT_URL="http://localhost:3000" \
  DATABASE_URL="" \
  CLOUDINARY_CLOUD_NAME="" \
  CLOUDINARY_API_KEY="" \
  CLOUDINARY_API_SECRET="" \
    node dist/server.js > /tmp/bbc-smoke-server.log 2>&1 &
  SERVER_PID=$!
  for _ in $(seq 1 40); do
    if curl -fs "$BASE/api/health" > /dev/null 2>&1; then return 0; fi
    sleep 0.25
  done
  echo "server failed to start"; cat /tmp/bbc-smoke-server.log; exit 1
}

cleanup() {
  [ -n "${SERVER_PID:-}" ] && kill "$SERVER_PID" 2>/dev/null
}
trap cleanup EXIT

check() {
  local name="$1" expected="$2" actual="$3"
  if [ "$expected" = "$actual" ]; then
    printf '  PASS  %-58s %s\n' "$name" "$actual"; PASS=$((PASS + 1))
  else
    printf '  FAIL  %-58s expected %s, got %s\n' "$name" "$expected" "$actual"; FAIL=$((FAIL + 1))
  fi
}

check_body() {
  local name="$1" needle="$2" body="$3"
  if printf '%s' "$body" | grep -q "$needle"; then
    printf '  PASS  %-58s contains %s\n' "$name" "$needle"; PASS=$((PASS + 1))
  else
    printf '  FAIL  %-58s missing %s in: %s\n' "$name" "$needle" "$body"; FAIL=$((FAIL + 1))
  fi
}

status() { curl -s -o /tmp/bbc-smoke-body.json -w '%{http_code}' "$@"; }

start_server

echo "Running smoke tests against ${BASE}"

BODY=$(status "$BASE/api/health")
check "GET /api/health" 200 "$BODY"
check_body "GET /api/health payload" '"success":true' "$(cat /tmp/bbc-smoke-body.json)"
check_body "GET /api/health (cloudinary off)" '"cloudinaryConfigured":false' "$(cat /tmp/bbc-smoke-body.json)"
check_body "GET /api/health (reports missing cloudinary)" 'CLOUDINARY_CLOUD_NAME' "$(cat /tmp/bbc-smoke-body.json)"

BODY=$(status "$BASE/api/nope")
check "GET /api/nope (unknown route)" 404 "$BODY"
check_body "GET /api/nope payload" '"code":"ROUTE_NOT_FOUND"' "$(cat /tmp/bbc-smoke-body.json)"

BODY=$(status -X POST "$BASE/api/inquiries" -H 'Content-Type: application/json' \
  -d '{"name":"A","email":"not-an-email","message":"short"}')
check "POST /api/inquiries (invalid body)" 422 "$BODY"
check_body "POST /api/inquiries (invalid body)" '"success":false' "$(cat /tmp/bbc-smoke-body.json)"

BODY=$(status "$BASE/api/admin/dashboard")
check "GET /api/admin/dashboard (no token)" 401 "$BODY"
check_body "GET /api/admin/dashboard (no token)" 'Missing bearer token.' "$(cat /tmp/bbc-smoke-body.json)"

BODY=$(status "$BASE/api/admin/dashboard" -H 'Authorization: Bearer not-a-real-token')
check "GET /api/admin/dashboard (bad token)" 401 "$BODY"

BODY=$(status -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' \
  -d '{"email":"admin@bbcarhouse.com","password":"whatever"}')
check "POST /api/auth/login (no DATABASE_URL)" 503 "$BODY"
check_body "POST /api/auth/login (no DATABASE_URL)" 'DATABASE_NOT_CONFIGURED' "$(cat /tmp/bbc-smoke-body.json)"

BODY=$(status "$BASE/api/cars")
check "GET /api/cars (no DATABASE_URL)" 503 "$BODY"
check_body "GET /api/cars (no DATABASE_URL)" 'DATABASE_NOT_CONFIGURED' "$(cat /tmp/bbc-smoke-body.json)"

BODY=$(status "$BASE/api/cars?pageSize=0")
check "GET /api/cars?pageSize=0 (invalid query)" 422 "$BODY"

BODY=$(status -X POST "$BASE/api/cars" -H 'Content-Type: application/json' -d '{"title":"x"}')
check "POST /api/cars (unauthenticated)" 401 "$BODY"

BODY=$(status -X POST "$BASE/api/cars" -H "Authorization: Bearer not-a-real-token" \
  -H 'Content-Type: application/json' -d '{"title":"x"}')
check "POST /api/cars (bad token)" 401 "$BODY"

BODY=$(status -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -d '{bad json')
check "POST /api/auth/login (malformed JSON)" 400 "$BODY"
check_body "POST /api/auth/login (malformed JSON)" 'INVALID_JSON' "$(cat /tmp/bbc-smoke-body.json)"

BODY=$(curl -s -o /dev/null -w '%{http_code}' -H 'Origin: http://localhost:3000' "$BASE/api/health")
check "GET /api/health (allowed CORS origin)" 200 "$BODY"

ALLOW=$(curl -s -D - -o /dev/null -H 'Origin: http://localhost:3000' "$BASE/api/health" | tr -d '\r' | grep -ci '^access-control-allow-origin: http://localhost:3000$')
check "CORS allows CLIENT_URL" 1 "$ALLOW"

ALLOW=$(curl -s -D - -o /dev/null -H 'Origin: http://evil.example' "$BASE/api/health" | tr -d '\r' | grep -ci '^access-control-allow-origin:')
check "CORS rejects unknown origin" 0 "$ALLOW"

BODY=$(status -X POST "$BASE/api/inquiries" -H 'Content-Type: application/json' \
  -d '{"name":"Test User","email":"test@example.com","message":"I would like to know more about this car please."}')
check "POST /api/inquiries (valid body, no DATABASE_URL)" 503 "$BODY"

# --- Protected routes with a real, freshly signed JWT ------------------------
TOKEN=$(JWT_SECRET="$JWT_SECRET" npx tsx scripts/mint-token.ts 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "  FAIL  could not mint a test token"; FAIL=$((FAIL + 1))
else
  BODY=$(status "$BASE/api/admin/dashboard" -H "Authorization: Bearer $TOKEN")
  check "GET /api/admin/dashboard (valid token)" 503 "$BODY"
  check_body "GET /api/admin/dashboard (valid token)" 'DATABASE_NOT_CONFIGURED' "$(cat /tmp/bbc-smoke-body.json)"

  BODY=$(status "$BASE/api/auth/me" -H "Authorization: Bearer $TOKEN")
  check "GET /api/auth/me (valid token)" 503 "$BODY"

  printf '\x89PNG\r\n\x1a\n' > /tmp/bbc-smoke-image.png
  BODY=$(status -X POST "$BASE/api/cars" -H "Authorization: Bearer $TOKEN" \
    -F 'title=Toyota Axio 2018' -F 'brand=Toyota' -F 'model=Axio' -F 'year=2018' \
    -F 'price=4500000' -F 'images=@/tmp/bbc-smoke-image.png;type=image/png')
  check "POST /api/cars (with image, Cloudinary off)" 503 "$BODY"
  check_body "POST /api/cars (with image, Cloudinary off)" 'CLOUDINARY_NOT_CONFIGURED' "$(cat /tmp/bbc-smoke-body.json)"
  check_body "POST /api/cars (with image, Cloudinary off)" 'Image uploads are disabled' "$(cat /tmp/bbc-smoke-body.json)"

  BODY=$(status -X POST "$BASE/api/cars" -H "Authorization: Bearer $TOKEN" \
    -F 'title=Toyota Axio 2018' -F 'brand=Toyota' -F 'model=Axio' -F 'year=2018' \
    -F 'price=4500000' -F 'images=@/tmp/bbc-smoke-image.png;type=image/png')
  check_body "POST /api/cars (with image, Cloudinary off) is 4xx/5xx not a crash" 'success":false' "$(cat /tmp/bbc-smoke-body.json)"

  BODY=$(status -X POST "$BASE/api/cars/fake-car-id/images" -H "Authorization: Bearer $TOKEN" \
    -F 'images=@/tmp/bbc-smoke-image.png;type=image/png')
  check "POST /api/cars/:id/images (Cloudinary off)" 503 "$BODY"
  check_body "POST /api/cars/:id/images (Cloudinary off)" 'CLOUDINARY_NOT_CONFIGURED' "$(cat /tmp/bbc-smoke-body.json)"

  # No files attached: the Cloudinary guard must not fire, so the request reaches
  # the database layer instead.
  BODY=$(status -X POST "$BASE/api/cars" -H "Authorization: Bearer $TOKEN" \
    -F 'title=Toyota Axio 2018' -F 'brand=Toyota' -F 'model=Axio' -F 'year=2018' \
    -F 'price=4500000')
  check "POST /api/cars (no image, Cloudinary off)" 503 "$BODY"
  check_body "POST /api/cars (no image, Cloudinary off)" 'DATABASE_NOT_CONFIGURED' "$(cat /tmp/bbc-smoke-body.json)"

  BODY=$(status -X POST "$BASE/api/cars" -H "Authorization: Bearer $TOKEN" \
    -F 'title=Toyota Axio 2018' -F 'brand=Toyota' -F 'model=Axio' -F 'year=2018' \
    -F 'price=4500000' -F 'images=@/etc/hosts;type=text/plain')
  check "POST /api/cars (non-image upload rejected)" 422 "$BODY"
  check_body "POST /api/cars (non-image upload rejected)" 'Unsupported file type' "$(cat /tmp/bbc-smoke-body.json)"

  BODY=$(status -X POST "$BASE/api/cars" -H "Authorization: Bearer $TOKEN" \
    -F 'title=Bad' -F 'brand=' -F 'model=Axio' -F 'year=2018' -F 'price=4500000')
  check "POST /api/cars (invalid body rejected)" 422 "$BODY"

  BODY=$(status -X DELETE "$BASE/api/inquiries/some-id" -H "Authorization: Bearer $TOKEN")
  check "DELETE /api/inquiries/:id (valid token)" 503 "$BODY"
fi

echo
echo "Passed: ${PASS}  Failed: ${FAIL}"
[ "$FAIL" -eq 0 ]