import path from 'node:path';
import type {ManagedInstanceRecord} from './types.js';

function awsScript(repoRoot: string, name: string): string {
  return path.join(repoRoot, 'scripts', 'aws-cli', name);
}

async function runJsonScript(
  repoRoot: string,
  scriptName: string,
  awsProfile: string,
  args: string[] = [],
): Promise<string> {
  const {spawn} = await import('node:child_process');
  return new Promise<string>((resolve, reject) => {
    const child = spawn(awsScript(repoRoot, scriptName), args, {
      cwd: repoRoot,
      env: {...process.env, AWS_PROFILE: awsProfile},
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if ((code ?? 0) !== 0) {
        reject(new Error(stderr.trim() || `script ${scriptName} failed with code ${code ?? 'unknown'}`));
        return;
      }
      resolve(stdout);
    });
  });
}

export async function listManagedInstances(repoRoot: string, awsProfile: string): Promise<ManagedInstanceRecord[]> {
  const raw = await runJsonScript(repoRoot, 'list-managed-instances.sh', awsProfile);
  const parsed = JSON.parse(raw) as Array<{
    instance_id?: string;
    instance_type?: string;
    platform?: string;
    state?: string;
    public_ip?: string;
    public_dns?: string;
    launch_time?: string;
  }>;
  return parsed
    .map((entry) => ({
      instanceId: entry.instance_id ?? '',
      instanceType: entry.instance_type ?? 'unknown',
      platform: entry.platform ?? 'aws_nitro_eif',
      state: entry.state ?? 'unknown',
      publicIp: entry.public_ip ?? '-',
      publicDns: entry.public_dns ?? '-',
      launchTime: entry.launch_time ?? '-',
    }))
    .sort((a, b) => a.instanceId.localeCompare(b.instanceId));
}

export async function terminateManagedInstance(repoRoot: string, awsProfile: string, instanceId: string): Promise<void> {
  await runJsonScript(repoRoot, 'terminate-instance.sh', awsProfile, [instanceId]);
}

export async function stopManagedInstance(repoRoot: string, awsProfile: string, instanceId: string): Promise<void> {
  await runJsonScript(repoRoot, 'stop-instance.sh', awsProfile, [instanceId]);
}
