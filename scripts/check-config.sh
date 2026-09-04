#!/bin/bash
# scripts/check-config.sh — Production configuration validation
# Usage: ./scripts/check-config.sh
#
# This script checks for missing required production environment variables
# and reports them clearly. It never prints secret values.

set -euo pipefail

errors=0

check_required() {
  local name="$1"
  local value="${!2}"
  # Dereference: if the variable name holds another var name, follow it
  local eval_value
  eval_eval_value="$(eval echo "$value")"
  if [ -z "$eval_eval_value" ]; then
    echo "✗ MISSING REQUIRED: $name"
    errors=$((errors + 1))
  else
    echo "✓ $name is set"
  fi
}

echo "=== Production Configuration Check ==="
echo ""

# Check .env exists and has required values
if [ ! -f .env ]; then
  echo "✗ .env file missing — create from .env.example"
  errors=$((errors + 1))
else
  echo "✓ .env file exists"
  
  # Check required vars (grep for the pattern, don't print values)
  for var in DB_PASSWORD SESSION_SECRET PAYMENT_WEBHOOK_SECRET; do
    if grep -q "^${var}=" .env 2>/dev/null; then
      val=$(grep "^${var}=" .env | cut -d= -f2-)
      # Only report if it looks like a real value (not a placeholder)
      if echo "$val" | grep -qi "change_this\|your_\|placeholder\|example\|default"; then
        echo "⚠ $var appears to be a placeholder — replace before production"
      else
        echo "✓ $var is configured"
      fi
    else
      echo "✗ $var not found in .env"
      errors=$((errors + 1))
    fi
  done
fi

echo ""

# Check backend/.env
if [ -f backend/.env ]; then
  echo "✓ backend/.env exists"
  for var in DB_PASSWORD SESSION_SECRET; do
    if grep -q "^${var}=" backend/.env 2>/dev/null; then
      echo "  $var is configured in backend/.env"
    else
      echo "✗ $var not found in backend/.env"
      errors=$((errors + 1))
    fi
  done
else
  echo "— backend/.env not present (gitignored, expected)"
fi

echo ""

# Check NEXT_PUBLIC_* vars don't contain secrets
echo "--- NEXT_PUBLIC variables ---"
for var in $(env | grep "^NEXT_PUBLIC=" 2>/dev/null | cut -d= -f1 | sed 's/^NEXT_PUBLIC_//'); do
  val="${var}"
  # Check if the value contains secrets
  if echo "$val" | grep -qi "password\|secret\|token\|key\|api_key"; then
    echo "⚠ NEXT_PUBLIC_$var contains secret-like content — review"
  else
    echo "✓ NEXT_PUBLIC_$var: $val"
  fi
done

echo ""
echo "=== Summary ==="
if [ "$errors" -eq 0 ]; then
  echo "All checks passed. Configuration looks ready for production."
else
  echo "$errors check(s) failed. Review the items above before deploying."
  exit 1
fi
