import React from 'react';

// Small building blocks in the admin panel's existing dark/green style.

export const Card: React.FC<{ title?: string; children: React.ReactNode; className?: string }> = ({ title, children, className }) => (
  <div className={`bg-gray-800/40 border border-gray-700/80 rounded-2xl p-5 ${className || ''}`}>
    {title && <h3 className="text-[13px] font-extrabold text-gray-300 uppercase tracking-widest mb-4">{title}</h3>}
    {children}
  </div>
);

export const Label: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1.5 ml-0.5" title={hint}>
    {children}
  </label>
);

const fieldClass =
  'w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-xl text-sm text-white focus:border-green-500 outline-none transition-colors disabled:opacity-50';

export const Select: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
  optionLabel?: (value: string) => string;
}> = ({ label, value, options, onChange, disabled, hint, optionLabel }) => (
  <div>
    <Label hint={hint}>{label}</Label>
    <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={fieldClass}>
      {options.map((option) => (
        <option key={option} value={option}>
          {optionLabel ? optionLabel(option) : option}
        </option>
      ))}
    </select>
  </div>
);

export const TextInput: React.FC<{
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
  min?: number;
  max?: number;
}> = ({ label, value, onChange, placeholder, disabled, type = 'text', min, max }) => (
  <div>
    <Label>{label}</Label>
    <input
      type={type}
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={fieldClass}
    />
  </div>
);

export const TextArea: React.FC<{ label: string; value: string; onChange: (value: string) => void; rows?: number }> = ({ label, value, onChange, rows = 3 }) => (
  <div>
    <Label>{label}</Label>
    <textarea value={value} rows={rows} onChange={(e) => onChange(e.target.value)} className={`${fieldClass} resize-y`} />
  </div>
);

export const Checkbox: React.FC<{ label: React.ReactNode; checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }> = ({ label, checked, onChange, disabled }) => (
  <label className={`flex items-start gap-2.5 text-sm text-gray-300 select-none ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-green-500 shrink-0" />
    <span>{label}</span>
  </label>
);

const noticeStyles = {
  info: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
  success: 'bg-green-500/10 border-green-500/30 text-green-300',
  warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
  error: 'bg-red-500/10 border-red-500/30 text-red-300',
};

export const Notice: React.FC<{ kind?: keyof typeof noticeStyles; children: React.ReactNode }> = ({ kind = 'info', children }) => (
  <div className={`border rounded-xl px-4 py-3 text-sm ${noticeStyles[kind]}`}>{children}</div>
);

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...props }) => (
  <button
    {...props}
    className={`px-5 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors shadow-lg shadow-green-900/20 ${className || ''}`}
  >
    {children}
  </button>
);

export const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, children, ...props }) => (
  <button
    {...props}
    className={`px-4 py-2.5 rounded-xl font-bold text-gray-200 bg-gray-800 border border-gray-700 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${className || ''}`}
  >
    {children}
  </button>
);

export const ProgressBar: React.FC<{ value: number; text?: string }> = ({ value, text }) => (
  <div>
    {text && <p className="text-sm text-gray-300 mb-2">{text}</p>}
    <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
      <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} />
    </div>
  </div>
);

export const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }> = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
    <div
      className={`w-full ${wide ? 'max-w-5xl' : 'max-w-2xl'} max-h-[92vh] flex flex-col bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
        <h3 className="text-lg font-bold text-white">{title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none" aria-label="Close">
          ×
        </button>
      </div>
      <div className="overflow-y-auto p-6 custom-scrollbar">{children}</div>
    </div>
  </div>
);
