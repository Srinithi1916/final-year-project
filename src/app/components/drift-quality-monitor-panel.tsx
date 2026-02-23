import React from 'react';
import { Card } from './ui/card';
import { DriftQualityState } from '../utils/drift-quality-monitor';

interface DriftQualityMonitorPanelProps {
  snapshot: DriftQualityState;
}

const statusClasses: Record<string, string> = {
  stable: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  healthy: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  watch: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  degraded: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
  drifted: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
};

const alertClasses: Record<string, string> = {
  info: 'border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50',
  warn: 'border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20',
  critical: 'border-rose-300 bg-rose-50 dark:border-rose-700 dark:bg-rose-900/20',
};

export function DriftQualityMonitorPanel({
  snapshot,
}: DriftQualityMonitorPanelProps) {
  return (
    <Card className="p-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Drift + Data Quality Monitoring</h2>
          <p className="text-sm text-muted-foreground">
            PSI/KS drift checks, input validation, and model quality degradation alerts.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Baseline: {snapshot.baselineReady ? `Ready (${snapshot.baselineSize})` : `Building (${snapshot.baselineSize}/${40})`}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Recent Window</p>
          <p className="text-2xl font-bold">{snapshot.recentSize}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Data Quality</p>
          <p className="text-xl font-semibold">{snapshot.dataQuality.status.toUpperCase()}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Missing {snapshot.dataQuality.missingFieldRate}% | Range {snapshot.dataQuality.rangeViolationRate}%
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Model Quality</p>
          <p className="text-xl font-semibold">{snapshot.modelQuality.status.toUpperCase()}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Avg Conf {snapshot.modelQuality.averageConfidence}% | Low Trust {snapshot.modelQuality.lowTrustRate}%
          </p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Active Alerts</p>
          <p className="text-2xl font-bold">{snapshot.alerts.length}</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-3">
        Try: `Load Normal Sample` for STABLE, `Load Ransomware Sample` for WATCH, and `Load DDoS/Zero-Day Sample` for DRIFTED.
      </p>

      <div className="mt-5">
        <h3 className="text-sm font-semibold mb-2">Top Feature Drift</h3>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50">
              <tr>
                <th className="text-left p-2">Feature</th>
                <th className="text-left p-2">PSI</th>
                <th className="text-left p-2">KS</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshot.featureDrift
                .slice()
                .sort((a, b) => (b.psi + b.ks) - (a.psi + a.ks))
                .slice(0, 8)
                .map((metric) => (
                  <tr key={metric.feature} className="border-t">
                    <td className="p-2 font-medium">{metric.feature}</td>
                    <td className="p-2">{metric.psi.toFixed(3)}</td>
                    <td className="p-2">{metric.ks.toFixed(3)}</td>
                    <td className="p-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusClasses[metric.status]}`}>
                        {metric.status.toUpperCase()}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-5">
        <h3 className="text-sm font-semibold mb-2">Monitoring Alerts</h3>
        <div className="max-h-56 overflow-y-auto space-y-2">
          {snapshot.alerts.length === 0 ? (
            <div className="text-sm text-muted-foreground border rounded-lg p-3">
              No monitoring alerts yet.
            </div>
          ) : (
            snapshot.alerts.slice(0, 20).map((alert) => (
              <div key={alert.id} className={`rounded-lg border p-3 ${alertClasses[alert.severity]}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-xs uppercase font-semibold tracking-wide">
                    {alert.type.replace('_', ' ')}
                  </span>
                  <span className="text-xs uppercase font-semibold tracking-wide">
                    {alert.severity}
                  </span>
                </div>
                <p className="text-sm mt-1">{alert.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
