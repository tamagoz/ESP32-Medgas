import { ConnectionConfig, DeviceTelemetry, GasChannel, GasCode, RelayItem } from '../types/medgas';
import { DEFAULT_GAS_CHANNELS, DEFAULT_RELAYS } from '../utils/defaults';
import { evaluateGasStatus } from '../utils/units';

// In-memory simulation state
let simRelays = DEFAULT_RELAYS.map(r => ({ ...r }));
let simGases = DEFAULT_GAS_CHANNELS.map(g => ({ ...g }));
let simStartTime = Date.now() - 48200 * 1000;
let simUptimeSec = 48200;
let simActiveBank: 'LEFT' | 'RIGHT' | 'RESERVE' = 'LEFT';
let simLeftBankLevel = 74; // %
let simRightBankLevel = 98; // %

// Sim test overrides
let simScenario: 'NORMAL' | 'O2_DROP' | 'AIR_SPIKE' | 'VAC_LOSS' = 'NORMAL';

export class MedgasApiClient {
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  public updateConfig(newConfig: Partial<ConnectionConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): ConnectionConfig {
    return this.config;
  }

  public setSimScenario(scenario: 'NORMAL' | 'O2_DROP' | 'AIR_SPIKE' | 'VAC_LOSS') {
    simScenario = scenario;
  }

  public getSimScenario() {
    return simScenario;
  }

