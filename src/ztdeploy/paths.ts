import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

function hasRepoMarkers(dir: string): boolean {
  return fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'scripts', 'aws-cli'));
}

export function findRepoRoot(startDir = process.cwd()): string {
  let current = path.resolve(startDir);
  while (true) {
    if (hasRepoMarkers(current)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      throw new Error(`Could not locate ztbrowser repo root from ${startDir}`);
    }
    current = parent;
  }
}

export function sharedCatalogPath(repoRoot: string): string {
  return path.join(repoRoot, 'deploy', 'catalog.yml');
}

export function userConfigPath(): string {
  return path.join(os.homedir(), '.config', 'ztdeploy', 'config.yml');
}

export function stateRootPath(): string {
  return path.join(os.homedir(), '.local', 'state', 'ztdeploy');
}

export function ensureParentDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, {recursive: true});
}
