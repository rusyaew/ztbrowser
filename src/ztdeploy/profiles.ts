import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

function extractProfilesFromIni(raw: string, stripProfilePrefix: boolean): string[] {
  const matches = [...raw.matchAll(/^\s*\[([^\]]+)\]\s*$/gm)];
  return matches
    .map((match) => match[1].trim())
    .map((name) => {
      if (stripProfilePrefix && name.startsWith('profile ')) {
        return name.slice('profile '.length);
      }
      return name;
    });
}

export function readAwsProfiles(): string[] {
  const configPath = path.join(os.homedir(), '.aws', 'config');
  const credentialsPath = path.join(os.homedir(), '.aws', 'credentials');
  const names = new Set<string>();

  if (fs.existsSync(configPath)) {
    for (const profile of extractProfilesFromIni(fs.readFileSync(configPath, 'utf8'), true)) {
      names.add(profile);
    }
  }
  if (fs.existsSync(credentialsPath)) {
    for (const profile of extractProfilesFromIni(fs.readFileSync(credentialsPath, 'utf8'), false)) {
      names.add(profile);
    }
  }

  const profiles = [...names].filter(Boolean).sort();
  if (profiles.includes('ztbrowser')) {
    return ['ztbrowser', ...profiles.filter((name) => name !== 'ztbrowser')];
  }
  return profiles;
}
