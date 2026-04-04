import path from 'node:path';
import type {CommandSpec, RuntimeContext} from '../types.js';

const HOST_REPO_DIR = '/home/ec2-user/ztbrowser';
const SSH_USER = 'ec2-user';
const PROXY_PORT = 9999;
const LOCAL_KEY_PATH = '/home/gleb/ztbrowser-nitro-key.pem';
const AWS_REGION = 'us-east-1';

function platformResourceStem(platform: string): string {
  switch (platform) {
    case 'aws_coco_snp':
      return 'ztbrowser-coco-parent';
    case 'aws_nitro_eif':
    default:
      return 'ztbrowser-nitro-parent';
  }
}

export function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_./:@=-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

export function render(spec: CommandSpec): string {
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
    PLATFORM: ctx.platform,
    INSTANCE_NAME: ctx.instanceName,
    LAUNCH_TEMPLATE_NAME: ctx.launchTemplateName,
    SECURITY_GROUP_NAME: ctx.securityGroupName,
  };
}

export function localScript(ctx: RuntimeContext, scriptName: string, args: string[] = []): CommandSpec {
  const relativePath = path.join('scripts', 'aws-cli', scriptName);
  return {
    cmd: path.join(ctx.repoRoot, relativePath),
    args,
    cwd: ctx.repoRoot,
    env: awsEnv(ctx),
    display: [
      `AWS_PROFILE=${ctx.awsProfile}`,
      `AWS_REGION=${ctx.awsRegion}`,
      `PLATFORM=${ctx.platform}`,
      relativePath,
      ...args,
    ].join(' '),
  };
}

export function sshSpec(ctx: RuntimeContext, remoteCommand: string, placeholder = '<pending-instance-ip>'): CommandSpec {
  const host = ctx.host ?? placeholder;
  return {
    cmd: 'ssh',
    args: ['-o', 'StrictHostKeyChecking=accept-new', '-i', ctx.localKeyPath, `${ctx.sshUser}@${host}`, remoteCommand],
    cwd: ctx.repoRoot,
    display: `ssh -o StrictHostKeyChecking=accept-new -i ${shellQuote(ctx.localKeyPath)} ${ctx.sshUser}@${host} ${shellQuote(remoteCommand)}`,
  };
}

export function bashSpec(command: string, cwd: string, env: NodeJS.ProcessEnv, display?: string): CommandSpec {
  return {cmd: 'bash', args: ['-lc', command], cwd, env, display: display ?? command};
}

export function runtimeHost(ctx: RuntimeContext): string {
  return ctx.host ?? '<pending-instance-ip>';
}

export function createAwsRuntimeContext(
  base: Omit<
    RuntimeContext,
    'platform' | 'instanceName' | 'launchTemplateName' | 'securityGroupName' | 'awsRegion' | 'localKeyPath' | 'hostRepoDir' | 'proxyPort' | 'sshUser'
  >,
  platform: string,
): RuntimeContext {
  const stem = platformResourceStem(platform);
  return {
    ...base,
    platform,
    instanceName: process.env.INSTANCE_NAME ?? stem,
    launchTemplateName: process.env.LAUNCH_TEMPLATE_NAME ?? stem,
    securityGroupName: process.env.SECURITY_GROUP_NAME ?? `${stem}-sg`,
    awsRegion: AWS_REGION,
    localKeyPath: process.env.LOCAL_KEY_PATH ?? LOCAL_KEY_PATH,
    hostRepoDir: process.env.HOST_REPO_DIR ?? HOST_REPO_DIR,
    proxyPort: Number(process.env.PROXY_PORT ?? PROXY_PORT),
    sshUser: process.env.SSH_USER ?? SSH_USER,
  };
}
