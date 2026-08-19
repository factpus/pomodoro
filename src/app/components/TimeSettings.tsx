'use client';

export interface TimeSettingsValue {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
}

interface Props { value: TimeSettingsValue; onChange: (value: TimeSettingsValue) => void }

const presets: Array<{ label: string; value: TimeSettingsValue }> = [
  { label: '標準 25/5', value: { focusMinutes: 25, shortBreakMinutes: 5, longBreakMinutes: 15, longBreakEvery: 4 } },
  { label: '深い集中 50/10', value: { focusMinutes: 50, shortBreakMinutes: 10, longBreakMinutes: 30, longBreakEvery: 4 } },
  { label: 'ライト 15/3', value: { focusMinutes: 15, shortBreakMinutes: 3, longBreakMinutes: 10, longBreakEvery: 4 } },
];

export default function TimeSettings({ value, onChange }: Props) {
  const field = (key: keyof TimeSettingsValue, next: number) => onChange({ ...value, [key]: next });
  return (
    <fieldset className="space-y-4">
      <legend className="text-sm font-semibold text-slate-200">タイマー設定</legend>
      <div className="flex flex-wrap gap-2" aria-label="プリセット">
        {presets.map((preset) => <button key={preset.label} type="button" onClick={() => onChange(preset.value)} className="chip">{preset.label}</button>)}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <NumberField label="集中" value={value.focusMinutes} min={1} max={180} onChange={(v) => field('focusMinutes', v)} />
        <NumberField label="小休憩" value={value.shortBreakMinutes} min={1} max={60} onChange={(v) => field('shortBreakMinutes', v)} />
        <NumberField label="長休憩" value={value.longBreakMinutes} min={1} max={120} onChange={(v) => field('longBreakMinutes', v)} />
        <NumberField label="長休憩まで" value={value.longBreakEvery} min={2} max={8} unit="回" onChange={(v) => field('longBreakEvery', v)} />
      </div>
    </fieldset>
  );
}

function NumberField({ label, value, min, max, unit = '分', onChange }: { label: string; value: number; min: number; max: number; unit?: string; onChange: (value: number) => void }) {
  return <label className="text-xs text-slate-400">{label}（{unit}）<input className="input mt-1" type="number" value={value} min={min} max={max} required onChange={(event) => onChange(Number(event.target.value))} /></label>;
}
