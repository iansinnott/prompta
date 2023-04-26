#!/bin/bash
#

##
## It is assumed this is run aver a verion tag. I.e. `npm run release && npm run gh:publish`
##

set -e 

# if gh is not installed, fail
if ! command -v gh &> /dev/null
then
    echo "gh could not be found"
    exit
fi

# run our build to generate the mac dmg. this also ensures the publish fails if the build fails
npm run build && git push && git push --tags

echo "Waiting for the release workflow to start..."
sleep 5

latest_tag="$(git describe --tags $(git rev-list --tags --max-count=1))";

# List command here is to get the run id so we don't have to use the interactive gh run watch.
gh run watch "$(gh run list --limit 1 | awk '{print $7}')" && ./scripts/upload.sh && gh release edit --prerelease=false --latest $latest_tag