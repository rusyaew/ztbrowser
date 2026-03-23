import fs from 'node:fs';
import {render} from 'ink';
import React from 'react';
import {App} from './app.js';
import {
  ensureUserConfig,
  loadMergedRepos,
  loadUserDefaults,
  publishSharedRepo,
  saveLocalRepo,
  validateMergedConfig,
} from './catalog.js';
import {findRepoRoot} from './paths.js';
import type {RepoDefinition} from './types.js';

function usage(): never {
  console.error(`Usage:
  ztdeploy
  ztdeploy init
  ztdeploy validate
  ztdeploy catalog list
  ztdeploy catalog add --id <id> --name <name> --url <github-url> --description <text> [--publish]
  ztdeploy catalog publish --id <id>`);
  process.exit(1);
}

function parseFlags(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith('--')) {
      continue;
    }
    const next = args[index + 1];
    if (!next || next.startsWith('--')) {
      result[arg.slice(2)] = true;
    } else {
      result[arg.slice(2)] = next;
      index += 1;
    }
  }
  return result;
}

async function main(): Promise<void> {
  const repoRoot = findRepoRoot();
  const [, , ...argv] = process.argv;
  const command = argv[0];

  if (!command) {
    const repos = validateMergedConfig(repoRoot);
    render(<App repoRoot={repoRoot} repos={repos} defaults={loadUserDefaults()} />);
    return;
  }

  if (command === 'init') {
    console.log(ensureUserConfig());
    return;
  }

  if (command === 'validate') {
    const repos = validateMergedConfig(repoRoot);
    console.log(`Config valid. ${repos.length} deployment repo(s) available.`);
    return;
  }

  if (command === 'catalog' && argv[1] === 'list') {
    const repos = loadMergedRepos(repoRoot);
    for (const repo of repos) {
      console.log(`${repo.id}\t${repo.name}\t${repo.source ?? 'shared'}\t${repo.workload_repo_url}`);
    }
    return;
  }

  if (command === 'catalog' && argv[1] === 'add') {
    const flags = parseFlags(argv.slice(2));
    const id = flags.id;
    const name = flags.name;
    const url = flags.url;
    const description = flags.description;
    if (typeof id !== 'string' || typeof name !== 'string' || typeof url !== 'string' || typeof description !== 'string') {
      usage();
    }
    const repo: RepoDefinition = {
      id,
      name,
      workload_repo_url: url,
      description,
      release_source: {type: 'github_releases'},
      orchestration_repo_root: 'auto',
      methods: [
        {
          id: 'aws_canonical',
          label: 'AWS Canonical Nitro',
          adapter: 'aws_canonical',
          status: 'active',
          description: 'Use the AWS CLI Nitro automation in this repo.',
          defaults: {
            aws_profile: loadUserDefaults().awsProfile ?? 'ztbrowser',
            release_tag: loadUserDefaults().releaseTag ?? 'v0.1.3',
            remote_ref: loadUserDefaults().remoteRef ?? 'origin/main',
            cleanup_mode: loadUserDefaults().cleanupMode ?? 'terminate',
          },
        },
      ],
      source: 'local',
    };
    saveLocalRepo(repo);
    if (flags.publish === true) {
      publishSharedRepo(repoRoot, repo);
      console.log(`Added and published ${id}`);
    } else {
      console.log(`Added ${id} to local config`);
    }
    return;
  }

  if (command === 'catalog' && argv[1] === 'publish') {
    const flags = parseFlags(argv.slice(2));
    const id = flags.id;
    if (typeof id !== 'string') {
      usage();
    }
    const repo = loadMergedRepos(repoRoot).find((entry) => entry.id === id);
    if (!repo) {
      throw new Error(`Unknown repo id: ${id}`);
    }
    publishSharedRepo(repoRoot, repo);
    console.log(`Published ${id} to deploy/catalog.yml`);
    return;
  }

  if (command === '--help' || command === '-h') {
    usage();
  }

  if (fs.existsSync(command)) {
    usage();
  }

  usage();
}

void main();
