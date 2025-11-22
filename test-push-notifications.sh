#!/bin/bash

# 🔔 Push Notifications Test Script
# Kasutamine: ./test-push-notifications.sh [YOUR_JWT_TOKEN]

set -e

echo "🔔 ==============================================="
echo "   FREE TO HANG - Push Notifications Test"
echo "==============================================="
echo ""

# Check if token is provided
if [ -z "$1" ]; then
    echo "❌ Error: JWT token is required"
    echo ""
    echo "Usage: ./test-push-notifications.sh YOUR_JWT_TOKEN"
    echo ""
    echo "How to get your JWT token:"
    echo "1. Open Free to Hang app on iPhone"
    echo "2. Open Safari → Develop → [Your iPhone] → Free to Hang"
    echo "3. Go to Network tab"
    echo "4. Make any API request (e.g., refresh friends)"
    echo "5. Click on the request"
    echo "6. Copy the 'Authorization: Bearer' token"
    echo ""
    exit 1
fi

TOKEN="$1"
BACKEND_URL="https://free-to-hang-production.up.railway.app"

echo "📡 Testing backend connection..."
echo "================================"
HEALTH=$(curl -s "${BACKEND_URL}/")
echo "$HEALTH" | jq '.' || echo "$HEALTH"
echo ""

echo "🔍 Checking your push tokens..."
echo "================================"
TOKENS=$(curl -s "${BACKEND_URL}/api/notifications/debug/tokens" \
    -H "Authorization: Bearer ${TOKEN}")

echo "$TOKENS" | jq '.' || echo "$TOKENS"

# Parse token count
TOKEN_COUNT=$(echo "$TOKENS" | jq -r '.count' 2>/dev/null || echo "0")
HAS_ACTIVE=$(echo "$TOKENS" | jq -r '.hasActiveTokens' 2>/dev/null || echo "false")

echo ""
echo "📊 Summary:"
echo "  - Push tokens found: $TOKEN_COUNT"
echo "  - Has active tokens: $HAS_ACTIVE"
echo ""

if [ "$TOKEN_COUNT" = "0" ]; then
    echo "❌ WARNING: No push tokens found!"
    echo "   Please ensure:"
    echo "   1. You're logged in on the iPhone"
    echo "   2. You allowed notifications when prompted"
    echo "   3. The app successfully registered the push token"
    echo ""
    echo "   Check Safari Web Inspector logs for errors."
    exit 1
fi

if [ "$HAS_ACTIVE" = "false" ]; then
    echo "⚠️  WARNING: No active push tokens!"
    echo "   All tokens are disabled."
    exit 1
fi

echo "🧪 Sending test notification..."
echo "================================"
TEST_RESULT=$(curl -s -X POST "${BACKEND_URL}/api/notifications/test-push" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${TOKEN}" \
    -d '{"title": "Test Notification", "body": "If you see this, push notifications are working! 🎉"}')

echo "$TEST_RESULT" | jq '.' || echo "$TEST_RESULT"
echo ""

SUCCESS=$(echo "$TEST_RESULT" | jq -r '.success' 2>/dev/null || echo "false")

if [ "$SUCCESS" = "true" ]; then
    echo "✅ Test notification sent successfully!"
    echo ""
    echo "📱 CHECK YOUR IPHONE NOW!"
    echo "   You should receive a notification in 5-10 seconds."
    echo "   If the app is open, you might see an in-app banner."
    echo "   If the app is closed, you should see a lock screen notification."
    echo ""
    echo "⏰ Waiting 10 seconds for you to check..."
    sleep 10
    echo ""
    echo "❓ Did you receive the notification?"
    echo ""
    echo "   ✅ YES → Push notifications are working!"
    echo "   ❌ NO  → See troubleshooting below"
    echo ""
    echo "🔧 Troubleshooting:"
    echo "   1. Check iPhone Settings → Free to Hang → Notifications"
    echo "      Make sure 'Allow Notifications' is enabled"
    echo ""
    echo "   2. Check Railway logs:"
    echo "      https://railway.app → Your Project → Logs"
    echo "      Look for errors when sending notifications"
    echo ""
    echo "   3. Test the token manually at:"
    echo "      https://expo.dev/notifications"
    echo "      Copy your expo_push_token from the debug output above"
    echo ""
    echo "   4. See full guide:"
    echo "      PUSH_NOTIFICATIONS_DEBUG_GUIDE.md"
else
    echo "❌ Failed to send test notification!"
    echo "   Check the error message above."
    echo ""
    echo "   Common issues:"
    echo "   - JWT token is invalid or expired"
    echo "   - Backend is down"
    echo "   - Supabase connection issue"
    exit 1
fi

echo ""
echo "🎯 Next steps:"
echo "   1. Test with actual plan creation"
echo "   2. Test between two devices"
echo "   3. Check PUSH_NOTIFICATIONS_DEBUG_GUIDE.md for detailed tests"
echo ""
echo "==============================================="
echo "✅ Test script completed!"
echo "==============================================="

