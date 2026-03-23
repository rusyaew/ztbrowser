import os from 'node:os';
import path from 'node:path';
import React, {useEffect, useMemo, useState} from 'react';
import {Box, Text, useApp, useInput} from 'ink';
import Spinner from 'ink-spinner';
import TextInput from 'ink-text-input';
import {buildAwsCanonicalStages, createAwsCanonicalContext} from './adapters/awsCanonical.js';
import {publishSharedRepo, saveLocalRepo} from './catalog.js';
import {listManagedInstances, stopManagedInstance, terminateManagedInstance} from './deployments.js';
import {fetchGithubReleaseTags} from './github.js';
import {ensureDir, stateRootPath} from './paths.js';
import {readAwsProfiles} from './profiles.js';
import {runStages} from './runner.js';
import type {CleanupMode, GithubReleaseInfo, ManagedInstanceRecord, RepoDefinition, RunAction, RunSettings, StageRuntimeState} from './types.js';

interface AppProps {
  repoRoot: string;
  repos: RepoDefinition[];
  defaults: Partial<RunSettings>;
}

type FocusPane = 'repos' | 'stages' | 'logs';

type ModalState =
  | {type: 'none'}
  | {type: 'method'; index: number}
  | {type: 'settings'; fieldIndex: number; draft: SettingsDraft}
  | {type: 'addRepo'; fieldIndex: number; draft: AddRepoDraft}
  | {type: 'confirm'}
  | {type: 'publish'}
  | {type: 'deployments'; index: number}
  | {type: 'error'; message: string};

interface SettingsDraft {
  runAction: RunAction;
  releaseTag: string;
  awsProfile: string;
  extraSshCidrs: string;
  remoteRef: string;
  cleanupMode: CleanupMode;
}

interface AddRepoDraft {
  id: string;
  name: string;
  workload_repo_url: string;
  description: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(value, max));
}

function truncateText(value: string, maxWidth: number): string {
  if (maxWidth <= 0) {
    return '';
  }
  if (value.length <= maxWidth) {
    return value;
  }
  if (maxWidth === 1) {
    return value[0] ?? '';
  }
  return `${value.slice(0, maxWidth - 1)}…`;
}

