// Small client for the Questions generator service. The service URL is
// set with VITE_QUESTIONS_GENERATOR_API; AI keys stay on that server.
import { supabase } from '../../../../../services/supabase';

// Default = the address Render gives the service from render.yaml.
const DEFAULT_SERVICE_URL = 'https://atlas-questions-generator.onrender.com';

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

const request = async (path: string, options: RequestOptions = {}): Promise<Response> => {
  const headers: Record<string, string> = { Authorization: `Bearer ${await accessToken()}` };
  let body: BodyInit | undefined;

  if (options.json !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  } else if (options.form) {
    body = options.form;
  }

  let response: Response;
  try {
    response = await fetch(`${QG_API_URL}${path}`, {
      method: options.method || (body ? 'POST' : 'GET'),
      headers,
      body,
      signal: options.signal,
    });
  } catch (error: any) {
    if (error?.name === 'AbortError') throw error;
    throw new QGError(
      "Couldn't reach the Questions generator service. If it was idle it may be waking up — wait a minute and try again.",
      0,
    );
  }

  if (!response.ok) {
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
