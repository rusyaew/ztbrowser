export type CleanupMode = 'terminate' | 'pause';
export type RunAction = 'deploy' | 'verify';
export type MethodStatus = 'active' | 'coming_soon' | 'disabled';
export type RepoSource = 'shared' | 'local';
export type StageStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'skipped';

export interface ReleaseSource {
  type: 'github_releases';
}

export interface MethodDefaults {
  aws_profile?: string;
  release_tag?: string;
  remote_ref?: string;
  cleanup_mode?: CleanupMode;
  extra_ssh_cidrs?: string[];
}

export interface MethodDefinition {
  id: string;
  label: string;
  adapter: string;
  status: MethodStatus;
  description: string;
  defaults?: MethodDefaults;
}

export interface RepoDefinition {
  id: string;
  name: string;
  workload_repo_url: string;
  description: string;
  release_source?: ReleaseSource;
  orchestration_repo_root?: string;
  methods: MethodDefinition[];
  source?: RepoSource;
}

export interface CatalogFile {
  repos: RepoDefinition[];
}

export interface UserConfigFile {
  repos?: RepoDefinition[];
  defaults?: Partial<RunSettings>;
}

export interface RunSettings {
  awsProfile: string;
  releaseTag: string;
  extraSshCidrs: string[];
  remoteRef: string;
  cleanupMode: CleanupMode;
  runAction: RunAction;
}

export interface RuntimeContext extends RunSettings {
  repoRoot: string;
  selectedRepo: RepoDefinition;
  selectedMethod: MethodDefinition;
  stateRoot: string;
  runDir: string;
  awsRegion: string;
  localKeyPath: string;
  hostRepoDir: string;
  proxyPort: number;
  sshUser: string;
  instanceId?: string;
  host?: string;
  publicDns?: string;
  launchTemplateId?: string;
  securityGroupId?: string;
  keyName?: string;
  lastCommand?: string;
}

export interface CommandResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface CommandSpec {
  cmd: string;
  args?: string[];
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  display?: string;
}

export interface StageDefinition {
  id: string;
  title: string;
  description: string;
  preview: (ctx: RuntimeContext) => string[];
  run: (ctx: RuntimeContext, api: StageApi) => Promise<void>;
}

export interface StageApi {
  runCommand: (stageId: string, spec: CommandSpec) => Promise<CommandResult>;
  log: (stageId: string, message: string) => void;
  writeMeta: (patch: Record<string, unknown>) => Promise<void>;
}

export interface StageRuntimeState {
  id: string;
  title: string;
  description: string;
  status: StageStatus;
  startedAt?: number;
  endedAt?: number;
}

export interface RunMeta {
  startedAt: string;
  finishedAt?: string;
  repoId: string;
  methodId: string;
  releaseTag: string;
  awsProfile: string;
  cleanupMode: CleanupMode;
  runAction?: RunAction;
  runDir: string;
  success?: boolean;
  instanceId?: string;
  host?: string;
}

export interface GithubReleaseInfo {
  tag: string;
  publishedAt?: string;
}

export interface ManagedInstanceRecord {
  instanceId: string;
  state: string;
  publicIp: string;
  publicDns: string;
  launchTime: string;
}
