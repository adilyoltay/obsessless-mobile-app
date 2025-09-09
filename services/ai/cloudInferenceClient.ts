import axios from 'axios'
import Constants from 'expo-constants'

function getEnv(key: string, fallback: string = ''): string {
  try {
    const val = (process.env as any)?.[key] || (process.env as any)?.[`EXPO_PUBLIC_${key}`]
    if (typeof val === 'string' && val.length) return val
  } catch {}
  try {
    const extra = (Constants as any)?.expoConfig?.extra || (Constants as any)?.default?.expoConfig?.extra || {}
    const v = extra?.[key] || extra?.[`EXPO_PUBLIC_${key}`]
    if (typeof v === 'string' && v.length) return v
  } catch {}
  return fallback
}

function float32ToBase64(arr: number[]): string {
  const f32 = new Float32Array(arr)
  const bytes = new Uint8Array(f32.buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return typeof btoa === 'function' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64')
}

type InferenceResp = {
  logits?: number[]
  probs?: number[]
  mood?: number
  energy?: number
  anxiety?: number
  confidence?: number
  request_id?: string
  elapsed_ms?: number
  timestamp?: string
  top_class?: number
  class_labels?: string[]
  input_quality?: any
}

const baseURL = () => getEnv('AI_INFERENCE_URL', getEnv('EXPO_PUBLIC_AI_INFERENCE_URL', ''))
const apiKey = () => getEnv('AI_INFERENCE_KEY', getEnv('EXPO_PUBLIC_AI_INFERENCE_KEY', ''))
const timeout = () => Number(getEnv('AI_INFERENCE_TIMEOUT_MS', getEnv('EXPO_PUBLIC_AI_INFERENCE_TIMEOUT_MS', '8000')))
const verbose = () => (getEnv('EXPO_PUBLIC_AI_VERBOSE_LOGGING', 'false') || '').toString().toLowerCase() === 'true'
const preferredFormat = () => (getEnv('AI_RESPONSE_FORMAT', getEnv('EXPO_PUBLIC_AI_RESPONSE_FORMAT', 'mea')) || '').toLowerCase()

async function inferPatConvL(minuteWindow: number[]): Promise<InferenceResp> {
  const url = baseURL()
  if (!url) throw new Error('AI_INFERENCE_URL is not configured')
  const fixed = validateMinuteWindow(minuteWindow)
  const body = {
    model: 'pat-conv-l',
    input_type: 'minute_window_f32_b64',
    minute_window_b64: float32ToBase64(fixed),
    scaler: 'nhanes_v1',
    response_format: preferredFormat(),
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (apiKey()) headers['x-api-key'] = apiKey()
  const data = await postJson(`${url.replace(/\/$/, '')}/v1/infer`, body, headers, timeout())
  return (data || {}) as InferenceResp
}

async function inferDailyFeatureVector(vec: number[]): Promise<InferenceResp> {
  const url = baseURL()
  if (!url) throw new Error('AI_INFERENCE_URL is not configured')
  const body = {
    model: 'big-mood-detector',
    input_type: 'daily_features_norm01',
    features: vec,
    response_format: preferredFormat(),
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (apiKey()) headers['x-api-key'] = apiKey()
  const data = await postJson(`${url.replace(/\/$/, '')}/v1/infer`, body, headers, timeout())
  return (data || {}) as InferenceResp
}

async function inferMinuteWindowForXgb(minuteWindow: number[]): Promise<InferenceResp> {
  const url = baseURL()
  if (!url) throw new Error('AI_INFERENCE_URL is not configured')
  const fixed = validateMinuteWindow(minuteWindow)
  const body = {
    model: 'big-mood-detector',
    input_type: 'minute_window_f32_b64',
    minute_window_b64: float32ToBase64(fixed),
    response_format: preferredFormat(),
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (apiKey()) headers['x-api-key'] = apiKey()
  const data = await postJson(`${url.replace(/\/$/, '')}/v1/infer`, body, headers, timeout())
  return (data || {}) as InferenceResp
}
async function inferXgbFeatures(features36: number[]): Promise<InferenceResp> {
  const url = baseURL()
  if (!url) throw new Error('AI_INFERENCE_URL is not configured')
  if (!Array.isArray(features36) || features36.length !== 36) {
    throw new Error('xgb_features_v1 requires exactly 36 numeric values')
  }
  const body = {
    model: 'big-mood-detector',
    input_type: 'xgb_features_v1',
    features: features36,
    response_format: preferredFormat(),
  }
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (apiKey()) headers['x-api-key'] = apiKey()
  const data = await postJson(`${url.replace(/\/$/, '')}/v1/infer`, body, headers, timeout())
  return (data || {}) as InferenceResp
}

async function health(): Promise<boolean> {
  try {
    const url = baseURL()
    if (!url) {
      if (verbose()) console.warn('[cloudInference] Missing AI_INFERENCE_URL/EXPO_PUBLIC_AI_INFERENCE_URL')
      return false
    }
    const headers: Record<string, string> = {}
    if (apiKey()) headers['x-api-key'] = apiKey()
    // Health endpoint is served at /health (not /v1/health)
    const full = `${url.replace(/\/$/, '')}/health`
    if (verbose()) console.log('[cloudInference] Health check:', full)
    const resp = await axios.get(full, { headers, timeout: timeout() })
    return !!resp?.data
  } catch (e: any) {
    if (verbose()) console.warn('[cloudInference] Health failed:', e?.message || String(e))
    return false
  }
}

export const cloudInferenceClient = { inferPatConvL, inferDailyFeatureVector, inferXgbFeatures, inferMinuteWindowForXgb, health }

export default cloudInferenceClient

// Utilities
function validateMinuteWindow(input: number[]): number[] {
  const N = 10080
  if (!Array.isArray(input)) throw new Error('minuteWindow must be an array')
  let arr = input.map((v) => (Number.isFinite(Number(v)) ? Number(v) : 0))
  // clamp to [0,1]
  arr = arr.map((v) => (v < 0 ? 0 : v > 1 ? 1 : v))
  if (arr.length === N) return arr
  // auto-fix: trim or pad with mean to avoid depressive bias
  if (arr.length > N) return arr.slice(0, N)
  const mean = arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
  return arr.concat(new Array(N - arr.length).fill(mean))
}

async function postJson(url: string, body: any, headers: Record<string, string>, toMs: number): Promise<any> {
  const tryOnce = async () => {
    const resp = await axios.post(url, body, { headers, timeout: toMs })
    const data = resp?.data || {}
    const h = (resp?.headers || {}) as Record<string, string>
    const reqId = h['x-request-id'] || h['x-requestid'] || h['request-id']
    const dateHdr = h['date']
    if (reqId && typeof data === 'object' && data && !('request_id' in data)) (data as any).request_id = reqId
    if (dateHdr && typeof data === 'object' && data && !('timestamp' in data)) (data as any).timestamp = dateHdr
    return data
  }
  try {
    return await tryOnce()
  } catch (e: any) {
    const status = e?.response?.status
    const hdrs: Record<string, string> = (e?.response?.headers || {})
    let retryAfterMs = 0
    const ra = hdrs?.['retry-after']
    if (ra) {
      const v = Number(ra)
      if (Number.isFinite(v) && v > 0) retryAfterMs = Math.min(5000, v * 1000)
    }
    // retry only for 408/429/5xx
    if (status === 408 || status === 429 || (typeof status === 'number' && status >= 500)) {
      const backoff = retryAfterMs > 0 ? retryAfterMs : Math.min(1200, Math.round(toMs * 0.25))
      await new Promise((r) => setTimeout(r, backoff))
      return await tryOnce()
    }
    throw e
  }
}
