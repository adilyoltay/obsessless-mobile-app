export type InferenceMeta = {
  source: 'heartpy' | string;
  model?: string;
  response_format?: string;
  request_id?: string;
  elapsed_ms?: number;
  timestamp?: string;
  input_quality?: any;
  metrics?: any;
};

let lastMeta: InferenceMeta | null = null;

export function setLastInferenceMeta(meta: InferenceMeta | null): void {
  lastMeta = meta;
}

export function getLastInferenceMeta(): InferenceMeta | null {
  return lastMeta ? { ...lastMeta } : null;
}

export default { setLastInferenceMeta, getLastInferenceMeta };

