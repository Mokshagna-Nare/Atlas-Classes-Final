// Small client for the Questions generator service. The service URL is
// set with VITE_QUESTIONS_GENERATOR_API; AI keys stay on that server.
import { supabase } from '../../../../../services/supabase';

// Default = Google Cloud Run (2 GiB; see qpg-service/deploy-cloud-run.sh).
// Backup: Render, still deployed from render.yaml. To roll back, set this to
// RENDER_SERVICE_URL (or set VITE_QUESTIONS_GENERATOR_API on the hosting).
const CLOUD_RUN_SERVICE_URL = 'https://atlas-questions-generator-1056168822660.us-central1.run.app';
export const RENDER_SERVICE_URL = 'https://atlas-questions-generator.onrender.com';
const DEFAULT_SERVICE_URL = CLOUD_RUN_SERVICE_URL;

export const QG_API_URL = (
  (import.meta as any).env?.VITE_QUESTIONS_GENERATOR_API || DEFAULT_SERVICE_URL
).replace(/\/+$/, '');

export class QGError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const accessToken = async (): Promise<string> => {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
  } catch {
    // fall back to the token the admin panel stored at login
  }
  return localStorage.getItem('atlas-token') || '';
};

type RequestOptions = {
  method?: 'GET' | 'POST';
  json?: unknown;
  form?: FormData;
  signal?: AbortSignal;
};

// Slow steps run as background jobs on the service (see qpg-service/boot.py):
// the request returns at once with a job id and the panel polls for the
// result with short requests, so no request is ever held open long enough
// for a gateway to answer 502/504.
const ASYNC_PATHS = [
  '/generate/prepare',
  '/generate/page',
  '/generate/finalize',
  '/extract/prepare',
  '/extract/page',
  '/docx',
  '/bank-format',
];
const POLL_MS = 3000;
// How long to keep retrying while the service is restarting, redeploying or
// waking up (gateway 502/503/504 or no connection at all).
const MAX_UNAVAILABLE_MS = 4 * 60 * 1000;
const MAX_JOB_MS = 60 * 60 * 1000;
const MAX_RESUBMITS = 2;

const UNREACHABLE_MESSAGE =
  "Couldn't reach the Questions generator service. If it was idle it may be waking up — wait a minute and try again.";

// A "come back shortly" answer: no connection, a gateway error while the
// service restarts, or the service's own "starting up" reply. A 503 the
// app itself sends with a JSON reason (e.g. out of memory) is a real answer
// and is shown, not retried.
const isTemporarilyUnavailable = (response: Response | null) => {
  if (!response) return true;
  if (response.status === 502 || response.status === 504) return true;
  if (response.status === 503) {
    const json = (response.headers.get('Content-Type') || '').includes('application/json');
    return Boolean(response.headers.get('Retry-After')) || !json;
  }
  return false;
};

const fetchRetrying = async (url: string, init: () => Promise<RequestInit>, signal?: AbortSignal): Promise<Response> => {
  const started = Date.now();
  let delay = 3000;

  for (;;) {
    let response: Response | null = null;

    try {
      response = await fetch(url, await init());
    } catch (error: any) {
      if (error?.name === 'AbortError') throw error;
      response = null;
    }

    if (!isTemporarilyUnavailable(response)) return response!;

    if (Date.now() - started > MAX_UNAVAILABLE_MS) {
      if (response) return response;
      throw new QGError(UNREACHABLE_MESSAGE, 0);
    }

    await sleep(delay, signal);
    delay = Math.min(Math.round(delay * 1.5), 20000);
  }
};

const waitForJob = async (
  submitted: Response,
  resubmit: () => Promise<Response>,
  authHeaders: () => Promise<Record<string, string>>,
  signal?: AbortSignal,
): Promise<Response> => {
  let job: string = (await submitted.json()).job;
  let resubmits = 0;
  const started = Date.now();

  for (;;) {
    await sleep(POLL_MS, signal);
    const poll = await fetchRetrying(
      `${QG_API_URL}/jobs/${encodeURIComponent(job)}`,
      async () => ({ method: 'GET', headers: await authHeaders(), signal }),
      signal,
    );

    if (poll.status === 404 && resubmits < MAX_RESUBMITS) {
      // The job was lost (the service restarted): send the request again.
      resubmits++;
      const again = await resubmit();
      if (again.status !== 202) return again;
      job = (await again.json()).job;
      continue;
    }

    if (poll.ok && poll.headers.get('X-QG-Job-Status') === 'running') {
      if (Date.now() - started > MAX_JOB_MS) {
        throw new QGError('This step is taking unusually long on the server. Please try again.', 504);
      }
      continue;
    }

    return poll; // the job's own response (success or error)
  }
};

const request = async (path: string, options: RequestOptions = {}): Promise<Response> => {
  let body: BodyInit | undefined;
  const contentHeaders: Record<string, string> = {};

  if (options.json !== undefined) {
    contentHeaders['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  } else if (options.form) {
    body = options.form;
  }

  const method = options.method || (body ? 'POST' : 'GET');
  const isAsync = method === 'POST' && ASYNC_PATHS.includes(path);
  const url = `${QG_API_URL}${path}`;
  const authHeaders = async () => ({ Authorization: `Bearer ${await accessToken()}` });
  const init = async (): Promise<RequestInit> => ({
    method,
    headers: { ...(await authHeaders()), ...contentHeaders, ...(isAsync ? { 'X-QG-Async': '1' } : {}) },
    body,
    signal: options.signal,
  });

  let response = await fetchRetrying(url, init, options.signal);

  if (isAsync && response.status === 202) {
    response = await waitForJob(response, () => fetchRetrying(url, init, options.signal), authHeaders, options.signal);
  }

  if (!response.ok) {
    if (isTemporarilyUnavailable(response)) throw new QGError(UNREACHABLE_MESSAGE, response.status);
    let message = `The Questions generator service returned an error (${response.status}).`;
    try {
      const data = await response.json();
      if (typeof data?.detail === 'string') message = data.detail;
      else if (Array.isArray(data?.detail)) message = data.detail.map((d: any) => d?.msg).filter(Boolean).join('; ') || message;
    } catch {
      // keep the generic message
    }
    throw new QGError(message, response.status);
  }

  return response;
};

export const qgJson = async <T,>(path: string, options: RequestOptions = {}): Promise<T> =>
  (await request(path, options)).json() as Promise<T>;

export const qgBlob = async (path: string, options: RequestOptions = {}) => {
  const response = await request(path, options);
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  return { blob: await response.blob(), fileName: match ? match[1] : 'Question_Bank.docx' };
};

export const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
