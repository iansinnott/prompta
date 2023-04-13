#!/bin/bash

main() {
  echo "Releasing new version..."
  echo "    PWD: $PWD"

  local version=$(jq -r '.version' package.json)
  
  # Replace version in tauri.conf.json
  sed -i '' -e "s/\"version\": \".*\"/\"version\": \"$version\"/g" tauri.conf.json
}

main