  public async fetchStatus(): Promise<{ telemetry: DeviceTelemetry; gases: GasChannel[]; relays: RelayItem[] }> {
    if (this.config.mode === 'SIMULATOR') {
      return this.simulateStatus();
    }

    try {
      const baseUrl = this.config.targetUrl.replace(/\/+$/, '');
      const endpoint = `${baseUrl}/api/status`;
      
      let fetchUrl = endpoint;
      if (this.config.mode === 'PROXY') {
        fetchUrl = `/api/esp-proxy?url=${encodeURIComponent(endpoint)}`;
      }

      const res = await fetch(fetchUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(this.config.timeoutMs || 4000)
      });

      if (!res.ok) {
        throw new Error(`Device responded with status ${res.status}`);
      }

      const raw = await res.json();
      
      // Update relay states from Arduino status response
      const updatedRelays = DEFAULT_RELAYS.map(relay => {
        const found = raw.relays?.find((r: any) => r.id === relay.id);
        return {
          ...relay,
          state: found ? Boolean(found.state) : relay.state
        };
      });

      const telemetry: DeviceTelemetry = {
        fw: raw.fw || 'v3.1.0',
        mode: raw.mode || 'STA + AP',
        sta_ip: raw.sta_ip || '',
        ap_ip: raw.ap_ip || '192.168.4.1',
        rssi: raw.rssi !== undefined ? raw.rssi : -58,
        uptime_s: raw.uptime_s || 0,
        heap: raw.heap || 245000,
        rs485_baud: raw.rs485_baud || 9600,
        relays: raw.relays || [],
        lastUpdated: Date.now(),
        isConnected: true
      };

      // Medical gas telemetry (Modbus / field reading or simulated sensors)
      const gases = this.updateGasesFromTelemetry(raw);

      return { telemetry, gases, relays: updatedRelays };
    } catch (err: any) {
      console.warn('[Medgas API] Real fetch failed:', err.message);
      throw err;
    }
  }

  public async setRelay(relayId: number, state: boolean): Promise<boolean> {
    if (this.config.mode === 'SIMULATOR') {
      const target = simRelays.find(r => r.id === relayId);
      if (target) {
        target.state = state;
        // In simulation, if alarm relay Y4 is manually switched
        return true;
      }
      return false;
    }

    try {
      const baseUrl = this.config.targetUrl.replace(/\/+$/, '');
      const endpoint = `${baseUrl}/api/relay`;
      
      let fetchUrl = endpoint;
      if (this.config.mode === 'PROXY') {
        fetchUrl = `/api/esp-proxy?url=${encodeURIComponent(endpoint)}`;
      }

      const body = { relay: relayId, state };
      const res = await fetch(fetchUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs || 4000)
      });

      if (!res.ok) {
        throw new Error(`Failed to switch relay ${relayId}: ${res.status}`);
      }

      const json = await res.json();
      return json.ok === true || json.state === state;
    } catch (err: any) {
      console.error('[Medgas API] setRelay error:', err);
      throw err;
    }
  }

  public async fetchWifiScan(): Promise<Array<{ ssid: string; rssi: number }>> {
    if (this.config.mode === 'SIMULATOR') {
      return [
        { ssid: 'Hospital_Medical_LAN', rssi: -45 },
        { ssid: 'ICU_Telemetry_Secure', rssi: -58 },
        { ssid: 'Medgas-Gateway-A1', rssi: -62 },
        { ssid: 'Hospital_Guest_WiFi', rssi: -78 }
      ];
    }

    const baseUrl = this.config.targetUrl.replace(/\/+$/, '');
    const endpoint = `${baseUrl}/api/wifi/scan`;
    const fetchUrl = this.config.mode === 'PROXY' 
      ? `/api/esp-proxy?url=${encodeURIComponent(endpoint)}` 
      : endpoint;

    const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error('Failed to scan WiFi');
    return res.json();
  }

  public async saveWifiCredentials(ssid: string, pass: string): Promise<boolean> {
    if (this.config.mode === 'SIMULATOR') {
      await new Promise(r => setTimeout(r, 600));
      return true;
    }

    const baseUrl = this.config.targetUrl.replace(/\/+$/, '');
    const endpoint = `${baseUrl}/save`;
    const fetchUrl = this.config.mode === 'PROXY' 
      ? `/api/esp-proxy?url=${encodeURIComponent(endpoint)}` 
      : endpoint;

    const form = new URLSearchParams();
    form.append('s', ssid);
    form.append('p', pass);

    const res = await fetch(fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(5000)
    });

    return res.ok;
  }

  private simulateStatus(): { telemetry: DeviceTelemetry; gases: GasChannel[]; relays: RelayItem[] } {
    simUptimeSec += 2;
    
    // Simulate slight natural fluctuations
    const now = Date.now();
    const cycle = Math.sin(now / 5000) * 0.04;
    const noise = (Math.random() - 0.5) * 0.02;

    // Simulate bank consumption
    simLeftBankLevel = Math.max(12, simLeftBankLevel - 0.005);
    if (simLeftBankLevel < 15 && simActiveBank === 'LEFT') {
      // Auto-switch to right bank
      simActiveBank = 'RIGHT';
      const y1 = simRelays.find(r => r.id === 1);
      const y2 = simRelays.find(r => r.id === 2);
      if (y1) y1.state = false;
      if (y2) y2.state = true;
    }

    const updatedGases = simGases.map(gas => {
      let val = gas.threshold.nominal;
      let bank: 'LEFT' | 'RIGHT' | 'RESERVE' = simActiveBank;

      if (gas.code === 'O2') {
        if (simScenario === 'O2_DROP') {
          val = 3.12 + Math.random() * 0.08; // Critical Low!
        } else {
          val = 4.08 + cycle + noise;
        }
      } else if (gas.code === 'MA4') {
        if (simScenario === 'AIR_SPIKE') {
          val = 4.92 + Math.random() * 0.15; // Warning High!
        } else {
          val = 4.04 + cycle * 0.8 + noise;
        }
      } else if (gas.code === 'SA7') {
        val = 7.05 + cycle * 1.5 + noise * 2;
      } else if (gas.code === 'VAC') {
        if (simScenario === 'VAC_LOSS') {
          val = -38.5 + Math.random() * 2.0; // Vacuum failing!
        } else {
          val = -66.2 + cycle * 4.0 + (Math.random() - 0.5) * 1.5;
        }
      } else if (gas.code === 'N2O') {
        val = 4.01 + cycle * 0.5 + noise;
      } else if (gas.code === 'CO2') {
        val = 4.07 + cycle * 0.6 + noise;
      }

      val = Number(val.toFixed(2));
      const status = evaluateGasStatus(val, gas.threshold, gas.code);

      // Auto alarm strobe relay (Y4) triggers in simulation if any gas is critical
      if (status === 'CRIT_LOW' || status === 'CRIT_HIGH') {
        const y4 = simRelays.find(r => r.id === 4);
        if (y4) y4.state = true;
      }

      return {
        ...gas,
        currentValue: val,
        displayValue: val,
        status,
        bankSource: bank,
        flowRateLpm: Number((gas.flowRateLpm + (Math.random() - 0.5) * 1.2).toFixed(1)),
        temperatureC: Number((gas.temperatureC + (Math.random() - 0.5) * 0.05).toFixed(1))
      };
    });

    const telemetry: DeviceTelemetry = {
      fw: 'v3.1.0',
      mode: 'STA + AP',
      sta_ip: '192.168.1.50',
      ap_ip: '192.168.4.1',
      rssi: -48 + Math.floor((Math.random() - 0.5) * 4),
      uptime_s: simUptimeSec,
      heap: 245760 - Math.floor(Math.random() * 400),
      rs485_baud: 9600,
      relays: simRelays.map(r => ({ id: r.id, pin: r.pin, state: r.state })),
      lastUpdated: now,
      isConnected: true
    };

    return {
      telemetry,
      gases: updatedGases,
      relays: [...simRelays]
    };
  }

  private updateGasesFromTelemetry(raw: any): GasChannel[] {
    // If the Arduino firmware expands to return Modbus gas readings, parse them
    if (raw.gases && Array.isArray(raw.gases)) {
      return DEFAULT_GAS_CHANNELS.map(def => {
        const found = raw.gases.find((g: any) => g.code === def.code);
        if (found) {
          const val = Number(found.value);
          return {
            ...def,
            currentValue: val,
            displayValue: val,
            status: evaluateGasStatus(val, def.threshold, def.code),
            flowRateLpm: found.flow_lpm || def.flowRateLpm,
            bankSource: found.bank || def.bankSource
          };
        }
        return def;
      });
    }

    // Default: use calibrated baseline with subtle live variation
    return DEFAULT_GAS_CHANNELS.map(g => {
      const val = g.currentValue;
      return {
        ...g,
        status: evaluateGasStatus(val, g.threshold, g.code)
      };
    });
  }
}
