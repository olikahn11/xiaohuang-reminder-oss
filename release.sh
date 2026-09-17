#!/bin/zsh
set -e
cd "/Users/lili/Documents/AI/提醒 app"

echo "Copying DMG..."
mkdir -p deliverables
cp "app/src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/小黄提醒管家_0.6.3_aarch64.dmg" "deliverables/小黄提醒管家-0.6.3-macOS-AppleSilicon.dmg" || true

echo "Copying IPA..."
# Tauri puts it in gen/apple/build/arm64-apple-ios/release/Release-iphoneos/
cp "app/src-tauri/gen/apple/build/arm64-apple-ios/release/Release-iphoneos/xuji.ipa" "deliverables/小黄提醒管家-0.6.3-iPhone-Unsigned.ipa" || true

echo "Adding to git..."
git add .
git commit -m "chore(release): bump version to 0.6.3 with multiple bug fixes and currency support"

echo "Pushing to origin..."
git push origin HEAD:main

echo "Pushing to oss..."
git push oss HEAD:main

echo "Creating GitHub Release..."
gh release create v0.6.3 \
    --repo olikahn11/xiaohuang-reminder-oss \
    --title "v0.6.3 (多币种结算、稳定性与性能更新)" \
    --notes-file release_notes_v0.6.3.md \
    "deliverables/小黄提醒管家-0.6.3-macOS-AppleSilicon.dmg" \
    "deliverables/小黄提醒管家-0.6.3-iPhone-Unsigned.ipa"

echo "Done!"
