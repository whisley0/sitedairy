import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, ScanMode, State, type Device } from 'react-native-ble-plx';
import type { PhotoBle } from '../data/models';
import { lookupKnownBeacon } from '../data/bleBeacons';

const DEFAULT_TIMEOUT_MS = 2800;

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  if (Platform.Version >= 31) {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return (
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
      result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
    );
  }

  const fine = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
  return fine === PermissionsAndroid.RESULTS.GRANTED;
}

function advertisedName(device: Device): string {
  return device.localName?.trim() || device.name?.trim() || '';
}

/**
 * Brief BLE scan for the strongest mapped demo beacon.
 * Returns MAC/UUID + zone mapping when a known beacon is in range; otherwise undefined.
 */
export async function resolvePhotoBle(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<PhotoBle | undefined> {
  if (Platform.OS === 'web') return undefined;

  const granted = await requestBlePermissions();
  if (!granted) return undefined;

  let manager: BleManager | null = null;
  try {
    manager = new BleManager();
    const state = await manager.state();
    if (state !== State.PoweredOn) return undefined;

    return await new Promise<PhotoBle | undefined>((resolve) => {
      const bestById = new Map<string, { deviceId: string; name: string; zoneId: string; rssi: number }>();
      let settled = false;

      const finish = () => {
        if (settled) return;
        settled = true;
        try {
          manager?.stopDeviceScan();
        } catch {
          // ignore
        }
        try {
          manager?.destroy();
        } catch {
          // ignore
        }
        manager = null;

        let best: { deviceId: string; name: string; zoneId: string; rssi: number } | null = null;
        for (const sighting of bestById.values()) {
          if (!best || sighting.rssi > best.rssi) best = sighting;
        }
        if (!best) {
          resolve(undefined);
          return;
        }
        resolve({
          deviceId: best.deviceId,
          name: best.name,
          zoneId: best.zoneId,
          rssi: best.rssi,
          capturedAt: new Date().toISOString(),
        });
      };

      const timer = setTimeout(finish, Math.max(800, timeoutMs));

      manager!.startDeviceScan(
        null,
        { allowDuplicates: true, scanMode: ScanMode.LowLatency },
        (scanError, device) => {
          if (settled) return;
          if (scanError) {
            clearTimeout(timer);
            finish();
            return;
          }
          if (!device?.id) return;
          const rssi = typeof device.rssi === 'number' ? device.rssi : -999;
          if (rssi <= -999) return;

          const prev = bestById.get(device.id);
          const name = advertisedName(device) || prev?.name || '';
          const known = lookupKnownBeacon(name);
          if (!known) return;

          const next = {
            deviceId: device.id,
            name: known.name,
            zoneId: known.zoneId,
            rssi: prev ? Math.max(prev.rssi, rssi) : rssi,
          };
          bestById.set(device.id, next);
        },
      );
    });
  } catch {
    try {
      manager?.destroy();
    } catch {
      // ignore
    }
    return undefined;
  }
}

export function formatPhotoBle(ble: PhotoBle): string {
  return `zone ${ble.zoneId} · ${ble.name}`;
}
