// Sprint-specific lightweight data contracts (app-facing)

export type CheckinRecord = {
  id: string;
  ts: string; // ISO
  lang: 'tr' | 'en';
  inputType: 'stt' | 'keyboard';
  nlu: { mood: number; trigger: string; confidence: number };
  route: 'REFRAME';
  meta?: { durationSec?: number; wordsCount?: number; sttConfidence?: number };
};

// export type ErpSessionLog = { // Removed ERP
  id: string;
  startedAt: string; // ISO
  endedAt?: string;  // ISO
  trigger: { type: 'time' | 'geo'; id: string };
  steps: { step: 'intention' | 'exposure' | 'response_prevention'; sudsBefore?: number; sudsAfter?: number; durSec?: number }[];
  guardrails?: { type: string; ts: string }[];
  outcome: 'completed' | 'aborted' | 'guardrail_exit';
};


