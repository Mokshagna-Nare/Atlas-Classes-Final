// Institute logos are stored on Cloudinary (unsigned upload preset).
const CLOUD_NAME = 'dj0gekofh';
const UPLOAD_PRESET = 'Institute Logos';

/** Uploads a logo image and returns its public URL. */
export async function uploadInstituteLogo(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', UPLOAD_PRESET);
  form.append('cloud_name', CLOUD_NAME);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: form });
  const data = await res.json();
  const url = data.secure_url || data.url;
  if (!res.ok || !url) throw new Error(data.error?.message || 'The logo could not be uploaded.');
  return url;
}

/** A strong, easy-to-read password (no 0/O, 1/l/I). */
export function generatePassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const symbols = '@#$%&*!';
  const bytes = crypto.getRandomValues(new Uint32Array(length));
  const out = Array.from(bytes, b => chars[b % chars.length]);
  // Guarantee a digit and a symbol.
  out[bytes[0] % length] = String((bytes[1] % 8) + 2);
  out[(bytes[0] + 3) % length] = symbols[bytes[2] % symbols.length];
  return out.join('');
}
