import type {RuntimeContext, StageDefinition} from '../types.js';
import {buildAwsCanonicalStages, createAwsCanonicalContext} from './awsCanonical.js';
import {buildAwsCocoSnpStages, createAwsCocoSnpContext} from './awsCocoSnp.js';

export type AdapterContextInput = Parameters<typeof createAwsCanonicalContext>[0];

interface AdapterDefinition {
  createContext: (base: AdapterContextInput) => RuntimeContext;
  buildStages: (ctx: RuntimeContext) => StageDefinition[];
}

const ADAPTERS: Record<string, AdapterDefinition> = {
  aws_canonical: {
    createContext: createAwsCanonicalContext,
    buildStages: buildAwsCanonicalStages,
  },
  aws_coco_snp: {
    createContext: createAwsCocoSnpContext,
    buildStages: buildAwsCocoSnpStages,
  },
};

export function getAdapter(adapterId: string): AdapterDefinition | undefined {
  return ADAPTERS[adapterId];
}