function progressBar(done: number, total: number, width = 16): string {
  const safeTotal = Math.max(total, 1);
  const filled = Math.round((done / safeTotal) * width);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(width - filled, 0))}`;
}

function statusGlyph(status: StageRuntimeState['status']): string {
  switch (status) {
    case 'succeeded':
      return '●';
    case 'failed':
      return '✕';
    case 'skipped':
      return '·';
    case 'running':
      return '◌';
    default:
      return '○';
  }
}

function cleanupLabel(mode: CleanupMode): string {
  return mode === 'pause' ? 'pause/stop' : 'terminate';
}

function actionLabel(action: RunAction): string {
  return action === 'deploy' ? 'deploy' : 'verify';
}

function methodLabel(repo: RepoDefinition, methodId: string): string {
  return repo.methods.find((method) => method.id === methodId)?.label ?? methodId;
}

function fieldFrame(label: string, value: string, active: boolean, width: number): React.JSX.Element {
  return (
    <Box>
      <Text color={active ? 'cyan' : 'gray'}>{active ? '› ' : '  '}</Text>
      <Text color="white">{label}: </Text>
      <Text color={active ? 'cyan' : 'gray'}>{truncateText(value || ' ', width)}</Text>
    </Box>
  );
}

function ModalFrame({title, width, children}: {title: string; width: number; children: React.ReactNode}): React.JSX.Element {
  return (
    <Box marginTop={1} justifyContent="center">
      <Box borderStyle="round" borderColor="cyan" width={width} flexDirection="column" paddingX={1} paddingY={1}>
        <Text color="cyan">{title}</Text>
        <Box marginTop={1} flexDirection="column">
          {children}
        </Box>
      </Box>
    </Box>
  );
}

export function App({repoRoot, repos: initialRepos, defaults}: AppProps): React.JSX.Element {
  const {exit} = useApp();
  const [repos, setRepos] = useState(initialRepos);
  const [selectedRepoIndex, setSelectedRepoIndex] = useState(0);
  const [selectedMethodByRepo, setSelectedMethodByRepo] = useState<Record<string, string>>(
    Object.fromEntries(initialRepos.map((repo) => [repo.id, repo.methods[0]?.id ?? ''])),
  );
  const [awsProfiles] = useState<string[]>(readAwsProfiles());
  const [releaseTags, setReleaseTags] = useState<GithubReleaseInfo[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [message, setMessage] = useState('Ready. Review the target, then press r to run with confirmation.');
  const [modal, setModal] = useState<ModalState>({type: 'none'});
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [stageStates, setStageStates] = useState<StageRuntimeState[]>([]);
  const [deployments, setDeployments] = useState<ManagedInstanceRecord[]>([]);
  const [focusPane, setFocusPane] = useState<FocusPane>('repos');
  const [repoScroll, setRepoScroll] = useState(0);
  const [stageScroll, setStageScroll] = useState(0);
  const [logScroll, setLogScroll] = useState(0);
  const [settings, setSettings] = useState<RunSettings>({
    runAction: defaults.runAction ?? 'verify',
    awsProfile: defaults.awsProfile ?? (readAwsProfiles()[0] ?? 'ztbrowser'),
    releaseTag: defaults.releaseTag ?? 'v0.1.3',
    extraSshCidrs: defaults.extraSshCidrs ?? [],
    remoteRef: defaults.remoteRef ?? 'origin/main',
    cleanupMode: defaults.cleanupMode ?? 'terminate',
  });

  const selectedRepo = repos[selectedRepoIndex] ?? repos[0];
  const selectedMethodId = selectedMethodByRepo[selectedRepo?.id ?? ''] ?? selectedRepo?.methods[0]?.id ?? '';
  const selectedMethod = selectedRepo?.methods.find((method) => method.id === selectedMethodId) ?? selectedRepo?.methods[0];

  const columns = process.stdout.columns ?? 120;
  const rows = process.stdout.rows ?? 36;
  const compactVertical = rows <= 28;
  const appWidth = Math.max(72, Math.min(columns - 1, 160));
  const leftWidth = clamp(Math.floor(appWidth * 0.23), 22, 30);
  const centerWidth = clamp(Math.floor(appWidth * 0.41), 32, 52);
  const rightWidth = Math.max(appWidth - leftWidth - centerWidth - 2, 16);
  const headerContentLines = compactVertical ? 1 : 2;
  const footerContentLines = compactVertical ? 1 : 2;
  const verticalGapCount = compactVertical ? 0 : 2;
  const headerHeight = headerContentLines + 2;
  const footerHeight = footerContentLines + 2;
  const paneHeight = Math.max(8, rows - headerHeight - footerHeight - verticalGapCount - 1);
  const repoListHeight = Math.max(2, paneHeight - (compactVertical ? 5 : 7));
  const stageContentHeight = Math.max(4, paneHeight - 4);
  const visibleStageCount = Math.max(2, Math.floor(stageContentHeight / 2));
  const visibleLogCount = Math.max(3, paneHeight - 3);
  const modalWidth = Math.max(60, Math.min(appWidth - 4, 108));
  const compactHeader = truncateText(
    `${selectedRepo?.name ?? 'No repo selected'} │ ${selectedRepo ? methodLabel(selectedRepo, selectedMethodId) : 'n/a'} │ ${actionLabel(settings.runAction)} │ ${settings.releaseTag || 'unset'} │ ${settings.awsProfile} │ ${cleanupLabel(settings.cleanupMode)}`,
    appWidth - 4,
  );

  const previewStages = useMemo(() => {
    if (!selectedRepo || !selectedMethod || selectedMethod.adapter !== 'aws_canonical') {
      return [] as StageRuntimeState[];
    }
    return buildAwsCanonicalStages(
      createAwsCanonicalContext({
        repoRoot,
        selectedRepo,
        selectedMethod,
        stateRoot: stateRootPath(),
        runDir: path.join(stateRootPath(), 'preview'),
        awsProfile: settings.awsProfile,
        runAction: settings.runAction,
        releaseTag: settings.releaseTag,
        extraSshCidrs: settings.extraSshCidrs,
        remoteRef: settings.remoteRef,
        cleanupMode: settings.cleanupMode,
      }),
    ).map((stage) => ({
      id: stage.id,
      title: stage.title,
      description: stage.description,
      status: 'queued' as const,
    }));
  }, [repoRoot, selectedRepo, selectedMethod, settings]);

  const stagePreview = useMemo(() => {
    if (!selectedRepo || !selectedMethod || selectedMethod.adapter !== 'aws_canonical') {
      return [];
    }
    const ctx = createAwsCanonicalContext({
      repoRoot,
      selectedRepo,
      selectedMethod,
      stateRoot: stateRootPath(),
      runDir: path.join(stateRootPath(), 'preview'),
      awsProfile: settings.awsProfile,
      runAction: settings.runAction,
      releaseTag: settings.releaseTag,
      extraSshCidrs: settings.extraSshCidrs,
      remoteRef: settings.remoteRef,
      cleanupMode: settings.cleanupMode,
    });
    return buildAwsCanonicalStages(ctx).flatMap((stage) => stage.preview(ctx).map((line) => `${stage.title}: ${line}`));
  }, [repoRoot, selectedRepo, selectedMethod, settings]);

  const displayStages = stageStates.length > 0 ? stageStates : previewStages;
  const completedCount = displayStages.filter((stage) => ['succeeded', 'failed', 'skipped'].includes(stage.status)).length;
  const visibleRepos = repos.slice(repoScroll, repoScroll + repoListHeight);
  const visibleStages = displayStages.slice(stageScroll, stageScroll + visibleStageCount);
  const maxStageScroll = Math.max(displayStages.length - visibleStageCount, 0);
  const maxLogScroll = Math.max(logs.length - visibleLogCount, 0);
  const boundedLogScroll = clamp(logScroll, 0, maxLogScroll);
  const visibleLogs = (logs.length > 0 ? logs : ['No run output yet. Open confirmation with r to execute the selected deployment.']).slice(
    logs.length > 0 ? boundedLogScroll : 0,
    logs.length > 0 ? boundedLogScroll + visibleLogCount : 1,
  );

  useEffect(() => {
    if (!selectedRepo) {
      return;
    }
    let cancelled = false;
    setLoadingTags(true);
    void fetchGithubReleaseTags(selectedRepo.workload_repo_url)
      .then((tags) => {
        if (cancelled) {
          return;
        }
        setReleaseTags(tags);
      })
      .catch(() => {
        if (!cancelled) {
          setReleaseTags([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingTags(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRepo?.id]);

  useEffect(() => {
    setRepoScroll(clamp(selectedRepoIndex - Math.floor(repoListHeight / 2), 0, Math.max(repos.length - repoListHeight, 0)));
  }, [repoListHeight, repos.length, selectedRepoIndex]);

  useEffect(() => {
    const runningIndex = displayStages.findIndex((stage) => stage.status === 'running');
    if (runningIndex >= 0) {
      setStageScroll(clamp(runningIndex - Math.floor(visibleStageCount / 2), 0, Math.max(displayStages.length - visibleStageCount, 0)));
    } else {
      setStageScroll((current) => clamp(current, 0, Math.max(displayStages.length - visibleStageCount, 0)));
    }
  }, [displayStages, visibleStageCount]);

  useEffect(() => {
    setLogScroll(Math.max(logs.length - visibleLogCount, 0));
  }, [logs.length, visibleLogCount]);

  const startRun = async () => {
    if (!selectedRepo || !selectedMethod) {
      return;
    }
    if (selectedMethod.adapter !== 'aws_canonical') {
      setMessage(`Adapter ${selectedMethod.adapter} is not implemented yet.`);
      return;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const stateRoot = stateRootPath();
    const runDir = path.join(stateRoot, 'runs', timestamp);
    ensureDir(runDir);

    const ctx = createAwsCanonicalContext({
      repoRoot,
      selectedRepo,
      selectedMethod,
      stateRoot,
      runDir,
      awsProfile: settings.awsProfile,
      runAction: settings.runAction,
      releaseTag: settings.releaseTag,
      extraSshCidrs: settings.extraSshCidrs,
      remoteRef: settings.remoteRef,
      cleanupMode: settings.cleanupMode,
    });

    const stages = buildAwsCanonicalStages(ctx);
    setLogs([]);
    setStageStates(
      stages.map((stage) => ({
        id: stage.id,
        title: stage.title,
        description: stage.description,
        status: 'queued',
      })),
    );
    setStageScroll(0);
    setLogScroll(0);
    setIsRunning(true);
    setMessage(`Deploying ${selectedRepo.name} via ${selectedMethod.label}. Logs will be written to ${runDir}.`);
    setModal({type: 'none'});

    const result = await runStages(ctx, stages, {
      onStageState: setStageStates,
      onLogLine: (line) => {
        setLogs((current) => [...current.slice(-799), line]);
      },
    });

    setIsRunning(false);
    if (result.success) {
      const finalHost = result.meta.host ? `host ${result.meta.host}` : 'no host recorded';
      setMessage(`Run succeeded. action=${actionLabel(settings.runAction)} ${finalHost}. cleanup=${cleanupLabel(settings.cleanupMode)}. logs: ${result.meta.runDir}`);
    } else {
      setMessage(`Deployment failed. Inspect the console pane and run log at ${result.meta.runDir}.`);
      setModal({type: 'error', message: result.error?.message ?? 'unknown_error'});
    }
  };

  const refreshDeployments = async () => {
    try {
      const items = await listManagedInstances(repoRoot, settings.awsProfile);
      setDeployments(items);
      setMessage(`Loaded ${items.length} managed deployment${items.length === 1 ? '' : 's'} from AWS.`);
    } catch (error) {
      setMessage(`Failed to load deployments: ${(error as Error).message}`);
      setModal({type: 'error', message: (error as Error).message});
    }
  };

  useInput((input, key) => {
    if (isRunning) {
      if (input === 'q' && !key.ctrl) {
        setMessage('A deployment is in progress. Wait for the run to finish before quitting.');
      }
      return;
    }

    if (modal.type === 'method') {
      const options = selectedRepo?.methods ?? [];
      if (key.escape) {
        setModal({type: 'none'});
      } else if (key.upArrow) {
        setModal((current) => current.type === 'method' ? {type: 'method', index: (current.index - 1 + options.length) % options.length} : current);
      } else if (key.downArrow) {
        setModal((current) => current.type === 'method' ? {type: 'method', index: (current.index + 1) % options.length} : current);
      } else if (key.return && options.length > 0) {
        const picked = options[modal.index];
        setSelectedMethodByRepo((current) => ({...current, [selectedRepo.id]: picked.id}));
        setMessage(`Method set to ${picked.label}.`);
        setModal({type: 'none'});
      }
      return;
    }

    if (modal.type === 'publish') {
      if (key.escape || input === 'n') {
        setModal({type: 'none'});
      } else if (key.return || input === 'y') {
        if (selectedRepo) {
          publishSharedRepo(repoRoot, selectedRepo);
          setRepos((current) => current.map((repo) => (repo.id === selectedRepo.id ? {...repo, source: 'shared'} : repo)));
          setMessage(`Published ${selectedRepo.name} into deploy/catalog.yml for teammates.`);
        }
        setModal({type: 'none'});
      }
      return;
    }

    if (modal.type === 'deployments') {
      if (key.escape) {
        setModal({type: 'none'});
        return;
      }
      if (key.upArrow) {
        setModal((current) =>
          current.type === 'deployments'
            ? {...current, index: clamp(current.index - 1, 0, Math.max(deployments.length - 1, 0))}
            : current,
        );
        return;
      }
      if (key.downArrow) {
        setModal((current) =>
          current.type === 'deployments'
            ? {...current, index: clamp(current.index + 1, 0, Math.max(deployments.length - 1, 0))}
            : current,
        );
        return;
      }
      if (input === 'r') {
        void refreshDeployments();
        return;
      }
      if (input === 'x') {
        const target = deployments[modal.index];
        if (target) {
          void terminateManagedInstance(repoRoot, settings.awsProfile, target.instanceId)
            .then(async () => {
              setMessage(`Terminated ${target.instanceId}.`);
              await refreshDeployments();
            })
            .catch((error) => {
              setModal({type: 'error', message: (error as Error).message});
            });
        }
        return;
      }
      if (input === 's') {
        const target = deployments[modal.index];
        if (target) {
          void stopManagedInstance(repoRoot, settings.awsProfile, target.instanceId)
            .then(async () => {
              setMessage(`Stopped ${target.instanceId}.`);
              await refreshDeployments();
            })
            .catch((error) => {
              setModal({type: 'error', message: (error as Error).message});
            });
        }
        return;
      }
      return;
    }

    if (modal.type === 'confirm') {
      if (key.escape || input === 'n') {
        setModal({type: 'none'});
      } else if (key.return || input === 'y') {
        void startRun();
      }
      return;
    }

    if (modal.type === 'error') {
      if (key.escape || key.return) {
        setModal({type: 'none'});
      }
      return;
    }

    if (modal.type === 'settings') {
      if (key.escape) {
        setModal({type: 'none'});
        return;
      }
      if (key.upArrow) {
        setModal((current) => current.type === 'settings' ? {...current, fieldIndex: Math.max(current.fieldIndex - 1, 0)} : current);
        return;
      }
      if (key.downArrow || key.tab) {
        setModal((current) => current.type === 'settings' ? {...current, fieldIndex: Math.min(current.fieldIndex + 1, 5)} : current);
        return;
      }
      if (key.leftArrow || key.rightArrow) {
        setModal((current) => {
          if (current.type !== 'settings') {
            return current;
          }
          if (current.fieldIndex === 2 && awsProfiles.length > 0) {
            const index = Math.max(awsProfiles.indexOf(current.draft.awsProfile), 0);
            const nextIndex = key.rightArrow ? (index + 1) % awsProfiles.length : (index - 1 + awsProfiles.length) % awsProfiles.length;
            return {...current, draft: {...current.draft, awsProfile: awsProfiles[nextIndex]}};
          }
          if (current.fieldIndex === 0) {
            return {...current, draft: {...current.draft, runAction: current.draft.runAction === 'deploy' ? 'verify' : 'deploy'}};
          }
          if (current.fieldIndex === 5) {
            return {...current, draft: {...current.draft, cleanupMode: current.draft.cleanupMode === 'terminate' ? 'pause' : 'terminate'}};
          }
          return current;
        });
        return;
      }
      if (key.return) {
        if (modal.fieldIndex >= 5) {
          setSettings({
            runAction: modal.draft.runAction,
            releaseTag: modal.draft.releaseTag.trim(),
            awsProfile: modal.draft.awsProfile.trim(),
            extraSshCidrs: modal.draft.extraSshCidrs.split(',').map((value) => value.trim()).filter(Boolean),
            remoteRef: modal.draft.remoteRef.trim(),
            cleanupMode: modal.draft.cleanupMode,
          });
          setMessage('Run settings updated.');
          setModal({type: 'none'});
        } else {
          setModal((current) => current.type === 'settings' ? {...current, fieldIndex: Math.min(current.fieldIndex + 1, 5)} : current);
        }
      }
      return;
    }

    if (modal.type === 'addRepo') {
      if (key.escape) {
        setModal({type: 'none'});
        return;
      }
      if (key.upArrow) {
        setModal((current) => current.type === 'addRepo' ? {...current, fieldIndex: Math.max(current.fieldIndex - 1, 0)} : current);
        return;
      }
      if (key.downArrow || key.tab) {
        setModal((current) => current.type === 'addRepo' ? {...current, fieldIndex: Math.min(current.fieldIndex + 1, 3)} : current);
        return;
      }
      if (key.return) {
        if (modal.fieldIndex >= 3) {
          const repo: RepoDefinition = {
            id: modal.draft.id.trim(),
            name: modal.draft.name.trim(),
            workload_repo_url: modal.draft.workload_repo_url.trim(),
            description: modal.draft.description.trim(),
            release_source: {type: 'github_releases'},
            orchestration_repo_root: 'auto',
            source: 'local',
            methods: [
              {
                id: 'aws_canonical',
                label: 'AWS Canonical Nitro',
                adapter: 'aws_canonical',
                status: 'active',
                description: 'Use the AWS CLI Nitro automation in this repo.',
                defaults: {
                  aws_profile: settings.awsProfile,
                  release_tag: settings.releaseTag,
                  remote_ref: settings.remoteRef,
                  cleanup_mode: settings.cleanupMode,
                },
              },
            ],
          };
          saveLocalRepo(repo);
          const nextRepos = [...repos, repo].sort((a, b) => a.name.localeCompare(b.name));
          setRepos(nextRepos);
          setSelectedRepoIndex(nextRepos.findIndex((entry) => entry.id === repo.id));
          setSelectedMethodByRepo((current) => ({...current, [repo.id]: 'aws_canonical'}));
          setMessage(`Added ${repo.name} to ${path.join(os.homedir(), '.config', 'ztdeploy', 'config.yml')}.`);
          setModal({type: 'none'});
        } else {
          setModal((current) => current.type === 'addRepo' ? {...current, fieldIndex: Math.min(current.fieldIndex + 1, 3)} : current);
        }
      }
      return;
    }

    if (key.tab) {
      setFocusPane((current) => (current === 'repos' ? 'stages' : current === 'stages' ? 'logs' : 'repos'));
      return;
    }
    if (key.upArrow) {
      if (focusPane === 'repos') {
        setSelectedRepoIndex((current) => (current - 1 + repos.length) % repos.length);
      } else if (focusPane === 'stages') {
        setStageScroll((current) => clamp(current - 1, 0, maxStageScroll));
      } else {
        setLogScroll((current) => clamp(current - 1, 0, maxLogScroll));
      }
      return;
    }
    if (key.downArrow) {
      if (focusPane === 'repos') {
        setSelectedRepoIndex((current) => (current + 1) % repos.length);
      } else if (focusPane === 'stages') {
        setStageScroll((current) => clamp(current + 1, 0, maxStageScroll));
      } else {
        setLogScroll((current) => clamp(current + 1, 0, maxLogScroll));
      }
      return;
    }
    if (input === 'j') {
      if (focusPane === 'stages') {
        setStageScroll((current) => clamp(current + 1, 0, maxStageScroll));
      } else if (focusPane === 'logs') {
        setLogScroll((current) => clamp(current + 1, 0, maxLogScroll));
      }
      return;
    }
    if (input === 'k') {
      if (focusPane === 'stages') {
        setStageScroll((current) => clamp(current - 1, 0, maxStageScroll));
      } else if (focusPane === 'logs') {
        setLogScroll((current) => clamp(current - 1, 0, maxLogScroll));
      }
      return;
    }
    if (input === 'm') {
      const currentIndex = selectedRepo?.methods.findIndex((method) => method.id === selectedMethodId) ?? 0;
      setModal({type: 'method', index: Math.max(currentIndex, 0)});
      return;
    }
    if (input === 'e') {
      setModal({
        type: 'settings',
        fieldIndex: 0,
        draft: {
          runAction: settings.runAction,
          releaseTag: settings.releaseTag,
          awsProfile: settings.awsProfile,
          extraSshCidrs: settings.extraSshCidrs.join(', '),
          remoteRef: settings.remoteRef,
          cleanupMode: settings.cleanupMode,
        },
      });
      return;
    }
    if (input === 'a') {
      setModal({
        type: 'addRepo',
        fieldIndex: 0,
        draft: {
          id: '',
          name: '',
          workload_repo_url: 'https://github.com/rusyaew/ztinfra-enclaveproducedhtml',
          description: '',
        },
      });
      return;
    }
    if (input === 'u' && selectedRepo?.source === 'local') {
      setModal({type: 'publish'});
      return;
    }
    if (input === 'd') {
      void refreshDeployments().then(() => {
        setModal({type: 'deployments', index: 0});
      });
      return;
    }
    if (input === 'c') {
      setSettings((current) => ({...current, cleanupMode: current.cleanupMode === 'terminate' ? 'pause' : 'terminate'}));
      return;
    }
    if (input === 'o') {
      setSettings((current) => ({...current, runAction: current.runAction === 'deploy' ? 'verify' : 'deploy'}));
      return;
    }
    if (input === 'p' && awsProfiles.length > 0) {
      setSettings((current) => {
        const index = Math.max(awsProfiles.indexOf(current.awsProfile), 0);
        return {...current, awsProfile: awsProfiles[(index + 1) % awsProfiles.length]};
      });
      return;
    }
    if (input === 't' && releaseTags.length > 0) {
      setSettings((current) => {
        const index = Math.max(releaseTags.findIndex((tag) => tag.tag === current.releaseTag), 0);
        return {...current, releaseTag: releaseTags[(index + 1) % releaseTags.length]?.tag ?? current.releaseTag};
      });
      return;
    }
    if (input === 'r') {
      setModal({type: 'confirm'});
      return;
    }
    if (input === 'q') {
      exit();
    }
  });

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" paddingX={1} width={appWidth} flexDirection="column">
        {compactVertical ? (
          <Box>
            <Text color="cyan">ztdeploy</Text>
            <Text color="gray">  │  </Text>
            <Text color="white">{compactHeader}</Text>
          </Box>
        ) : (
          <>
            <Box>
              <Text color="cyan">ztdeploy</Text>
              <Text color="gray">  │  </Text>
              <Text color="white">{truncateText(selectedRepo?.name ?? 'No repo selected', appWidth - 16)}</Text>
            </Box>
            <Box>
              <Text color="cyan">method</Text>
              <Text color="white"> {truncateText(selectedRepo ? methodLabel(selectedRepo, selectedMethodId) : 'n/a', 18)}</Text>
              <Text color="gray">  │  </Text>
              <Text color="cyan">action</Text>
              <Text color="white"> {actionLabel(settings.runAction)}</Text>
              <Text color="gray">  │  </Text>
              <Text color="cyan">release</Text>
              <Text color="white"> {truncateText(settings.releaseTag || 'unset', 12)}</Text>
              <Text color="gray">  │  </Text>
              <Text color="cyan">aws</Text>
              <Text color="white"> {truncateText(settings.awsProfile, 12)}</Text>
              <Text color="gray">  │  </Text>
              <Text color="cyan">cleanup</Text>
              <Text color="white"> {cleanupLabel(settings.cleanupMode)}</Text>
            </Box>
          </>
        )}
      </Box>

      <Box marginTop={compactVertical ? 0 : 1} width={appWidth}>
        <Box width={leftWidth} height={paneHeight} marginRight={1} borderStyle="round" borderColor={focusPane === 'repos' ? 'cyan' : 'blue'} flexDirection="column" paddingX={1}>
          <Text color={focusPane === 'repos' ? 'cyan' : 'blue'}>Deployment Repos</Text>
          <Box marginTop={1} flexDirection="column">
            {visibleRepos.map((repo) => {
              const index = repos.findIndex((entry) => entry.id === repo.id);
              return (
                <Box key={repo.id}>
                  <Text color={index === selectedRepoIndex ? 'cyan' : 'gray'}>{index === selectedRepoIndex ? '› ' : '  '}</Text>
                  <Text color={index === selectedRepoIndex ? 'white' : 'gray'}>{truncateText(repo.name, leftWidth - 10)}</Text>
                  <Text color="gray">{repo.source === 'local' ? ' [local]' : ''}</Text>
                </Box>
              );
            })}
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">{truncateText(selectedRepo?.description ?? '', leftWidth - 4)}</Text>
            <Text color="gray">repo: {truncateText(selectedRepo?.workload_repo_url ?? '', leftWidth - 10)}</Text>
            <Text color="gray">view {repoScroll + 1}-{Math.min(repoScroll + visibleRepos.length, repos.length)} / {repos.length}</Text>
          </Box>
        </Box>

        <Box width={centerWidth} height={paneHeight} marginRight={1} borderStyle="round" borderColor={focusPane === 'stages' ? 'cyan' : 'magenta'} flexDirection="column" paddingX={1}>
          <Text color={focusPane === 'stages' ? 'cyan' : 'magenta'}>Stages</Text>
          <Box marginTop={1} flexDirection="column">
            <Text color="white">{progressBar(completedCount, Math.max(displayStages.length, 1))} {completedCount}/{Math.max(displayStages.length, 1)}</Text>
            <Text color="gray">{isRunning ? 'Run active' : 'Awaiting confirmation'} · tags {loadingTags ? 'syncing' : releaseTags.length > 0 ? releaseTags.length : 'manual'}</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {visibleStages.map((stage) => (
              <Box key={stage.id}>
                <Box width={3}>
                  {stage.status === 'running' ? (
                    <Text color="yellow"><Spinner type="dots" /></Text>
                  ) : (
                    <Text color={stage.status === 'succeeded' ? 'green' : stage.status === 'failed' ? 'red' : stage.status === 'skipped' ? 'gray' : 'white'}>
                      {statusGlyph(stage.status)}
                    </Text>
                  )}
                </Box>
                <Box flexDirection="column">
                  <Text color="white">{truncateText(stage.title, centerWidth - 8)}</Text>
                  <Text color="gray">{truncateText(stage.description, centerWidth - 8)}</Text>
                </Box>
              </Box>
            ))}
            <Text color="gray">view {displayStages.length === 0 ? 0 : stageScroll + 1}-{Math.min(stageScroll + visibleStages.length, displayStages.length)} / {displayStages.length}</Text>
          </Box>
        </Box>

        <Box width={rightWidth} height={paneHeight} borderStyle="round" borderColor={focusPane === 'logs' ? 'cyan' : 'green'} flexDirection="column" paddingX={1}>
          <Text color={focusPane === 'logs' ? 'cyan' : 'green'}>Live Console</Text>
          <Box marginTop={1} flexDirection="column">
            {visibleLogs.map((line, index) => (
              <Text key={`${index}-${line}`} color="gray">{truncateText(line, rightWidth - 4)}</Text>
            ))}
            {logs.length > 0 && (
              <Text color="gray">view {boundedLogScroll + 1}-{Math.min(boundedLogScroll + visibleLogs.length, logs.length)} / {logs.length}</Text>
            )}
          </Box>
        </Box>
      </Box>

      <Box marginTop={compactVertical ? 0 : 1} borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column" width={appWidth}>
        <Text color="white">{truncateText(message, appWidth - 4)}</Text>
        {!compactVertical && (
          <Text color="gray">tab pane  ↑/↓ move  j/k scroll  m method  e settings  d deployments  a add repo  u publish  o action  t tag  p profile  c cleanup  r run  q quit</Text>
        )}
      </Box>

      {modal.type === 'method' && selectedRepo && (
        <ModalFrame title={`Method ▾  ${selectedRepo.name}`} width={modalWidth}>
          {selectedRepo.methods.map((method, index) => (
            <Box key={method.id}>
              <Text color={index === modal.index ? 'cyan' : 'gray'}>{index === modal.index ? '› ' : '  '}</Text>
              <Text color={index === modal.index ? 'white' : 'gray'}>{truncateText(method.label, modalWidth - 16)}</Text>
              <Text color="gray">  {method.status}</Text>
            </Box>
          ))}
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">{truncateText(selectedRepo.methods[modal.index]?.description ?? '', modalWidth - 4)}</Text>
            <Text color="gray">Enter to select · Esc to close</Text>
          </Box>
        </ModalFrame>
      )}

      {modal.type === 'settings' && (
        <ModalFrame title="Run Settings" width={modalWidth}>
          {fieldFrame('Action', actionLabel(modal.draft.runAction), modal.fieldIndex === 0, modalWidth - 16)}
          {fieldFrame('Release Tag', modal.fieldIndex === 1 ? '' : modal.draft.releaseTag, modal.fieldIndex === 1, modalWidth - 16)}
          {modal.fieldIndex === 1 && <TextInput value={modal.draft.releaseTag} onChange={(value) => setModal((current) => current.type === 'settings' ? {...current, draft: {...current.draft, releaseTag: value}} : current)} />}
          {fieldFrame('AWS Profile', modal.draft.awsProfile, modal.fieldIndex === 2, modalWidth - 16)}
          {fieldFrame('Extra SSH CIDRs', modal.fieldIndex === 3 ? '' : modal.draft.extraSshCidrs, modal.fieldIndex === 3, modalWidth - 20)}
          {modal.fieldIndex === 3 && <TextInput value={modal.draft.extraSshCidrs} onChange={(value) => setModal((current) => current.type === 'settings' ? {...current, draft: {...current.draft, extraSshCidrs: value}} : current)} />}
          {fieldFrame('Remote Ref', modal.fieldIndex === 4 ? '' : modal.draft.remoteRef, modal.fieldIndex === 4, modalWidth - 16)}
          {modal.fieldIndex === 4 && <TextInput value={modal.draft.remoteRef} onChange={(value) => setModal((current) => current.type === 'settings' ? {...current, draft: {...current.draft, remoteRef: value}} : current)} />}
          {fieldFrame('Cleanup', cleanupLabel(modal.draft.cleanupMode), modal.fieldIndex === 5, modalWidth - 16)}
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">Up/down or Tab moves fields. Left/right cycles action, profile, or cleanup. Enter saves on the last field.</Text>
          </Box>
        </ModalFrame>
      )}

      {modal.type === 'addRepo' && (
        <ModalFrame title="Add Deployment Repo" width={modalWidth}>
          {fieldFrame('Repo ID', modal.fieldIndex === 0 ? '' : modal.draft.id, modal.fieldIndex === 0, modalWidth - 16)}
          {modal.fieldIndex === 0 && <TextInput value={modal.draft.id} onChange={(value) => setModal((current) => current.type === 'addRepo' ? {...current, draft: {...current.draft, id: value}} : current)} />}
          {fieldFrame('Display Name', modal.fieldIndex === 1 ? '' : modal.draft.name, modal.fieldIndex === 1, modalWidth - 16)}
          {modal.fieldIndex === 1 && <TextInput value={modal.draft.name} onChange={(value) => setModal((current) => current.type === 'addRepo' ? {...current, draft: {...current.draft, name: value}} : current)} />}
          {fieldFrame('Workload Repo URL', modal.fieldIndex === 2 ? '' : modal.draft.workload_repo_url, modal.fieldIndex === 2, modalWidth - 22)}
          {modal.fieldIndex === 2 && <TextInput value={modal.draft.workload_repo_url} onChange={(value) => setModal((current) => current.type === 'addRepo' ? {...current, draft: {...current.draft, workload_repo_url: value}} : current)} />}
          {fieldFrame('Description', modal.fieldIndex === 3 ? '' : modal.draft.description, modal.fieldIndex === 3, modalWidth - 16)}
          {modal.fieldIndex === 3 && <TextInput value={modal.draft.description} onChange={(value) => setModal((current) => current.type === 'addRepo' ? {...current, draft: {...current.draft, description: value}} : current)} />}
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">The new repo is stored in ~/.config/ztdeploy/config.yml and inherits the AWS canonical method.</Text>
          </Box>
        </ModalFrame>
      )}

      {modal.type === 'confirm' && selectedRepo && selectedMethod && (
        <ModalFrame title="Run Confirmation" width={modalWidth}>
          <Text color="white">repo: {selectedRepo.name}</Text>
          <Text color="white">method: {selectedMethod.label}</Text>
          <Text color="white">action: {actionLabel(settings.runAction)}</Text>
          <Text color="white">release: {settings.releaseTag}</Text>
          <Text color="white">aws profile: {settings.awsProfile}</Text>
          <Text color="white">cleanup: {cleanupLabel(settings.cleanupMode)}</Text>
          <Text color="white">remote ref: {settings.remoteRef}</Text>
          <Box marginTop={1} flexDirection="column">
            {stagePreview.slice(0, 8).map((line) => (
              <Text key={line} color="gray">{truncateText(line, modalWidth - 4)}</Text>
            ))}
            {stagePreview.length > 8 && <Text color="gray">… {stagePreview.length - 8} more command previews</Text>}
          </Box>
          <Box marginTop={1}><Text color="gray">Enter/y to execute · Esc/n to cancel</Text></Box>
        </ModalFrame>
      )}

      {modal.type === 'publish' && selectedRepo && (
        <ModalFrame title="Publish Shared Repo Entry" width={modalWidth}>
          <Text color="white">{selectedRepo.name}</Text>
          <Text color="gray">This writes the selected local repo into deploy/catalog.yml for teammates.</Text>
          <Text color="gray">Enter/y to publish · Esc/n to cancel</Text>
        </ModalFrame>
      )}

      {modal.type === 'deployments' && (
        <ModalFrame title="Managed Deployments" width={modalWidth}>
          {deployments.length === 0 ? (
            <Text color="gray">No managed deployments found for this AWS profile.</Text>
          ) : (
            deployments.map((deployment, index) => (
              <Box key={deployment.instanceId} flexDirection="column">
                <Text color={index === modal.index ? 'cyan' : 'white'}>
                  {index === modal.index ? '› ' : '  '}
                  {truncateText(`${deployment.instanceId}  ${deployment.state}  ${deployment.publicIp}`, modalWidth - 6)}
                </Text>
                <Text color="gray">{truncateText(`${deployment.publicDns}  ${deployment.launchTime}`, modalWidth - 6)}</Text>
              </Box>
            ))
          )}
          <Box marginTop={1} flexDirection="column">
            <Text color="gray">↑/↓ select  r refresh  x terminate  s stop  Esc close</Text>
          </Box>
        </ModalFrame>
      )}

      {modal.type === 'error' && (
        <ModalFrame title="Run Failed" width={modalWidth}>
          <Text color="red">{truncateText(modal.message, modalWidth - 4)}</Text>
          <Text color="gray">Full stdout/stderr remains in the console pane and the persisted run log.</Text>
          <Text color="gray">Esc or Enter closes this dialog.</Text>
        </ModalFrame>
      )}
    </Box>
  );
}
