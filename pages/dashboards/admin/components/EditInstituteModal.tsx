import React, { useEffect, useMemo, useState } from 'react';
import { Institute } from '../../../../types';
import { useData } from '../../../../contexts/DataContext';
import api from '../../../../services/api';
import { uploadInstituteLogo, generatePassword } from '../../../../utils/uploadInstituteLogo';
import { AdminModal, Field, Svg, ICONS, inputCls, primaryBtn, secondaryBtn, InstituteAvatar } from '../../../../components/ui/admin';

// Add a partner institute, or edit one (name, login email, logo, optional new password).

interface InstituteFormModalProps {
  /** Omit to add a new institute. */
  institute?: Institute;
  onClose: () => void;
  onSaved?: () => void;
}

const InstituteFormModal: React.FC<InstituteFormModalProps> = ({ institute, onClose, onSaved }) => {
  const { refreshInstitutes } = useData();
  const isEdit = Boolean(institute);
  const [name, setName] = useState(institute?.name || '');
  const [email, setEmail] = useState(institute?.email || '');
  const [password, setPassword] = useState(isEdit ? '' : generatePassword());
  const [showPassword, setShowPassword] = useState(!isEdit);
  const [copied, setCopied] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : institute?.logo_url || ''), [logoFile, institute]);
  useEffect(() => () => { if (logoFile) URL.revokeObjectURL(logoPreview); }, [logoFile, logoPreview]);

  const pickLogo = (file?: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return setError('The logo must be an image (PNG, JPG or SVG).');
    setError('');
    setLogoFile(file);
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked; the password is visible to copy by hand */ }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!isEdit && password.length < 8) return setError('Use a password of at least 8 characters.');
    if (isEdit && password && password.length < 8) return setError('A new password needs at least 8 characters.');
    setSaving(true);
    setError('');
    try {
      const logo_url = logoFile ? await uploadInstituteLogo(logoFile) : institute?.logo_url || null;
      if (isEdit) {
        await api.put(`/auth/update-institute/${institute!.id}`, { name: name.trim(), email: email.trim(), password: password || undefined, logo_url });
      } else {
        await api.post('/auth/create-institute', { name: name.trim(), email: email.trim(), password, logo_url });
      }
      await refreshInstitutes();
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Could not save the institute.');
      setSaving(false);
    }
  };

  return (
    <AdminModal
      title={isEdit ? `Edit ${institute!.name}` : 'Add a partner institute'}
      subtitle={isEdit ? 'Update the school profile or reset its login password.' : 'Creates the school profile and its institute login.'}
      icon={isEdit ? ICONS.edit : ICONS.building}
      width="max-w-lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={`${secondaryBtn} px-5 py-2.5 text-sm`} disabled={saving}>Cancel</button>
          <button type="submit" form="institute-form" disabled={saving} className={`${primaryBtn} px-6 py-2.5 text-sm`}>
            {saving ? <><span className="h-4 w-4 rounded-full border-2 border-gray-950/30 border-t-gray-950 animate-spin" /> Saving…</> : isEdit ? 'Save changes' : 'Create institute'}
          </button>
        </>
      }
    >
      <form id="institute-form" onSubmit={submit} className="space-y-5">
        <Field label="Logo" optional>
          <input id="institute-logo" type="file" accept="image/*" className="hidden" onChange={e => pickLogo(e.target.files?.[0])} />
          <label
            htmlFor="institute-logo"
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); pickLogo(e.dataTransfer.files?.[0]); }}
            className={`group flex cursor-pointer items-center gap-4 rounded-2xl border border-dashed p-3.5 transition-all ${dragOver ? 'border-emerald-400/70 bg-emerald-400/[0.06]' : 'border-white/15 bg-black/15 hover:border-emerald-400/40'}`}
          >
            {logoPreview ? (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-paper p-1 ring-1 ring-white/20">
                <img src={logoPreview} alt="" className="keep-original-colors h-full w-full object-contain" />
              </span>
            ) : (
              <InstituteAvatar name={name || 'New institute'} size="lg" />
            )}
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-200">{logoPreview ? 'Replace logo' : 'Upload the school logo'}</span>
              <span className="block text-xs text-gray-500">Drop an image here or click. Square PNGs look best.</span>
            </span>
          </label>
        </Field>

        <Field label="Institute name" required>
          <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Narayana High School" className={inputCls} />
        </Field>

        <Field label="Login email" required>
          <div className="relative">
            <Svg d={ICONS.mail} className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="school@example.com" className={`${inputCls} pl-10`} />
          </div>
        </Field>

        <Field
          label={isEdit ? 'New password' : 'Password'}
          required={!isEdit}
          optional={isEdit}
          hint={
            <button type="button" onClick={() => { setPassword(generatePassword()); setShowPassword(true); }} className="normal-case tracking-normal text-xs font-bold text-emerald-300 hover:text-emerald-200">
              Generate
            </button>
          }
        >
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Svg d={ICONS.key} className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={isEdit ? 'Leave blank to keep the current password' : 'At least 8 characters'}
                autoComplete="new-password"
                className={`${inputCls} pl-10 pr-11 font-mono`}
              />
              <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:text-white">
                <Svg d={showPassword ? 'M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88' : 'M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z'} />
              </button>
            </div>
            {password && (
              <button type="button" onClick={copyPassword} className={`${secondaryBtn} h-11 px-3.5 text-xs`}>
                <Svg d={copied ? ICONS.check : 'M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184'} /> {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          {!isEdit && <p className="text-xs text-gray-500">Share this with the school securely. They can't recover it themselves yet.</p>}
        </Field>

        {error && <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-500/10 p-3 text-sm text-rose-300 ring-1 ring-inset ring-rose-400/25 animate-shake"><Svg d={ICONS.warning} className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>}
      </form>
    </AdminModal>
  );
};

/** Kept for existing imports: edit an institute. */
const EditInstituteModal: React.FC<{ institute: Institute; onClose: () => void }> = ({ institute, onClose }) => (
  <InstituteFormModal institute={institute} onClose={onClose} />
);

export { InstituteFormModal };
export default EditInstituteModal;
