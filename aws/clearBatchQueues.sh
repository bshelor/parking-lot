#! /bin/bash
for job in $(aws batch list-jobs --job-queue Main-Batch-Queue-staging --job-status running --output text --query jobSummaryList[*].jobId)

do
  echo "Deleting Job: $job."
  aws batch terminate-job --job-id $job --reason "Terminating job."
  echo "Job $job  deleted"
done
