#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/aws-cli/_common.sh"

usage() {
  cat <<USAGE
Usage: $0 [--profile-name <local-profile>] [--iam-user <name>] [--policy-name <name>]

Bootstrap the ztbrowser deploy IAM user and configure a local AWS CLI profile.
This script must be run with an already-admin-capable AWS CLI profile.
USAGE
}

local_profile_name="ztbrowser"
iam_user="ztbrowser-cli"
policy_name="ztbrowser-ec2-nitro-deployer"
policy_file="$ROOT_DIR/docs/aws/ztbrowser-ec2-nitro-deployer-policy.json"
while (($#)); do
  case "$1" in
    --profile-name)
      local_profile_name="$2"
      shift 2
      ;;
    --iam-user)
      iam_user="$2"
      shift 2
      ;;
    --policy-name)
      policy_name="$2"
      shift 2
      ;;
    *)
      usage
      die "unknown argument: $1"
      ;;
  esac
done

require_cmd "$AWS_BIN"
require_cmd python3
[[ -f "$policy_file" ]] || die "policy file not found: $policy_file"

aws_cli sts get-caller-identity >/dev/null

if ! aws_cli iam get-user --user-name "$iam_user" >/dev/null 2>&1; then
  log "creating IAM user $iam_user"
  aws_cli iam create-user --user-name "$iam_user" >/dev/null
fi

policy_arn="$(aws_cli iam list-policies --scope Local --query "Policies[?PolicyName=='$policy_name'].Arn | [0]" --output text)"
if [[ -z "$policy_arn" || "$policy_arn" == "None" ]]; then
  log "creating customer-managed policy $policy_name"
  policy_arn="$(aws_cli iam create-policy --policy-name "$policy_name" --policy-document "file://$policy_file" --query 'Policy.Arn' --output text)"
fi

aws_cli iam attach-user-policy --user-name "$iam_user" --policy-arn "$policy_arn" >/dev/null || true

access_key_count="$(aws_cli iam list-access-keys --user-name "$iam_user" --query 'length(AccessKeyMetadata)' --output text)"
if [[ "$access_key_count" != "0" ]]; then
  die "IAM user $iam_user already has access keys; rotate or delete them first to avoid leaking stale credentials"
fi

creds_json="$(aws_cli iam create-access-key --user-name "$iam_user")"
access_key_id="$(printf '%s' "$creds_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["AccessKey"]["AccessKeyId"])')"
secret_access_key="$(printf '%s' "$creds_json" | python3 -c 'import json,sys; print(json.load(sys.stdin)["AccessKey"]["SecretAccessKey"])')"

"$AWS_BIN" configure set aws_access_key_id "$access_key_id" --profile "$local_profile_name"
"$AWS_BIN" configure set aws_secret_access_key "$secret_access_key" --profile "$local_profile_name"
"$AWS_BIN" configure set region "$AWS_REGION" --profile "$local_profile_name"
"$AWS_BIN" configure set output json --profile "$local_profile_name"

cat <<INFO
Bootstrapped AWS CLI deploy user.

IAM user: $iam_user
Policy ARN: $policy_arn
Local profile: $local_profile_name
Region: $AWS_REGION

The secret access key has also been written into your local AWS CLI profile.
If you need to inspect or rotate it later, do that through IAM.
INFO
