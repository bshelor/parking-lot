#REPOS=( automation auditing	savings-center zap pg archive-data code-climate-action deploy-permissions-action fn node-package-version-changes )
REPOS=( marvengardens pennybags )
for REPO in "${REPOS[@]}"
do
  echo "fetching $REPO stats"
  gh api /repos/zylo/${REPO}/stats/contributors > ./data/01-30-2024/${REPO}.json
done
