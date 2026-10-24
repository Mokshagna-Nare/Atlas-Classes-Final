import React, { useEffect, useState } from 'react';
import { qgJson } from './api';
import { ProviderInfo } from './types';
import { Label, Notice, Select, TextInput } from './ui';

const MANUAL = '__manual__';

// AI provider + model. Keys live on the server, so only providers that
// have a key configured there can be chosen.
const ProviderPicker: React.FC<{
  providers: ProviderInfo[];
  provider: string;
  model: string;
  onChange: (provider: string, model: string) => void;
}> = ({ providers, provider, model, onChange }) => {
  const [models, setModels] = useState<string[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [manual, setManual] = useState(false);
  const configured = providers.filter((p) => p.configured);
  const info = providers.find((p) => p.name === provider);

  useEffect(() => {
    if (!info?.configured) return;
    let cancelled = false;
    setLoading(true);
    setListError(null);
    setManual(false);

    qgJson<{ models: string[]; default: string; error: string | null }>(`/models?provider=${encodeURIComponent(provider)}`)
      .then((data) => {
        if (cancelled) return;
        setModels(data.models);
        setListError(data.error);
        if (!data.models.length) setManual(true);
        if (!model || (data.models.length && !data.models.includes(model))) {
          onChange(provider, data.default || data.models[0] || '');
        }
      })
      .catch((error) => {
        if (cancelled) return;
        setModels([]);
        setListError(error.message);
        setManual(true);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, info?.configured]);

  if (!configured.length) {
    return (
      <Notice kind="warning">
        No AI provider key is configured on the Questions generator server yet. Ask the administrator to set
        ANTHROPIC_API_KEY, AGENTROUTER_API_KEY or OMNIROUTE_API_KEY on the service.
      </Notice>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>AI provider</Label>
        <div className="flex flex-wrap gap-2">
          {providers.map((p) => (
            <button
              key={p.name}
              type="button"
              disabled={!p.configured}
              title={p.configured ? '' : 'No API key is set for this provider on the server'}
              onClick={() => onChange(p.name, '')}
              className={`px-3 py-2 rounded-lg text-sm font-bold border transition-colors ${
                provider === p.name
                  ? 'bg-green-600/20 border-green-500 text-green-300'
                  : 'bg-gray-900 border-gray-700 text-gray-300 hover:border-gray-500'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {p.name}
              {!p.configured && <span className="ml-1 text-[10px] font-normal">(no key)</span>}
            </button>
          ))}
        </div>
      </div>

      {info?.configured &&
        (manual || !models.length ? (
          <TextInput
            label="Model ID"
            value={model}
            onChange={(value) => onChange(provider, value)}
            placeholder={loading ? 'Loading models…' : 'Exact model ID'}
          />
        ) : (
          <Select
            label="Model"
            value={models.includes(model) ? model : models[0]}
            options={[...models, MANUAL]}
            optionLabel={(value) => (value === MANUAL ? 'Type a model ID…' : value)}
            onChange={(value) => (value === MANUAL ? setManual(true) : onChange(provider, value))}
          />
        ))}

      {listError && info?.model_listing && (
        <p className="text-xs text-yellow-400/90">Couldn't load the model list ({listError}). Type the model ID instead.</p>
      )}
    </div>
  );
};

export default ProviderPicker;
