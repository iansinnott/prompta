#!/bin/bash

main() {
  echo "Releasing new version..."
  echo
  echo "    PWD: $PWD"

  local version=$(jq -r '.version' package.json)
  
  # Replace version in tauri.conf.json
  sed -i '' -e "s/\"version\": \".*\"/\"version\": \"$version\"/g" src-tauri/tauri.conf.json
  
  # amend last commit
  git add src-tauri/tauri.conf.json > /dev/null
  git commit --amend --no-edit > /dev/null

  # upsert the tag. if running yarn version the tag will have been created already
  git tag -d "v$version" > /dev/null || true 
  git tag -a "v$version" -m "v$version" > /dev/null
  
  # Generate changelog
  node ./scripts/changelog.js
  git add CHANGELOG.md > /dev/null
  git commit -m "chore: update changelog" > /dev/null
  
  echo "    Tag: v$version"
  echo "    Commit: $(git rev-parse HEAD)"
  echo
  echo "Push the tag to GitHub to trigger the release workflow."
}

main