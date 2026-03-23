# AWS Nitro Deployment

This file describes how to reproduce the current live AWS Nitro deployment of the ZTBrowser enclave-backed attestation server from scratch.

Scope of this document:

- deploy only the AWS-facing server side
- keep `clientsidechecker` running locally
- keep facts DB elsewhere
- reproduce the current result where:
  - `GET /` returns HTML generated inside the enclave
  - `POST /.well-known/attestation` returns a real AWS-root-verifiable Nitro attestation document

This is enough to safely terminate the current EC2 instance, as long as the local repo copy remains available.

## What is running today

Current known-good public endpoint:

- `http://54.81.35.79:9999/`

Current host shape:

- AMI: `Amazon Linux 2023`
- architecture: `x86_64`
- instance type: `m5.xlarge`
- Nitro Enclaves: enabled
- public listener: parent proxy on `0.0.0.0:9999`
- enclave listener: `vsock://16:5005`

Current allocator config:

```yaml
---
memory_mib: 2048
cpu_count: 2
```

Current known-good PCRs:

- `PCR0`: `a19eb046d0161759f484aaf60e9916b120f4135980f5e5ba821e4c4dbec2b129047ce07b491e6785c3bb76f60a5e0c3a`
- `PCR1`: `4b4d5b3661b3efc12920900c80e126e4ce783c522de6c02a2a5bf7af3a2b9327b86776f188e4be1c1c404a129dbda493`
- `PCR2`: `7c5612a56c6a7a1534569a38ef2904cca3bb4aadd7fb415030624ef2e947a0dec0fccef64ce7f69d895c499d41c61bdd`
- `PCR8`: all-zero value in the verified attestation doc for this unsigned EIF

Current build artifacts on the live instance:

- `aws-deploy/build/ztbrowser-enclave.eif`
  - SHA-256: `9020a381a4f4da53278f04fff35633ef004bf56093f6dda60a3b55cf00b8af32`
- `aws-deploy/build/describe-eif.json`
  - SHA-256: `48d24042638dc1a74e96b26c331ee0755cb0a318b4e1e136def51b39f635f904`

## Before deleting the instance

The current instance is safe to delete if these conditions hold:

1. Your local repo copy still exists:
   - `/home/gleb/zt-tech/ztbrowser`
2. Your SSH key still exists:
   - `/home/gleb/ztbrowser-nitro-key.pem`
3. You understand that the current public IP is ephemeral:
   - if you terminate the instance, `54.81.35.79` will not come back unless you used an Elastic IP

Important caveat:

- The current EC2 host was populated from the local workspace, not from a clean git checkout on the instance.
- That means the local repo is the source of truth for reproducing the exact current deployment.
- If you want a second recovery path, commit or archive this repo before deleting the instance.

## Reproducibility decisions already baked into the repo

The following changes were made specifically so PCRs can be reproduced reliably:

1. The enclave Dockerfile uses pinned base-image digests.
2. The enclave Docker build includes `Cargo.lock`.
3. The Rust build inside the enclave image uses `cargo build --locked`.
4. The helper scripts now use `2048 MiB` by default, which matches the current working enclave.

Relevant files:

- [aws-deploy/enclave-server/Dockerfile](/home/gleb/zt-tech/ztbrowser/aws-deploy/enclave-server/Dockerfile)
- [scripts/aws-prepare-parent.sh](/home/gleb/zt-tech/ztbrowser/scripts/aws-prepare-parent.sh)
- [scripts/aws-build-enclave.sh](/home/gleb/zt-tech/ztbrowser/scripts/aws-build-enclave.sh)
- [scripts/aws-run-enclave.sh](/home/gleb/zt-tech/ztbrowser/scripts/aws-run-enclave.sh)
- [scripts/aws-run-parent-proxy.sh](/home/gleb/zt-tech/ztbrowser/scripts/aws-run-parent-proxy.sh)

