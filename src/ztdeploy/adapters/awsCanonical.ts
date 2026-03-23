import path from 'node:path';
import type {CommandSpec, RuntimeContext, StageDefinition} from '../types.js';

const HOST_REPO_DIR = '/home/ec2-user/ztbrowser';
const SSH_USER = 'ec2-user';
const PROXY_PORT = 9999;
const LOCAL_KEY_PATH = '/home/gleb/ztbrowser-nitro-key.pem';
const AWS_REGION = 'us-east-1';

function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_./:@=-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function render(spec: CommandSpec): string {
  if (spec.display) {
    return spec.display;
  }
  return [spec.cmd, ...(spec.args ?? [])].map(shellQuote).join(' ');
}

function awsEnv(ctx: RuntimeContext): NodeJS.ProcessEnv {
  return {
    ...process.env,
    AWS_PROFILE: ctx.awsProfile,
    AWS_REGION: ctx.awsRegion,
    LOCAL_KEY_PATH: ctx.localKeyPath,
    HOST_REPO_DIR: ctx.hostRepoDir,
    PROXY_PORT: String(ctx.proxyPort),
  };
}

function localScript(ctx: RuntimeContext, scriptName: string, args: string[] = []): CommandSpec {
  const relativePath = path.join('scripts', 'aws-cli', scriptName);
  return {
    cmd: path.join(ctx.repoRoot, relativePath),
    args,
    cwd: ctx.repoRoot,
    env: awsEnv(ctx),
    display: [`AWS_PROFILE=${ctx.awsProfile}`, `AWS_REGION=${ctx.awsRegion}`, relativePath, ...args].join(' '),
  };
}

function sshSpec(ctx: RuntimeContext, remoteCommand: string, placeholder = '<pending-instance-ip>'): CommandSpec {
  const host = ctx.host ?? placeholder;
  return {
    cmd: 'ssh',
    args: ['-o', 'StrictHostKeyChecking=accept-new', '-i', ctx.localKeyPath, `${ctx.sshUser}@${host}`, remoteCommand],
    cwd: ctx.repoRoot,
    display: `ssh -o StrictHostKeyChecking=accept-new -i ${shellQuote(ctx.localKeyPath)} ${ctx.sshUser}@${host} ${shellQuote(remoteCommand)}`,
  };
}

function bashSpec(command: string, cwd: string, env: NodeJS.ProcessEnv, display?: string): CommandSpec {
  return {cmd: 'bash', args: ['-lc', command], cwd, env, display: display ?? command};
}

function runtimeHost(ctx: RuntimeContext): string {
  return ctx.host ?? '<pending-instance-ip>';
}

export function createAwsCanonicalContext(base: Omit<RuntimeContext, 'awsRegion' | 'localKeyPath' | 'hostRepoDir' | 'proxyPort' | 'sshUser'>): RuntimeContext {
  return {
    ...base,
    awsRegion: AWS_REGION,
    localKeyPath: process.env.LOCAL_KEY_PATH ?? LOCAL_KEY_PATH,
    hostRepoDir: process.env.HOST_REPO_DIR ?? HOST_REPO_DIR,
    proxyPort: Number(process.env.PROXY_PORT ?? PROXY_PORT),
    sshUser: process.env.SSH_USER ?? SSH_USER,
  };
}

