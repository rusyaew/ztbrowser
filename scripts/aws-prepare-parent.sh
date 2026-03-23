#!/usr/bin/env bash
set -euo pipefail

sudo dnf install aws-nitro-enclaves-cli aws-nitro-enclaves-cli-devel docker git tmux rust cargo -y
sudo usermod -aG ne ec2-user
sudo usermod -aG docker ec2-user
sudo systemctl enable --now docker

cat <<'EOF'
Parent dependencies installed.

Reconnect your SSH session so the new group membership takes effect, then run:

sudo tee /etc/nitro_enclaves/allocator.yaml >/dev/null <<'YAML'
---
memory_mib: 2048
cpu_count: 2
YAML
sudo systemctl enable --now nitro-enclaves-allocator.service
nitro-cli --version
docker --version
groups
EOF