I also re-ran the build on the live EC2 host using the pinned Dockerfile + lockfile and confirmed it reproduces the same PCRs listed above.

## Architecture

There are two deployed AWS-side components:

1. Parent proxy on the EC2 parent instance
2. Enclave server inside the EIF

Flow:

1. Browser requests `GET /` from the EC2 parent.
2. Parent proxy forwards an `index` request over `vsock`.
3. Enclave generates the HTML and returns it over `vsock`.
4. Browser requests `POST /.well-known/attestation`.
5. Parent proxy forwards the nonce over `vsock`.
6. Enclave asks NSM for a real attestation document.
7. Parent proxy returns:
   - `platform`
   - `nonce`
   - `workload` metadata with PCR transparency values
   - `evidence.nitro_attestation_doc_b64`

The checker and facts DB are not deployed on AWS in this setup.

## Required local and AWS-side pieces

Local:

- this repo
- your SSH private key
- local `clientsidechecker`
- facts DB deployment, currently expected by the extension at:
  - `https://facts-db.onrender.com`

AWS:

- AWS account
- EC2 instance with Nitro Enclaves enabled
- security group allowing:
  - `22/tcp` from your IP
  - `9999/tcp` from your IP, or from the internet if you intentionally want a public demo

## Step 1: launch the EC2 parent instance

Launch an instance with:

- name: `ztbrowser-nitro-parent`
- AMI: `Amazon Linux 2023`
- instance type: `m5.xlarge`
- Nitro Enclaves: enabled
- public IP: enabled
- storage: `8 GiB gp3` is enough

Security group:

- `22/tcp` from your IP
- `9999/tcp` from your IP

Notes:

- `m5.xlarge` is the known-good shape used here.
- If you terminate and recreate without Elastic IP, the public IP changes.

## Step 2: connect

```bash
chmod 400 /home/gleb/ztbrowser-nitro-key.pem
ssh -i /home/gleb/ztbrowser-nitro-key.pem ec2-user@<PUBLIC_IP>
```

## Step 3: install the parent-instance dependencies

If the repo is already present on the host, you can run:

```bash
cd ~/ztbrowser
chmod +x scripts/aws-prepare-parent.sh
scripts/aws-prepare-parent.sh
```

If the repo is not on the host yet, run the equivalent commands manually:

```bash
sudo dnf install aws-nitro-enclaves-cli aws-nitro-enclaves-cli-devel docker git tmux rust cargo -y
sudo usermod -aG ne ec2-user
sudo usermod -aG docker ec2-user
sudo systemctl enable --now docker
```

Then disconnect and reconnect so the new group membership takes effect.

## Step 4: configure the enclave allocator

On the EC2 host:

```bash
sudo tee /etc/nitro_enclaves/allocator.yaml >/dev/null <<'EOF'
---
memory_mib: 2048
cpu_count: 2
EOF
sudo systemctl enable --now nitro-enclaves-allocator.service
```

Verify:

```bash
nitro-cli --version
docker --version
rustc --version
cargo --version
systemctl is-active nitro-enclaves-allocator.service
id -nG
```

Expected:

- allocator is `active`
- `ec2-user` is in `docker` and `ne`

Important detail:

- Nitro CLI on AL2023 requires the YAML document start marker `---`.
- Without it, the allocator can fail to parse the file.

## Step 5: put the repo on the host

If your current local changes are committed and pushed, you can use `git clone`.

If not, use `rsync` from your local machine, which is how the current host was populated:

```bash
rsync -az --delete \
  -e "ssh -i /home/gleb/ztbrowser-nitro-key.pem" \
  /home/gleb/zt-tech/ztbrowser/ \
  ec2-user@<PUBLIC_IP>:/home/ec2-user/ztbrowser/
```

This copies the exact local workspace, including the AWS deployment code and scripts.

## Step 6: build the EIF

On the EC2 host:

