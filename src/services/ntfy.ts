import { NtfyConfig } from '../types/medgas';

export const DEFAULT_NTFY_CONFIG: NtfyConfig = {
  enabled: true,
  serverUrl: 'https://ntfy.sh',
  topic: 'medgas-icu-ward',
  priority: 'high',
  cooldownSeconds: 60,
  notifyOnWarn: true,
  notifyOnCrit: true,
  notifyOnRelayChange: true,
  lastSentAlerts: {},
};

export async function sendNtfyNotification(
  config: NtfyConfig,
  payload: {
    title: string;
    message: string;
    priority?: 'urgent' | 'high' | 'default' | 'low';
    tags?: string;
    key?: string; // used for cooldown throttling (e.g., 'gas_O2')
    force?: boolean;
  }
): Promise<{ success: boolean; message: string; timestamp: number }> {
  if (!config.enabled && !payload.force) {
    return { success: false, message: 'NTFY alerts disabled in settings', timestamp: Date.now() };
  }

  if (!config.topic || config.topic.trim().length === 0) {
    return { success: false, message: 'NTFY topic is not configured', timestamp: Date.now() };
  }

  const now = Date.now();
  // Check cooldown if key is provided
  if (payload.key && !payload.force) {
    const lastSent = config.lastSentAlerts[payload.key] || 0;
    const elapsedSeconds = (now - lastSent) / 1000;
    if (elapsedSeconds < config.cooldownSeconds) {
      return {
        success: false,
        message: `Cooldown active (${Math.ceil(config.cooldownSeconds - elapsedSeconds)}s remaining)`,
        timestamp: now,
      };
    }
  }

  const server = (config.serverUrl || 'https://ntfy.sh').replace(/\/+$/, '');
  const url = `${server}/${encodeURIComponent(config.topic.trim())}`;
  const priority = payload.priority || config.priority || 'high';
  const tags = payload.tags || 'warning,hospital';

  // Try direct fetch first
  try {
    const headers: Record<string, string> = {
      Title: payload.title,
      Priority: priority,
      Tags: tags,
      'Content-Type': 'text/plain; charset=utf-8',
    };

    if (config.authToken) {
      headers['Authorization'] = `Bearer ${config.authToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payload.message,
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      if (payload.key) {
        config.lastSentAlerts[payload.key] = now;
      }
      return { success: true, message: 'Notification sent successfully via NTFY', timestamp: now };
    }
  } catch (directErr) {
    console.warn('[NTFY] Direct send failed, attempting proxy fallback:', directErr);
  }

  // Fallback to proxy route
  try {
    const proxyRes = await fetch('/api/ntfy-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverUrl: config.serverUrl,
        topic: config.topic,
        title: payload.title,
        message: payload.message,
        priority,
        tags,
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (proxyRes.ok) {
      if (payload.key) {
        config.lastSentAlerts[payload.key] = now;
      }
      return { success: true, message: 'Notification delivered via NTFY proxy', timestamp: now };
    }
    const errData = await proxyRes.json().catch(() => ({}));
    throw new Error(errData.error || 'Proxy NTFY failed');
  } catch (proxyErr: any) {
    return {
      success: false,
      message: `Failed to deliver NTFY alert: ${proxyErr.message || 'Network error'}`,
      timestamp: now,
    };
  }
}
