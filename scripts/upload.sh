#!/bin/bash

latest_tag="$(git describe --tags $(git rev-list --tags --max-count=1))"; gh release upload $latest_tag src-tauri/target/release/bundle/dmg/*.dmg