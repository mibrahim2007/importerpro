'use client';

import { useState } from 'react';

interface Pref {
  alertType: string;
  label: string;
  priority: string;
  category: string;
  enabled: boolean;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700 border-red-200',
  high:     'bg-orange-100 text-orange-700 border-orange-200',
  medium:   'bg-amber-100 text-amber-700 border-amber-200',
  info:     'bg-blue-100 text-blue-700 border-blue-200',
};

export function NotificationPreferencesForm({ prefs: initial }: { prefs: Pref[] }) {
  const [prefs, setPrefs] = useState<Pref[]>(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  async function toggle(alertType: string, enabled: boolean) {
    setSaving(alertType);
    setError('');
    setSaved('');
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alertType, enabled }),
      });
      if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Save failed'); }
      setPrefs(prev => prev.map(p => p.alertType === alertType ? { ...p, enabled } : p));
      setSaved(alertType);
      setTimeout(() => setSaved(''), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(null);
    }
  }

  // Group by category
  const categories = Array.from(new Set(prefs.map(p => p.category)));

  return (
    <div className="space-y-6">
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      {categories.map(cat => (
        <div key={cat} className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700">{cat}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {prefs.filter(p => p.category === cat).map(p => (
              <div key={p.alertType} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div>
                    <p className={`text-sm font-medium ${p.enabled ? 'text-slate-800' : 'text-slate-400'}`}>{p.label}</p>
                    <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[p.priority] ?? PRIORITY_COLORS.info}`}>
                      {p.priority.charAt(0).toUpperCase() + p.priority.slice(1)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {saved === p.alertType && (
                    <span className="text-xs text-teal-600 font-medium">Saved</span>
                  )}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={p.enabled}
                    disabled={saving === p.alertType}
                    onClick={() => toggle(p.alertType, !p.enabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50 ${
                      p.enabled ? 'bg-teal-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        p.enabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
        Changes apply immediately. Alerts you disable will not be created during the next Check Alerts scan, but existing unread notifications remain in your inbox.
      </div>
    </div>
  );
}
