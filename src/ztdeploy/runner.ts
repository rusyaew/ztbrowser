import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {ensureDir} from './paths.js';
import type {
  CommandResult,
  CommandSpec,
  RunMeta,
  RuntimeContext,
  StageApi,
  StageDefinition,
  StageRuntimeState,
} from './types.js';

export interface RunnerCallbacks {
  onStageState: (states: StageRuntimeState[]) => void;
  onLogLine: (line: string) => void;
  onMetaPatch?: (meta: RunMeta) => void;
}

export interface RunnerResult {
  success: boolean;
  error?: Error;
  meta: RunMeta;
}

function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_./:@=-]+$/.test(value)) {
    return value;
  }
  return `'${value.replace(/'/g, `'\"'\"'`)}'`;
}

function displayCommand(spec: CommandSpec): string {
  if (spec.display) {
    return spec.display;
  }
  return [spec.cmd, ...(spec.args ?? [])].map(shellQuote).join(' ');
}

function splitLogLines(buffer: string, onLine: (line: string) => void): string {
  const parts = buffer.split(/\r?\n/);
  const remainder = parts.pop() ?? '';
  for (const line of parts) {
    onLine(line);
  }
  return remainder;
}

export async function runStages(
  ctx: RuntimeContext,
  stages: StageDefinition[],
  callbacks: RunnerCallbacks,
): Promise<RunnerResult> {
  ensureDir(ctx.runDir);
  const logPath = path.join(ctx.runDir, 'run.log');
  const metaPath = path.join(ctx.runDir, 'meta.json');
  const logStream = fs.createWriteStream(logPath, {flags: 'a'});

  const meta: RunMeta = {
    startedAt: new Date().toISOString(),
    repoId: ctx.selectedRepo.id,
    methodId: ctx.selectedMethod.id,
    releaseTag: ctx.releaseTag,
    awsProfile: ctx.awsProfile,
    cleanupMode: ctx.cleanupMode,
    runAction: ctx.runAction,
    runDir: ctx.runDir,
    platform: ctx.platform,
  };

  const states: StageRuntimeState[] = stages.map((stage) => ({
    id: stage.id,
    title: stage.title,
    description: stage.description,
    status: 'queued',
  }));

  const writeMeta = async (patch: Record<string, unknown>) => {
    Object.assign(meta, patch);
    await fs.promises.writeFile(metaPath, JSON.stringify(meta, null, 2));
    callbacks.onMetaPatch?.({...meta});
  };

  const emitLog = (stageId: string, message: string) => {
    const line = `[${stageId}] ${message}`;
    callbacks.onLogLine(line);
    logStream.write(`${line}\n`);
  };

  const stageApi: StageApi = {
    runCommand: async (stageId, spec) => {
      const commandText = displayCommand(spec);
      ctx.lastCommand = commandText;
      emitLog(stageId, `$ ${commandText}`);

      return new Promise<CommandResult>((resolve, reject) => {
        const child = spawn(spec.cmd, spec.args ?? [], {
          cwd: spec.cwd ?? ctx.repoRoot,
          env: {...process.env, ...spec.env},
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        let stderr = '';
        let stdoutCarry = '';
        let stderrCarry = '';

        child.stdout.on('data', (chunk: Buffer | string) => {
          const text = chunk.toString();
          stdout += text;
          stdoutCarry = splitLogLines(stdoutCarry + text, (line) => emitLog(stageId, line));
        });

        child.stderr.on('data', (chunk: Buffer | string) => {
          const text = chunk.toString();
          stderr += text;
          stderrCarry = splitLogLines(stderrCarry + text, (line) => emitLog(stageId, line));
        });

        child.on('error', (error) => reject(error));
        child.on('close', (code) => {
          if (stdoutCarry) {
            emitLog(stageId, stdoutCarry);
          }
          if (stderrCarry) {
            emitLog(stageId, stderrCarry);
          }
          const result = {code: code ?? 0, stdout, stderr};
          if ((code ?? 0) !== 0) {
            reject(new Error(`Command failed (${code ?? 'unknown'}): ${commandText}`));
            return;
          }
          resolve(result);
        });
      });
    },
    log: emitLog,
    writeMeta,
  };

  callbacks.onStageState(states);
  await writeMeta({logPath, metaPath});

  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    states[index] = {...states[index], status: 'running', startedAt: Date.now()};
    callbacks.onStageState([...states]);
    try {
      await stage.run(ctx, stageApi);
      states[index] = {...states[index], status: 'succeeded', endedAt: Date.now()};
      callbacks.onStageState([...states]);
    } catch (error) {
      states[index] = {...states[index], status: 'failed', endedAt: Date.now()};
      for (let rest = index + 1; rest < states.length; rest += 1) {
        states[rest] = {...states[rest], status: 'skipped'};
      }
      callbacks.onStageState([...states]);
      await writeMeta({
        success: false,
        finishedAt: new Date().toISOString(),
        platform: ctx.platform,
        instanceId: ctx.instanceId,
        instanceType: ctx.instanceType,
        host: ctx.host,
      });
      logStream.end();
      return {success: false, error: error as Error, meta};
    }
  }

  await writeMeta({
    success: true,
    finishedAt: new Date().toISOString(),
    platform: ctx.platform,
    instanceId: ctx.instanceId,
    instanceType: ctx.instanceType,
    host: ctx.host,
  });
  logStream.end();
  return {success: true, meta};
}
