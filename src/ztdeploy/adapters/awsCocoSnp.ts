import path from 'node:path';
import type {RuntimeContext, StageDefinition} from '../types.js';
import {bashSpec, createAwsRuntimeContext, localScript, render, runtimeHost, sshSpec} from './awsShared.js';

export function createAwsCocoSnpContext(
  base: Omit<RuntimeContext, 'platform' | 'instanceName' | 'launchTemplateName' | 'securityGroupName' | 'awsRegion' | 'localKeyPath' | 'hostRepoDir' | 'proxyPort' | 'sshUser'>,
): RuntimeContext {
  return createAwsRuntimeContext(base, 'aws_coco_snp');
}

export function buildAwsCocoSnpStages(ctx: RuntimeContext): StageDefinition[] {
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
      description: 'Create or reuse the dedicated security group and keep the public wrapper port exposed.',
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
      description: 'Create or update the EC2 launch template used for managed CoCo wrapper instances.',
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
      description: 'Start a managed instance or launch a new one from the platform-specific launch template.',
      preview: (runtime) => [render(localScript(runtime, 'ensure-instance.sh'))],
      run: async (runtime, api) => {
        const result = await api.runCommand('ensure-instance', localScript(runtime, 'ensure-instance.sh'));
        const info = JSON.parse(result.stdout.trim()) as {
          instance_id: string;
          instance_type?: string;
          public_ip: string;
          public_dns: string;
          local_key_path?: string;
          platform?: string;
        };
        runtime.instanceId = info.instance_id;
        runtime.instanceType = info.instance_type ?? runtime.instanceType;
        runtime.host = info.public_ip;
        runtime.publicDns = info.public_dns;
        if (info.local_key_path) {
          runtime.localKeyPath = info.local_key_path;
        }
        await api.writeMeta({
          instanceId: runtime.instanceId,
          instanceType: runtime.instanceType,
          host: runtime.host,
          publicDns: runtime.publicDns,
          platform: info.platform ?? runtime.platform,
        });
      },
    },
    {
      id: 'bootstrap-host',
      title: 'Bootstrap Host Packages',
      description: 'Install git, tmux, curl, and Python on the EC2 host so the CoCo wrapper can run.',
      preview: (runtime) => [
        render(
          sshSpec(
            runtime,
            'if ! command -v git >/dev/null 2>&1 || ! command -v tmux >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then sudo dnf install git tmux python3 curl -y; fi',
          ),
        ),
      ],
      run: async (runtime, api) => {
        await api.runCommand(
          'bootstrap-host',
          sshSpec(
            runtime,
            'if ! command -v git >/dev/null 2>&1 || ! command -v tmux >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then sudo dnf install git tmux python3 curl -y; fi',
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
      id: 'fetch-release',
      title: 'Fetch Release Assets',
      description: 'Download the canonical release manifest, CoCo wrapper, and runtime config for the selected tag.',
      preview: (runtime) => [render(sshSpec(runtime, `cd '${runtime.hostRepoDir}' && ./scripts/fetch-enclave-release.sh '${runtime.releaseTag}'`))],
      run: async (runtime, api) => {
        await api.runCommand('fetch-release', sshSpec(runtime, `cd '${runtime.hostRepoDir}' && ./scripts/fetch-enclave-release.sh '${runtime.releaseTag}'`));
      },
    },
    {
      id: 'stop-previous-runtime',
      title: 'Stop Previous Runtime',
      description: 'Stop the previous CoCo wrapper tmux session before redeploying.',
      preview: (runtime) => [render(sshSpec(runtime, 'tmux kill-session -t ztbrowser-coco-wrapper >/dev/null 2>&1 || true'))],
      run: async (runtime, api) => {
        await api.runCommand('stop-previous-runtime', sshSpec(runtime, 'tmux kill-session -t ztbrowser-coco-wrapper >/dev/null 2>&1 || true'));
      },
    },
    {
      id: 'start-coco-wrapper',
      title: 'Start CoCo Wrapper',
      description: 'Run the fetched CoCo wrapper in tmux. This requires a host-local AA endpoint to satisfy attestation verification.',
      preview: (runtime) => [
        render(
          sshSpec(runtime, `cd '${runtime.hostRepoDir}' && tmux new-session -d -s ztbrowser-coco-wrapper './scripts/aws-run-coco-wrapper.sh >> ~/ztbrowser-coco-wrapper.log 2>&1'`),
        ),
      ],
      run: async (runtime, api) => {
        await api.runCommand(
          'start-coco-wrapper',
          sshSpec(runtime, `cd '${runtime.hostRepoDir}' && tmux new-session -d -s ztbrowser-coco-wrapper './scripts/aws-run-coco-wrapper.sh >> ~/ztbrowser-coco-wrapper.log 2>&1'`),
        );
      },
    },
    {
      id: 'wait-wrapper',
      title: 'Wait For Wrapper Ready',
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
          'wait-wrapper',
          bashSpec(
            `for attempt in $(seq 1 60); do if curl -fsS http://${runtime.host}:${runtime.proxyPort}/ >/dev/null 2>&1; then echo ready; exit 0; fi; sleep 2; done; echo wrapper_not_ready; exit 1`,
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
      description: 'Confirm the public landing page is reachable after the wrapper starts.',
      preview: (runtime) => [render(bashSpec(`curl -fsS http://${runtimeHost(runtime)}:${runtime.proxyPort}/`, runtime.repoRoot, process.env))],
      run: async (runtime, api) => {
        await api.runCommand('verify-landing', bashSpec(`curl -fsS http://${runtime.host}:${runtime.proxyPort}/`, runtime.repoRoot, process.env));
      },
    },
    {
      id: 'verify-attestation',
      title: 'Verify Attestation Endpoint',
      description: 'Call the attestation endpoint and require a CoCo common envelope. This fails honestly until the host exposes a working AA endpoint.',
      preview: (runtime) => [
        render(
          bashSpec(
            `curl -fsS -X POST http://${runtimeHost(runtime)}:${runtime.proxyPort}/.well-known/attestation -H 'Content-Type: application/json' -d '{"NONCE":"00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"}' | grep -q 'coco_trustee_evidence'`,
            runtime.repoRoot,
            process.env,
          ),
        ),
      ],
      run: async (runtime, api) => {
        await api.runCommand(
          'verify-attestation',
          bashSpec(
            `curl -fsS -X POST http://${runtime.host}:${runtime.proxyPort}/.well-known/attestation -H 'Content-Type: application/json' -d '{"NONCE":"00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff"}' | grep -q 'coco_trustee_evidence'`,
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
          ? 'Keep the managed EC2 instance running so the experimental CoCo wrapper stays live.'
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
          api.log('cleanup', `Keeping experimental CoCo deployment live on ${runtime.host ?? 'the managed instance'}`);
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