export function buildAwsCanonicalStages(ctx: RuntimeContext): StageDefinition[] {
  const remoteParentDir = path.posix.dirname(ctx.hostRepoDir);
  const extraArgs = ctx.extraSshCidrs.flatMap((cidr) => ['--extra-ssh-cidr', cidr]);

  return [
    {
      id: 'check-prereqs',
      title: 'Check Local Prereqs',
      description: 'Validate AWS CLI credentials, SSH tooling, curl, git, and Python on the operator machine.',
      preview: (runtime) => [render(localScript(runtime, 'check-prereqs.sh'))],
      run: async (runtime, api) => {
        await api.runCommand('check-prereqs', localScript(runtime, 'check-prereqs.sh'));
      },
    },
    {
      id: 'ensure-keypair',
      title: 'Ensure Key Pair',
      description: 'Create or reuse the EC2 key pair and align the local private key file.',
      preview: (runtime) => [render(localScript(runtime, 'ensure-keypair.sh'))],
      run: async (runtime, api) => {
        const result = await api.runCommand('ensure-keypair', localScript(runtime, 'ensure-keypair.sh'));
        runtime.keyName = result.stdout.trim() || runtime.keyName;
        await api.writeMeta({keyName: runtime.keyName});
      },
    },
    {
      id: 'ensure-security-group',
      title: 'Ensure Security Group',
      description: 'Create or reuse the dedicated security group and keep the public proxy port exposed.',
      preview: (runtime) => [render(localScript(runtime, 'ensure-security-group.sh'))],
      run: async (runtime, api) => {
        const result = await api.runCommand('ensure-security-group', localScript(runtime, 'ensure-security-group.sh'));
        runtime.securityGroupId = result.stdout.trim() || runtime.securityGroupId;
        await api.writeMeta({securityGroupId: runtime.securityGroupId});
      },
    },
    {
      id: 'sync-ssh-ip',
      title: 'Sync SSH Allowlist',
      description: 'Update the SSH ingress rule to the current public IP plus any extra CIDRs.',
      preview: (runtime) => [render(localScript(runtime, 'sync-ssh-ip.sh', extraArgs))],
      run: async (runtime, api) => {
        await api.runCommand('sync-ssh-ip', localScript(runtime, 'sync-ssh-ip.sh', extraArgs));
      },
    },
    {
      id: 'ensure-launch-template',
      title: 'Ensure Launch Template',
      description: 'Create or update the Nitro-enabled launch template used for managed instances.',
      preview: (runtime) => [render(localScript(runtime, 'ensure-launch-template.sh'))],
      run: async (runtime, api) => {
        const result = await api.runCommand('ensure-launch-template', localScript(runtime, 'ensure-launch-template.sh'));
        runtime.launchTemplateId = result.stdout.trim() || runtime.launchTemplateId;
        await api.writeMeta({launchTemplateId: runtime.launchTemplateId});
      },
    },
    {
      id: 'ensure-instance',
      title: 'Ensure Instance',
      description: 'Start a managed parent instance or launch a new one from the launch template.',
      preview: (runtime) => [render(localScript(runtime, 'ensure-instance.sh'))],
      run: async (runtime, api) => {
        const result = await api.runCommand('ensure-instance', localScript(runtime, 'ensure-instance.sh'));
        const info = JSON.parse(result.stdout.trim()) as {
          instance_id: string;
          public_ip: string;
          public_dns: string;
          local_key_path?: string;
        };
        runtime.instanceId = info.instance_id;
        runtime.host = info.public_ip;
        runtime.publicDns = info.public_dns;
        if (info.local_key_path) {
          runtime.localKeyPath = info.local_key_path;
        }
        await api.writeMeta({instanceId: runtime.instanceId, host: runtime.host, publicDns: runtime.publicDns});
      },
    },
    {
      id: 'bootstrap-host',
      title: 'Bootstrap Host Packages',
      description: 'Install Nitro CLI, Docker, tmux, Rust, and supporting packages on the EC2 parent instance.',
      preview: (runtime) => [
        render(
          sshSpec(
            runtime,
            'if ! command -v git >/dev/null 2>&1 || ! command -v nitro-cli >/dev/null 2>&1 || ! command -v docker >/dev/null 2>&1 || ! command -v tmux >/dev/null 2>&1; then sudo dnf install aws-nitro-enclaves-cli aws-nitro-enclaves-cli-devel docker git tmux rust cargo -y && sudo usermod -aG ne ec2-user && sudo usermod -aG docker ec2-user && sudo systemctl enable --now docker; fi',
          ),
        ),
      ],
      run: async (runtime, api) => {
        await api.runCommand(
          'bootstrap-host',
          sshSpec(
            runtime,
            'if ! command -v git >/dev/null 2>&1 || ! command -v nitro-cli >/dev/null 2>&1 || ! command -v docker >/dev/null 2>&1 || ! command -v tmux >/dev/null 2>&1; then sudo dnf install aws-nitro-enclaves-cli aws-nitro-enclaves-cli-devel docker git tmux rust cargo -y && sudo usermod -aG ne ec2-user && sudo usermod -aG docker ec2-user && sudo systemctl enable --now docker; fi',
          ),
        );
      },
    },
    {
      id: 'sync-host-repo',
      title: 'Clone/Update Orchestration Repo',
      description: 'Clone ztbrowser on the instance if needed and checkout the requested ref for deployment scripts.',
      preview: (runtime) => [
        render(
          sshSpec(
            runtime,
            `mkdir -p '${remoteParentDir}' && if [ ! -d '${runtime.hostRepoDir}/.git' ]; then rm -rf '${runtime.hostRepoDir}' && git clone https://github.com/rusyaew/ztbrowser.git '${runtime.hostRepoDir}'; fi`,
          ),
        ),
        render(sshSpec(runtime, `cd '${runtime.hostRepoDir}' && git fetch origin --tags && git checkout -B deploy '${runtime.remoteRef}'`)),
      ],
      run: async (runtime, api) => {
        await api.runCommand(
          'sync-host-repo',
          sshSpec(
            runtime,
            `mkdir -p '${remoteParentDir}' && if [ ! -d '${runtime.hostRepoDir}/.git' ]; then rm -rf '${runtime.hostRepoDir}' && git clone https://github.com/rusyaew/ztbrowser.git '${runtime.hostRepoDir}'; fi`,
          ),
        );
        await api.runCommand(
          'sync-host-repo',
          sshSpec(runtime, `cd '${runtime.hostRepoDir}' && git fetch origin --tags && git checkout -B deploy '${runtime.remoteRef}'`),
        );
      },
    },
    {
      id: 'configure-allocator',
      title: 'Configure Allocator',
      description: 'Reserve CPU and memory for enclaves and start the Nitro allocator service.',
      preview: (runtime) => [
        render(
          sshSpec(
            runtime,
            "sudo tee /etc/nitro_enclaves/allocator.yaml >/dev/null <<'YAML'\n---\nmemory_mib: 2048\ncpu_count: 2\nYAML\nsudo systemctl enable --now nitro-enclaves-allocator.service",
          ),
        ),
      ],
      run: async (runtime, api) => {
        await api.runCommand(
          'configure-allocator',
          sshSpec(
            runtime,
            "sudo tee /etc/nitro_enclaves/allocator.yaml >/dev/null <<'YAML'\n---\nmemory_mib: 2048\ncpu_count: 2\nYAML\nsudo systemctl enable --now nitro-enclaves-allocator.service",
          ),
        );
      },
    },
    {
      id: 'fetch-release',
      title: 'Fetch Enclave Release',
      description: 'Download the canonical EIF, measurements, and provenance manifest for the selected tag.',
      preview: (runtime) => [render(sshSpec(runtime, `cd '${runtime.hostRepoDir}' && ./scripts/fetch-enclave-release.sh '${runtime.releaseTag}'`))],
      run: async (runtime, api) => {
        await api.runCommand('fetch-release', sshSpec(runtime, `cd '${runtime.hostRepoDir}' && ./scripts/fetch-enclave-release.sh '${runtime.releaseTag}'`));
      },
    },
    {
      id: 'stop-previous-runtime',
      title: 'Stop Previous Runtime',
      description: 'Terminate any old enclaves and stop the previous parent proxy session before redeploying.',
      preview: (runtime) => [render(sshSpec(runtime, 'nitro-cli terminate-enclave --all >/dev/null 2>&1 || true; tmux kill-session -t ztbrowser-proxy >/dev/null 2>&1 || true'))],
      run: async (runtime, api) => {
        await api.runCommand(
          'stop-previous-runtime',
          sshSpec(runtime, 'nitro-cli terminate-enclave --all >/dev/null 2>&1 || true; tmux kill-session -t ztbrowser-proxy >/dev/null 2>&1 || true'),
        );
      },
    },
    {
      id: 'run-enclave',
      title: 'Run Enclave',
      description: 'Launch the fetched EIF inside Nitro Enclaves on the EC2 parent instance.',
      preview: (runtime) => [render(sshSpec(runtime, `cd '${runtime.hostRepoDir}' && ./scripts/aws-run-enclave.sh`))],
      run: async (runtime, api) => {
        await api.runCommand('run-enclave', sshSpec(runtime, `cd '${runtime.hostRepoDir}' && ./scripts/aws-run-enclave.sh`));
      },
    },
    {
      id: 'start-parent-proxy',
      title: 'Start Parent Proxy',
      description: 'Run the parent HTTP proxy in tmux with provenance and measurements wired in.',
      preview: (runtime) => [
        render(
          sshSpec(
            runtime,
            `cd '${runtime.hostRepoDir}' && tmux new-session -d -s ztbrowser-proxy 'PROVENANCE_PATH=${runtime.hostRepoDir}/aws-deploy/build/provenance.json MEASUREMENTS_PATH=${runtime.hostRepoDir}/aws-deploy/build/describe-eif.json ./scripts/aws-run-parent-proxy.sh >> ~/ztbrowser-proxy.log 2>&1'`,
          ),
        ),
      ],
      run: async (runtime, api) => {
        await api.runCommand(
          'start-parent-proxy',
          sshSpec(
            runtime,
            `cd '${runtime.hostRepoDir}' && tmux new-session -d -s ztbrowser-proxy 'PROVENANCE_PATH=${runtime.hostRepoDir}/aws-deploy/build/provenance.json MEASUREMENTS_PATH=${runtime.hostRepoDir}/aws-deploy/build/describe-eif.json ./scripts/aws-run-parent-proxy.sh >> ~/ztbrowser-proxy.log 2>&1'`,
          ),
        );
      },
    },
    {
      id: 'wait-proxy',
      title: 'Wait For Proxy Ready',
      description: 'Poll the deployed HTTP surface until the public landing page responds.',
      preview: (runtime) => [
        render(
          bashSpec(
            `for attempt in $(seq 1 60); do if curl -fsS http://${runtimeHost(runtime)}:${runtime.proxyPort}/ >/dev/null 2>&1; then exit 0; fi; sleep 2; done; exit 1`,
            runtime.repoRoot,
            process.env,
            `curl readiness loop for http://${runtimeHost(runtime)}:${runtime.proxyPort}/`,
          ),
        ),
      ],
      run: async (runtime, api) => {
        await api.runCommand(
          'wait-proxy',
          bashSpec(
            `for attempt in $(seq 1 60); do if curl -fsS http://${runtime.host}:${runtime.proxyPort}/ >/dev/null 2>&1; then echo ready; exit 0; fi; sleep 2; done; echo proxy_not_ready; exit 1`,
            runtime.repoRoot,
            process.env,
            `curl readiness loop for http://${runtime.host}:${runtime.proxyPort}/`,
          ),
        );
      },
    },
    {
      id: 'verify-landing',
      title: 'Verify Landing Page',
      description: 'Confirm the public landing page is reachable after the proxy starts.',
      preview: (runtime) => [render(bashSpec(`curl -fsS http://${runtimeHost(runtime)}:${runtime.proxyPort}/`, runtime.repoRoot, process.env))],
      run: async (runtime, api) => {
        await api.runCommand('verify-landing', bashSpec(`curl -fsS http://${runtime.host}:${runtime.proxyPort}/`, runtime.repoRoot, process.env));
      },
    },
    {
      id: 'verify-attestation',
      title: 'Verify Attestation Endpoint',
      description: 'Call the attestation endpoint and ensure a Nitro attestation document is present.',
      preview: (runtime) => [
        render(
          bashSpec(
            `curl -fsS -X POST http://${runtimeHost(runtime)}:${runtime.proxyPort}/.well-known/attestation -H 'Content-Type: application/json' -d '{"NONCE":"00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"}' | grep -q nitro_attestation_doc_b64`,
            runtime.repoRoot,
            process.env,
          ),
        ),
      ],
      run: async (runtime, api) => {
        await api.runCommand(
          'verify-attestation',
          bashSpec(
            `curl -fsS -X POST http://${runtime.host}:${runtime.proxyPort}/.well-known/attestation -H 'Content-Type: application/json' -d '{"NONCE":"00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"}' | grep -q nitro_attestation_doc_b64`,
            runtime.repoRoot,
            process.env,
          ),
        );
      },
    },
    {
      id: 'cleanup',
      title: ctx.runAction === 'deploy' ? 'Keep Deployment Running' : 'Cleanup',
      description:
        ctx.runAction === 'deploy'
          ? 'Keep the managed EC2 instance running so the deployment stays live.'
          : ctx.cleanupMode === 'pause'
            ? 'Stop the managed EC2 instance for later reuse.'
            : 'Terminate the managed EC2 instance after verification.',
      preview: (runtime) => {
        if (runtime.runAction === 'deploy') {
          return ['leave the managed EC2 instance running'];
        }
        const instanceId = runtime.instanceId ?? '<instance-id>';
        if (runtime.cleanupMode === 'pause') {
          return [render(bashSpec(`AWS_PROFILE=${runtime.awsProfile} AWS_REGION=${runtime.awsRegion} aws ec2 stop-instances --instance-ids ${instanceId}`, runtime.repoRoot, process.env))];
        }
        return [render(bashSpec(`AWS_PROFILE=${runtime.awsProfile} AWS_REGION=${runtime.awsRegion} aws ec2 terminate-instances --instance-ids ${instanceId}`, runtime.repoRoot, process.env))];
      },
      run: async (runtime, api) => {
        if (runtime.runAction === 'deploy') {
          api.log('cleanup', `Keeping deployment live on ${runtime.host ?? 'the managed instance'}`);
          return;
        }
        if (!runtime.instanceId) {
          api.log('cleanup', 'No managed instance recorded; skipping cleanup');
          return;
        }
        const command =
          runtime.cleanupMode === 'pause'
            ? `AWS_PROFILE=${runtime.awsProfile} AWS_REGION=${runtime.awsRegion} aws ec2 stop-instances --instance-ids ${runtime.instanceId} >/dev/null && AWS_PROFILE=${runtime.awsProfile} AWS_REGION=${runtime.awsRegion} aws ec2 wait instance-stopped --instance-ids ${runtime.instanceId}`
            : `AWS_PROFILE=${runtime.awsProfile} AWS_REGION=${runtime.awsRegion} aws ec2 terminate-instances --instance-ids ${runtime.instanceId} >/dev/null && AWS_PROFILE=${runtime.awsProfile} AWS_REGION=${runtime.awsRegion} aws ec2 wait instance-terminated --instance-ids ${runtime.instanceId}`;
        await api.runCommand('cleanup', bashSpec(command, runtime.repoRoot, process.env));
      },
    },
  ];
}
