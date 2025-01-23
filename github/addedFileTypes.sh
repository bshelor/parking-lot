#!/bin/bash

# navigate to specified local repo
cd ../../$1

# Get commit hashes from the last X days
commits=$(git log --since="$2" --pretty=format:"%H")

# Simulate an associative array using a regular array
languages=()

# Function to get the index of a key in the "array"
get_index() {
  local key=$1
  for i in "${!languages[@]}"; do
    if [[ "${languages[$i]}" == "$key:"* ]]; then
      echo $i
      return
    fi
  done
  echo -1
}

# Function to increment the count for a key
increment_language() {
  local key=$1
  local index=$(get_index "$key")
  
  if [[ $index -ge 0 ]]; then
    # Key exists; increment its count
    local entry=${languages[$index]}
    local count=${entry#*:}
    count=$((count + 1))
    languages[$index]="$key:$count"
  else
    # Key doesn't exist; add it with an initial count of 1
    languages+=("$key:1")
  fi
}

# Process commits and count languages
for commit in $commits; do
  # List files changed in each commit
  files=$(git show --name-only --diff-filter=A --pretty=format:"" $commit | grep -E "\.(py|js|java|ts|go|rb|c|cpp|sh)$")
  
  for file in $files; do
    # Extract file extension and map it to a language
    ext="${file##*.}"
    case $ext in
      py) lang="Python" ;;
      js) lang="JavaScript" ;;
      java) lang="Java" ;;
      ts) lang="TypeScript" ;;
      go) lang="Go" ;;
      rb) lang="Ruby" ;;
      c) lang="C" ;;
      cpp) lang="C++" ;;
      sh) lang="Shell" ;;
      *) lang="Other" ;;
    esac

    # Increment the count for the detected language
    increment_language "$lang"
  done
done

# Print the language breakdown
echo "Files committed by language since $1:"
total=0
for entry in "${languages[@]}"; do
  lang=${entry%%:*}
  count=${entry#*:}
  echo "$lang: $count"
  
  total=$(($count + $total))
done

echo "Total: $total"

