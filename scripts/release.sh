#!/bin/bash

main() {
  echo "Releasing new version..."
  echo "    PWD: $PWD"
  echo

  local version=$(jq -r '.version' package.json)
  
  # Replace version in tauri.conf.json
  sed -i '' -e "s/\"version\": \".*\"/\"version\": \"$version\"/g" src-tauri/tauri.conf.json
  
  # amend last commit
  git add src-tauri/tauri.conf.json
  git commit --amend --no-edit

  # upsert the tag. if running yarn version the tag will have been created already
  git tag -a "v$version" -m "v$version"
}

main