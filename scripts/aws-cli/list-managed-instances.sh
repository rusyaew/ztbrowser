#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/scripts/aws-cli/_common.sh"

aws_cli ec2 describe-instances \
  --filters \
    Name=tag:"$MANAGED_TAG_KEY",Values="$MANAGED_TAG_VALUE" \
    Name=instance-state-name,Values=pending,running,stopping,stopped \
  --query 'Reservations[].Instances[].{
    instance_id: InstanceId,
    state: State.Name,
    public_ip: PublicIpAddress,
    public_dns: PublicDnsName,
    launch_time: LaunchTime
  }' \
  --output json
