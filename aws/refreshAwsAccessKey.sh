export AWS_PROFILE=$1

getFirstActiveKeyId() {
  # loop keys and determine active key
  # will take first active in the array
  keys=$(aws iam list-access-keys | jq -r ".AccessKeyMetadata")
  echo "${keys}" | jq -cr ".[]" |
  while read -r key
  do
    status=$(echo $key | jq -r ".Status")
    if [ $status == "Active" ]; then
      keyId=$(echo $key | jq -r ".AccessKeyId")
      echo $keyId
      break
    fi
  done
}

activeKeyId=$(getFirstActiveKeyId)

createdKey=$(aws iam create-access-key | jq -r ".AccessKey")
createdKeyId=$(echo $createdKey | jq -r ".AccessKeyId")
createdKeySecret=$(echo $createdKey | jq -r ".SecretAccessKey")

echo "$createdKeyId\n$createdKeySecret\n\n\n" | aws configure

# test updated credentials
echo "\n<<testing updated credentials - takes about 15 seconds>>"
# export AWS_PROFILE=$1
read -t 15 # pause for 15 seconds to let credentials update, seems to take around that long
test=$(aws sts get-caller-identity)
aws iam update-access-key --access-key-id $activeKeyId --status Inactive
aws iam delete-access-key --access-key-id $activeKeyId

echo "<<successfully refreshed AWS CLI key/secret>>"
echo "<<NEW_AWS_ACCESS_KEY=$createdKeyId>>"
echo "<<NEW_AWS_SECRET_KEY=$createdKeySecret>>"

echo "<<listing current access keys in AWS>>"
aws iam list-access-keys
