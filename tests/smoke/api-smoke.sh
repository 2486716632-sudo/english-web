#!/bin/bash
# ============================================================
# API Smoke Test
#
# 在 dev server 运行时运行以下命令：
#   npx next dev -p 3456  (另一个终端)
#   bash tests/smoke/api-smoke.sh
#
# 如果使用不同的端口，修改 BASE_URL。
#
# 设计约束：
# - check / check_json 每次调用只发送 1 个 HTTP 请求
# - 需要校验 JSON 结构时依赖 jq；没有 jq 时明确报告 SKIP，
#   绝不把"未校验结构"报告成 PASS
# ============================================================

BASE_URL="${BASE_URL:-http://localhost:3456}"
PASS=0
FAIL=0
SKIP=0
FAILURES=""
_TMPDIR="${TMPDIR:-/tmp}"

# ----------------------------------------------------------
# check — HTTP status only (no body inspection)
#   $1: test name
#   $2: URL path
#   $3: expected HTTP status (default 200)
#   $4: HTTP method (default GET)
#   $5: request body (optional)
#   $6: Content-Type (optional, default application/json)
# ----------------------------------------------------------
check() {
  local name="$1"
  local url="$2"
  local expected_status="${3:-200}"
  local method="${4:-GET}"
  local body="$5"
  local content_type="$6"

  local curl_args=(-s -o /dev/null -w "%{http_code}" -X "$method" "$BASE_URL$url")

  if [ -n "$body" ]; then
    local ct="${content_type:-application/json}"
    curl_args=(-s -o /dev/null -w "%{http_code}" -X "$method" -H "Content-Type: $ct" -d "$body" "$BASE_URL$url")
  fi

  local status
  status=$(curl "${curl_args[@]}" 2>/dev/null)

  if [ "$status" = "$expected_status" ]; then
    echo "  ✅ PASS: $name (${method} ${url} → HTTP $status)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $name (${method} ${url} → expected $expected_status, got $status)"
    FAIL=$((FAIL + 1))
    FAILURES="$FAILURES  - $name: expected $expected_status, got $status\n"
  fi
}

# ----------------------------------------------------------
# check_json — single-request JSON status + body inspection
#
#   Exactly ONE HTTP request per call: curl writes the response body
#   to a temp file (-o) and prints only the status code to stdout
#   (-w "%{http_code}"). There is no second request for the status.
#
#   $1: test name
#   $2: URL path
#   $3: expected JSON key (empty = skip key check)
#   $4: expected HTTP status (default 200)
#   $5: HTTP method (default GET)
#   $6: request body (optional)
#   $7: Content-Type (optional, default application/json when body present)
# ----------------------------------------------------------
check_json() {
  local name="$1"
  local url="$2"
  local expected_key="$3"
  local expected_status="${4:-200}"
  local method="${5:-GET}"
  local body="$6"
  local content_type="$7"

  # Temp file to capture body; stderr for curl progress discarded
  local tmpf
  tmpf=$(mktemp "$_TMPDIR/api-smoke-XXXXXX")

  # Single request: -o captures the body, -w prints only the status code
  local curl_args=(-s -w "%{http_code}" -o "$tmpf" -X "$method")
  if [ -n "$body" ]; then
    local ct="${content_type:-application/json}"
    curl_args+=(-H "Content-Type: $ct" -d "$body")
  fi
  curl_args+=("$BASE_URL$url")

  local status
  status=$(curl "${curl_args[@]}" 2>/dev/null)
  local response
  response=$(cat "$tmpf" 2>/dev/null)
  rm -f "$tmpf"

  if [ "$status" != "$expected_status" ]; then
    echo "  ❌ FAIL: $name (${method} ${url} → HTTP $status, expected $expected_status)"
    FAIL=$((FAIL + 1))
    FAILURES="$FAILURES  - $name: HTTP $status, expected $expected_status\n"
    return
  fi

  # If no key to check, just report status
  if [ -z "$expected_key" ]; then
    echo "  ✅ PASS: $name (${method} ${url} → HTTP $status)"
    PASS=$((PASS + 1))
    return
  fi

  # Structural validation needs jq. Without jq we CANNOT verify the JSON
  # structure, so report SKIP — never a false PASS.
  if ! command -v jq &>/dev/null; then
    echo "  ⚠️  SKIP: $name — JSON structure validation SKIPPED (jq not installed)"
    echo "     HTTP $status OK, but .$expected_key was NOT verified. Install jq for full validation."
    SKIP=$((SKIP + 1))
    return
  fi

  if echo "$response" | jq -e ".$expected_key" &>/dev/null; then
    echo "  ✅ PASS: $name (has key .$expected_key)"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $name (missing key .$expected_key, response: $(echo "$response" | head -c 200))"
    FAIL=$((FAIL + 1))
    FAILURES="$FAILURES  - $name: missing key .$expected_key\n"
  fi
}

echo "============================================"
echo "  API Smoke Test"
echo "  Base URL: $BASE_URL"
echo "============================================"
echo ""

# ---- Health ----
echo "[Health]"
check_json "GET /api/warmup" "/api/warmup" "status" 200

# ---- Reading ----
echo "[Reading]"
check_json "GET /api/reading" "/api/reading" "" 200

# ---- Vocabulary ----
echo "[Vocabulary]"
check_json "GET /api/words/queues" "/api/words/queues" "reviewQueue" 200

# ---- Listening ----
echo "[Listening]"
check_json "GET /api/listening/categories" "/api/listening/categories" "" 200
check_json "GET /api/listening/scenes" "/api/listening/scenes" "" 200

# ---- Pages (static reachability) ----
echo "[Pages]"
check "GET /" "/" 200
check "GET /words" "/words" 200
check "GET /words/dashboard" "/words/dashboard" 200
check "GET /words/study" "/words/study" 200
check "GET /reading" "/reading" 200
check "GET /listening" "/listening" 200
check "GET /coach" "/coach" 200

# ---- POST endpoints (no real AI, no data mutation) ----
echo "[POST — safe requests only]"
# POST /api/words with non-existent wordId → 404
check "POST /api/words (non-existent wordId → 404)" "/api/words" 404 POST '{"wordId":99999,"rating":3}'
# POST /api/words with missing wordId → 500 (characterization: input validation debt)
# 注：当前 API Route 先查询 word 再校验 rating，缺少 wordId 时 db.find(undefined)
# 返回异常。这是输入校验技术债，Phase 2 仅记录不修改。
check "POST /api/words (missing wordId → 500) [input validation debt]" "/api/words" 500 POST '{"rating":3}'

# ---- /api/assistant — NOT tested (would call real DeepSeek) ----
echo ""
echo "  ⏳ /api/assistant: Skipped — POST would call real DeepSeek."
echo "     Phase 2 only establishes offline response quality baselines."
echo "     API Route automated testing deferred to Phase 3 (requires injectable AI Client)."

# ---- Summary ----
echo ""
echo "============================================"
echo "  Results: $PASS passed, $FAIL failed, $SKIP skipped"
echo "============================================"

if [ $SKIP -gt 0 ]; then
  echo ""
  echo "  ⚠️  $SKIP check(s) SKIPPED JSON structure validation (jq not installed)."
  echo "     Those checks verified HTTP status only — the expected JSON key was NOT verified."
  echo "     Install jq and re-run for full structural validation."
fi

if [ $FAIL -gt 0 ]; then
  echo ""
  echo "Failures:"
  echo -e "$FAILURES"
  exit 1
fi

exit 0
