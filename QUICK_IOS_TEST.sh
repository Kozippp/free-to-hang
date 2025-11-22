#!/bin/bash

# Quick iOS Testing Script
# Run this to test app in iOS simulator

echo "🚀 Starting Expo for iOS testing..."
echo ""

cd "$(dirname "$0")"

# Step 1: Clean ports
echo "1️⃣ Cleaning ports..."
lsof -ti:8081 | xargs kill -9 2>/dev/null
lsof -ti:19000 | xargs kill -9 2>/dev/null
lsof -ti:19001 | xargs kill -9 2>/dev/null
sleep 1

# Step 2: Open Simulator
echo "2️⃣ Opening iOS Simulator..."
open -a Simulator
sleep 3

# Step 3: Start Expo
echo "3️⃣ Starting Expo..."
echo ""
echo "📱 When you see the menu, press 'i' to open in iOS simulator"
echo ""

npx expo start

# That's it! Expo will handle the rest

