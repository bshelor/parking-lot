#! /bin/bash

count=0
for job in $(aws batch list-jobs --job-queue $1 --job-status $2 --output text --query jobSummaryList[*].jobId)

do
  count=$((count + 1))
done

echo "Total count: $count"

