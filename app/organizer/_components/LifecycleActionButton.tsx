'use client';

import { useState } from 'react';

export function LifecycleActionButton({ action, label, assessmentId, tone = 'solid', disabled = false, onDone }: { action:string; label:string; assessmentId:string; tone?:'solid'|'outline'|'danger'; disabled?:boolean; onDone?:(status:string)=>void }) {
  const [state,setState] = useState<'idle'|'working'|'done'|'failed'>('idle');
  async function run() {
    const consequential = action === 'start_test' || action === 'end_test' || action === 'publish_results';
    if (consequential && !window.confirm(`${label}? This will update what candidates can access.`)) return;
    setState('working');
    try {
      const response = await fetch('/api/assessments/status',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({assessmentId,action})});
      const payload = await response.json() as {status?:string;error?:string};
      if (!response.ok) { window.alert(payload.error || 'This lifecycle change could not be completed.'); throw new Error(); }
      setState('done'); onDone?.(payload.status || '');
    } catch { setState('failed'); }
  }
  return <button className={`lifecycle-button ${tone}`} onClick={run} disabled={disabled || state === 'working'}>{state === 'working' ? 'Updating…' : state === 'done' ? `${label} ✓` : state === 'failed' ? 'Retry' : label}</button>;
}