```bash
cd ~/ztbrowser
chmod +x scripts/aws-build-enclave.sh scripts/aws-run-enclave.sh scripts/aws-run-parent-proxy.sh
scripts/aws-build-enclave.sh
```

This produces:

- `aws-deploy/build/ztbrowser-enclave.eif`
- `aws-deploy/build/describe-eif.json`

The build prints the PCRs at the end.

## Step 7: run the enclave

If an old enclave is running, stop it:

```bash
nitro-cli terminate-enclave --all || true
```

Then start the new one:

```bash
cd ~/ztbrowser
ENCLAVE_MEMORY_MIB=2048 scripts/aws-run-enclave.sh
```

Verify:

```bash
nitro-cli describe-enclaves
```

Expected:

- one running enclave
- `EnclaveCID: 16`
- PCRs matching the `describe-eif` output

## Step 8: run the parent proxy

Start it from the repo root on the EC2 host:

```bash
cd ~/ztbrowser
nohup env \
  MEASUREMENTS_PATH=/home/ec2-user/ztbrowser/aws-deploy/build/describe-eif.json \
  WORKLOAD_ID=ztbrowser-aws-nitro \
  REPO_URL=https://github.com/rusyaew/ztbrowser \
  OCI_IMAGE_DIGEST=sha256:1111111111111111111111111111111111111111111111111111111111111111 \
  scripts/aws-run-parent-proxy.sh \
  >/tmp/ztbrowser-parent-proxy.log 2>&1 &
```

Notes:

- `OCI_IMAGE_DIGEST` is currently display-only metadata in this setup.
- Because this deployment is built from a local Docker image and not a pushed registry artifact, the current live setup uses a placeholder digest.
- If you want a real OCI digest in the response, push the enclave image to a registry and pass that digest here.
- The current lock decision does not depend on `oci_image_digest`; cryptographic verification is based on the AWS-signed attestation document, and facts matching is based on PCR tuple lookup.

Verify the listener:

```bash
ss -ltnp | grep 9999
tail -n 40 /tmp/ztbrowser-parent-proxy.log
```

## Step 9: verify the public server

From your local machine:

```bash
curl http://<PUBLIC_IP>:9999/
```

Expected HTML contains:

- `Hello from Nitro enclave`
- `This HTML page was generated inside the enclave`

Then verify the attestation endpoint:

```bash
curl -X POST http://<PUBLIC_IP>:9999/.well-known/attestation \
  -H 'Content-Type: application/json' \
  -d '{"NONCE":"00112233445566778899aabbccddeeff"}'
```

Expected:

- `platform: aws_nitro_eif`
- `nonce: 00112233445566778899aabbccddeeff`
- non-empty `evidence.nitro_attestation_doc_b64`

## Step 10: verify with the local checker

Run locally:

```bash
cd /home/gleb/zt-tech/ztbrowser
npm run dev:checker
```

Then verify against the live endpoint:

```bash
python3 - <<'PY'
import json, urllib.request
att_req = urllib.request.Request(
    'http://<PUBLIC_IP>:9999/.well-known/attestation',
    data=b'{"NONCE":"00112233445566778899aabbccddeeff"}',
    headers={'Content-Type':'application/json'},
)
with urllib.request.urlopen(att_req, timeout=20) as r:
    att = json.load(r)
verify_body = json.dumps({
    'platform': 'aws_nitro_eif',
    'nonce_sent': '00112233445566778899aabbccddeeff',
    'attestation_doc_b64': att['evidence']['nitro_attestation_doc_b64'],
}).encode()
verify_req = urllib.request.Request(
    'http://localhost:3000/verify',
    data=verify_body,
    headers={'Content-Type':'application/json'},
)
with urllib.request.urlopen(verify_req, timeout=20) as r:
    print(r.read().decode())
PY
```

Expected:

- `workingEnv: true`
- `codeValidated: true`
- AWS root fingerprint:
  - `64:1A:03:21:A3:E2:44:EF:E4:56:46:31:95:D6:06:31:7E:D7:CD:CC:3C:17:56:E0:98:93:F3:C6:8F:79:BB:5B`

