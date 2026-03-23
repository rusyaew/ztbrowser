#!/usr/bin/env node
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const tsxCli = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
const entry = path.join(repoRoot, 'src', 'ztdeploy', 'cli.tsx');

const child = spawn(process.execPath, [tsxCli, entry, ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: 'inherit',
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
