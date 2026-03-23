#!/usr/bin/env bash
set -euo pipefail

# Shared defaults for local AWS CLI orchestration.
# These defaults mirror the already-proven manual deployment path:
# - AL2023 x86_64
# - m5.xlarge parent instance
# - Nitro Enclaves enabled
# - public port 9999 for the parent proxy
AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_PROFILE="${AWS_PROFILE:-ztbrowser}"
AWS_BIN="${AWS_BIN:-aws}"
INSTANCE_NAME="${INSTANCE_NAME:-ztbrowser-nitro-parent}"
LAUNCH_TEMPLATE_NAME="${LAUNCH_TEMPLATE_NAME:-ztbrowser-nitro-parent}"
SECURITY_GROUP_NAME="${SECURITY_GROUP_NAME:-ztbrowser-nitro-parent-sg}"
KEY_NAME="${KEY_NAME:-ztbrowser-nitro-key}"
LOCAL_KEY_PATH="${LOCAL_KEY_PATH:-/home/gleb/ztbrowser-nitro-key.pem}"
INSTANCE_TYPE="${INSTANCE_TYPE:-m5.xlarge}"
PROXY_PORT="${PROXY_PORT:-9999}"
AMI_SSM_PARAMETER="${AMI_SSM_PARAMETER:-/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64}"
HOST_REPO_DIR="${HOST_REPO_DIR:-/home/ec2-user/ztbrowser}"
REMOTE_REF="${REMOTE_REF:-origin/main}"
ENCLAVE_RELEASE_TAG="${ENCLAVE_RELEASE_TAG:-}"
SSH_USER="${SSH_USER:-ec2-user}"
MANAGED_TAG_KEY="ManagedBy"
MANAGED_TAG_VALUE="ztbrowser-aws-cli"

log() {
  printf '[aws-cli] %s\n' "$*" >&2
}