## Step 11: update facts DB if you want metadata matching

Facts lookup is not required for cryptographic verification, but it is required if you want the facts service to show a matching workload record.

Current known-good facts row:

```json
{
  "workload_id": "ztbrowser-aws-nitro",
  "repo_url": "https://github.com/rusyaew/ztbrowser",
  "oci_image_digest": "sha256:9bfb290114b83b7f9e0492be94f2507c8a21a97ee9e12d50a612cc2d98ed97f3",
  "pcr0": "a19eb046d0161759f484aaf60e9916b120f4135980f5e5ba821e4c4dbec2b129047ce07b491e6785c3bb76f60a5e0c3a",
  "pcr1": "4b4d5b3661b3efc12920900c80e126e4ce783c522de6c02a2a5bf7af3a2b9327b86776f188e4be1c1c404a129dbda493",
  "pcr2": "7c5612a56c6a7a1534569a38ef2904cca3bb4aadd7fb415030624ef2e947a0dec0fccef64ce7f69d895c499d41c61bdd",
  "pcr8": "000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"
}
```

Note:

- the verified attestation doc reports `pcr8` as all-zero for this unsigned EIF
- the outer server response currently reports `workload.eif_pcrs.pcr8 = null`
- use the all-zero value for facts matching if your facts service expects `pcr8`

## Stable restart procedure

If the instance is still alive and you only need to refresh the deployment:

```bash
ssh -i /home/gleb/ztbrowser-nitro-key.pem ec2-user@<PUBLIC_IP>
cd ~/ztbrowser
nitro-cli terminate-enclave --all || true
pkill -f ztbrowser-parent-proxy || true
scripts/aws-build-enclave.sh
ENCLAVE_MEMORY_MIB=2048 scripts/aws-run-enclave.sh
nohup env \
  MEASUREMENTS_PATH=/home/ec2-user/ztbrowser/aws-deploy/build/describe-eif.json \
  WORKLOAD_ID=ztbrowser-aws-nitro \
  REPO_URL=https://github.com/rusyaew/ztbrowser \
  OCI_IMAGE_DIGEST=sha256:1111111111111111111111111111111111111111111111111111111111111111 \
  scripts/aws-run-parent-proxy.sh \
  >/tmp/ztbrowser-parent-proxy.log 2>&1 &
```

## Troubleshooting

### `GET /` works but attestation fails

Check:

```bash
nitro-cli describe-enclaves
tail -n 100 /tmp/ztbrowser-parent-proxy.log
```

The parent proxy must be able to connect to:

- `vsock://16:5005`

### `run-enclave` fails with a memory error

Use:

```bash
ENCLAVE_MEMORY_MIB=2048 scripts/aws-run-enclave.sh
```

The current build is known-good at `2048 MiB`.

### Allocator fails to start

Make sure `/etc/nitro_enclaves/allocator.yaml` starts with:

```yaml
---
```

### Public page is unreachable

Check:

```bash
ss -ltnp | grep 9999
```

And confirm the security group allows:

- `9999/tcp`

### Public IP changed after recreation

That is expected if you used an auto-assigned public IP.

If you need a stable address:

- allocate an Elastic IP
- or put a DNS name in front of the instance

## Safe deletion summary

It is safe to terminate the current EC2 instance now because:

1. The live deployment is fully reproducible from this repo.
2. The PCRs were re-verified after pinning the Docker base images and using the Rust lockfile.
3. The instance holds only ephemeral runtime state:
   - running enclave
   - built EIF
   - proxy process
   - logs in `/tmp`

What is not preserved by instance recreation:

1. the public IP, unless you use Elastic IP
2. any files you changed directly on the host without syncing them back

For this deployment, the authoritative copy is the local repo at:

- `/home/gleb/zt-tech/ztbrowser`
