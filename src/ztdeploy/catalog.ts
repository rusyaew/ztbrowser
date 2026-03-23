import fs from 'node:fs';
import YAML from 'yaml';
import {ensureParentDir, sharedCatalogPath, userConfigPath} from './paths.js';
import type {CatalogFile, RepoDefinition, RunSettings, UserConfigFile} from './types.js';

function readYamlFile<T>(filePath: string, fallback: T): T {
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) {
    return fallback;
  }
  return YAML.parse(raw) as T;
}

function writeYamlFile(filePath: string, data: unknown): void {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, YAML.stringify(data), 'utf8');
}

export function loadSharedCatalog(repoRoot: string): CatalogFile {
  const catalog = readYamlFile<CatalogFile>(sharedCatalogPath(repoRoot), {repos: []});
  return {
    repos: (catalog.repos ?? []).map((repo) => ({...repo, source: 'shared'})),
  };
}

export function loadUserConfig(): UserConfigFile {
  return readYamlFile<UserConfigFile>(userConfigPath(), {});
}

export function ensureUserConfig(): string {
  const filePath = userConfigPath();
  if (!fs.existsSync(filePath)) {
    writeYamlFile(filePath, {repos: [], defaults: {awsProfile: 'ztbrowser', remoteRef: 'origin/main', cleanupMode: 'terminate'}});
  }
  return filePath;
}

export function loadMergedRepos(repoRoot: string): RepoDefinition[] {
  const shared = loadSharedCatalog(repoRoot).repos;
  const local = (loadUserConfig().repos ?? []).map((repo) => ({...repo, source: 'local' as const}));
  const merged = new Map<string, RepoDefinition>();
  for (const repo of shared) {
    merged.set(repo.id, repo);
  }
  for (const repo of local) {
    merged.set(repo.id, repo);
  }
  return [...merged.values()];
}

export function loadUserDefaults(): Partial<RunSettings> {
  return loadUserConfig().defaults ?? {};
}

export function saveLocalRepo(repo: RepoDefinition): void {
  const config = loadUserConfig();
  const repos = [...(config.repos ?? [])];
  const index = repos.findIndex((entry) => entry.id === repo.id);
  const cleanRepo = {...repo};
  delete cleanRepo.source;
  if (index >= 0) {
    repos[index] = cleanRepo;
  } else {
    repos.push(cleanRepo);
  }
  writeYamlFile(userConfigPath(), {...config, repos});
}

export function publishSharedRepo(repoRoot: string, repo: RepoDefinition): void {
  const catalog = loadSharedCatalog(repoRoot);
  const repos = [...catalog.repos];
  const index = repos.findIndex((entry) => entry.id === repo.id);
  const cleanRepo = {...repo};
  delete cleanRepo.source;
  if (index >= 0) {
    repos[index] = cleanRepo;
  } else {
    repos.push(cleanRepo);
  }
  writeYamlFile(sharedCatalogPath(repoRoot), {repos});
}

export function validateMergedConfig(repoRoot: string): RepoDefinition[] {
  const repos = loadMergedRepos(repoRoot);
  if (repos.length === 0) {
    throw new Error('No deployment repos found in shared or local catalog');
  }
  for (const repo of repos) {
    if (!repo.id || !repo.name || !repo.workload_repo_url || !Array.isArray(repo.methods) || repo.methods.length === 0) {
      throw new Error(`Invalid repo entry: ${JSON.stringify(repo)}`);
    }
  }
  return repos;
}