die() {
  printf '[aws-cli] ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

aws_cli() {
  local cmd=("$AWS_BIN")
  if [[ -n "$AWS_PROFILE" ]]; then
    cmd+=(--profile "$AWS_PROFILE")
  fi
  if [[ -n "$AWS_REGION" ]]; then
    cmd+=(--region "$AWS_REGION")
  fi
  "${cmd[@]}" "$@"
}

normalize_cidr() {
  local value="$1"
  if [[ "$value" == */* ]]; then
    printf '%s\n' "$value"
  else
    printf '%s/32\n' "$value"
  fi
}

current_public_cidr() {
  require_cmd curl
  local ip
  ip="$(curl -fsSL https://checkip.amazonaws.com | tr -d '[:space:]')"
  [[ -n "$ip" ]] || die "could not determine current public IP"
  normalize_cidr "$ip"
}

get_default_vpc_id() {
  local vpc_id
  vpc_id="$(aws_cli ec2 describe-vpcs \
    --filters Name=isDefault,Values=true \
    --query 'Vpcs[0].VpcId' \
    --output text)"
  [[ -n "$vpc_id" && "$vpc_id" != "None" ]] || die "no default VPC found in region $AWS_REGION"
  printf '%s\n' "$vpc_id"
}

resolve_ami_id() {
  aws_cli ssm get-parameter \
    --name "$AMI_SSM_PARAMETER" \
    --query 'Parameter.Value' \
    --output text
}

find_security_group_id() {
  local vpc_id="$1"
  aws_cli ec2 describe-security-groups \
    --filters Name=group-name,Values="$SECURITY_GROUP_NAME" Name=vpc-id,Values="$vpc_id" \
    --query 'SecurityGroups[0].GroupId' \
    --output text 2>/dev/null || true
}

ensure_security_group() {
  local vpc_id sg_id
  vpc_id="${VPC_ID:-$(get_default_vpc_id)}"
  sg_id="$(find_security_group_id "$vpc_id")"

  if [[ -z "$sg_id" || "$sg_id" == "None" ]]; then
    log "creating security group $SECURITY_GROUP_NAME in VPC $vpc_id"
    sg_id="$(aws_cli ec2 create-security-group \
      --group-name "$SECURITY_GROUP_NAME" \
      --description 'ZTBrowser Nitro parent instance security group' \
      --vpc-id "$vpc_id" \
      --query 'GroupId' \
      --output text)"
    aws_cli ec2 create-tags --resources "$sg_id" --tags \
      Key=Name,Value="$SECURITY_GROUP_NAME" \
      Key="$MANAGED_TAG_KEY",Value="$MANAGED_TAG_VALUE" >/dev/null
  fi

  # Keep the public proxy rule stable and simple: the demo/service page is intentionally public.
  aws_cli ec2 authorize-security-group-ingress \
    --group-id "$sg_id" \
    --protocol tcp \
    --port "$PROXY_PORT" \
    --cidr 0.0.0.0/0 >/dev/null 2>&1 || true

  printf '%s\n' "$sg_id"
}

sync_ssh_ingress() {
  local sg_id="$1"
  shift
  local desired_cidrs=("$(current_public_cidr)" "$@")
  local cidr existing
  local -a normalized=()
  local -a existing_rules=()

  for cidr in "${desired_cidrs[@]}"; do
    [[ -n "$cidr" ]] || continue
    normalized+=("$(normalize_cidr "$cidr")")
  done

  mapfile -t existing_rules < <(aws_cli ec2 describe-security-groups \
    --group-ids "$sg_id" \
    --query 'SecurityGroups[0].IpPermissions[?IpProtocol==`tcp` && FromPort==`22` && ToPort==`22`].IpRanges[].CidrIp' \
    --output text | tr '\t' '\n' | sed '/^$/d')

  # Replace the SSH allowlist wholesale for this dedicated security group.
  # That keeps it aligned with the current Wi-Fi IP and any explicit extra CIDRs.
  for existing in "${existing_rules[@]}"; do
    aws_cli ec2 revoke-security-group-ingress \
      --group-id "$sg_id" \
      --protocol tcp \
      --port 22 \
      --cidr "$existing" >/dev/null 2>&1 || true
  done

  for cidr in "${normalized[@]}"; do
    aws_cli ec2 authorize-security-group-ingress \
      --group-id "$sg_id" \
      --protocol tcp \
      --port 22 \
      --cidr "$cidr" >/dev/null 2>&1 || true
  done
}

ensure_launch_template() {
  local sg_id="$1"
  local ami_id template_id version_number payload_file
  ami_id="$(resolve_ami_id)"
  payload_file="$(mktemp)"
  cat > "$payload_file" <<JSON
{
  "ImageId": "$ami_id",
  "InstanceType": "$INSTANCE_TYPE",
  "KeyName": "$KEY_NAME",
  "SecurityGroupIds": ["$sg_id"],
  "EnclaveOptions": {"Enabled": true},
  "MetadataOptions": {"HttpTokens": "required"},
  "TagSpecifications": [
    {
      "ResourceType": "instance",
      "Tags": [
        {"Key": "Name", "Value": "$INSTANCE_NAME"},
        {"Key": "$MANAGED_TAG_KEY", "Value": "$MANAGED_TAG_VALUE"}
      ]
    },
    {
      "ResourceType": "volume",
      "Tags": [
        {"Key": "Name", "Value": "$INSTANCE_NAME-root"},
        {"Key": "$MANAGED_TAG_KEY", "Value": "$MANAGED_TAG_VALUE"}
      ]
    }
  ]
}
JSON

  template_id="$(aws_cli ec2 describe-launch-templates \
    --launch-template-names "$LAUNCH_TEMPLATE_NAME" \
    --query 'LaunchTemplates[0].LaunchTemplateId' \
    --output text 2>/dev/null || true)"

  if [[ -z "$template_id" || "$template_id" == "None" ]]; then
    log "creating launch template $LAUNCH_TEMPLATE_NAME"
    template_id="$(aws_cli ec2 create-launch-template \
      --launch-template-name "$LAUNCH_TEMPLATE_NAME" \
      --launch-template-data "file://$payload_file" \
      --query 'LaunchTemplate.LaunchTemplateId' \
      --output text)"
  else
    log "updating launch template $LAUNCH_TEMPLATE_NAME"
    version_number="$(aws_cli ec2 create-launch-template-version \
      --launch-template-id "$template_id" \
      --source-version '$Latest' \
      --launch-template-data "file://$payload_file" \
      --query 'LaunchTemplateVersion.VersionNumber' \
      --output text)"
    aws_cli ec2 modify-launch-template \
      --launch-template-id "$template_id" \
      --default-version "$version_number" >/dev/null
  fi

  rm -f "$payload_file"
  printf '%s\n' "$template_id"
}

find_managed_instance_lines() {
  aws_cli ec2 describe-instances \
    --filters \
      Name=tag:Name,Values="$INSTANCE_NAME" \
      Name=tag:$MANAGED_TAG_KEY,Values="$MANAGED_TAG_VALUE" \
      Name=instance-state-name,Values=pending,running,stopping,stopped \
    --query 'Reservations[].Instances[].[InstanceId,State.Name,PublicIpAddress,PublicDnsName]' \
    --output text
}

ensure_instance_running() {
  local line_count instance_line instance_id state
  mapfile -t lines < <(find_managed_instance_lines | sed '/^$/d')
  line_count="${#lines[@]}"

  if (( line_count > 1 )); then
    printf '%s\n' "${lines[@]}" >&2
    die "multiple managed instances matched; clean up duplicates before continuing"
  fi

  if (( line_count == 0 )); then
    log "launching new managed Nitro parent instance"
    instance_id="$(aws_cli ec2 run-instances \
      --launch-template LaunchTemplateName="$LAUNCH_TEMPLATE_NAME",Version='$Default' \
      --count 1 \
      --query 'Instances[0].InstanceId' \
      --output text)"
  else
    read -r instance_id state _ <<<"${lines[0]}"
    case "$state" in
      stopped)
        log "starting existing stopped instance $instance_id"
        aws_cli ec2 start-instances --instance-ids "$instance_id" >/dev/null
        ;;
      stopping)
        log "waiting for instance $instance_id to stop before restarting"
        aws_cli ec2 wait instance-stopped --instance-ids "$instance_id"
        aws_cli ec2 start-instances --instance-ids "$instance_id" >/dev/null
        ;;
      pending|running)
        log "reusing existing instance $instance_id in state $state"
        ;;
      *)
        die "unsupported instance state for $instance_id: $state"
        ;;
    esac
  fi

  # Waiting for "running" is sufficient here because the next phase performs a real SSH bootstrap
  # and then verifies the live HTTP surface. EC2 status checks can lag behind actual SSH readiness
  # by several minutes, which makes the automation look stuck even though deployment can proceed.
  aws_cli ec2 wait instance-running --instance-ids "$instance_id"
  printf '%s\n' "$instance_id"
}

instance_field() {
  local instance_id="$1"
  local query="$2"
  aws_cli ec2 describe-instances \
    --instance-ids "$instance_id" \
    --query "$query" \
    --output text
}

emit_instance_json() {
  local instance_id="$1"
  local public_ip public_dns
  public_ip="$(instance_field "$instance_id" 'Reservations[0].Instances[0].PublicIpAddress')"
  public_dns="$(instance_field "$instance_id" 'Reservations[0].Instances[0].PublicDnsName')"
  cat <<JSON
{
  "instance_id": "$instance_id",
  "instance_name": "$INSTANCE_NAME",
  "public_ip": "$public_ip",
  "public_dns": "$public_dns",
  "key_name": "$KEY_NAME",
  "local_key_path": "$LOCAL_KEY_PATH",
  "region": "$AWS_REGION"
}
JSON
}

ensure_local_key_permissions() {
  [[ -f "$LOCAL_KEY_PATH" ]] || die "local private key not found: $LOCAL_KEY_PATH"
  chmod 400 "$LOCAL_KEY_PATH"
}

ssh_base_args() {
  printf '%s\n' -o StrictHostKeyChecking=accept-new -i "$LOCAL_KEY_PATH"
}
