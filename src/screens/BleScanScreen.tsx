import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { BleManager, ScanMode, State, type Device } from 'react-native-ble-plx';
import { SectionHeader } from '../components/CommonComponents';
import { HapticPressable } from '../components/HapticPressable';
import { lookupKnownBeacon } from '../data/bleBeacons';
import { colors } from '../theme/colors';
import { typography } from '../theme/typography';

export interface BleSighting {
  id: string;
  name: string;
  rssi: number;
  lastSeenAt: number;
}

async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  // Beacon ads require location on Android 12+ when BLUETOOTH_SCAN is not
  // marked neverForLocation (that flag filters out beacons).
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
  return (device.localName?.trim() || device.name?.trim() || '');
}

function signalBars(rssi: number): number {
  // Typical BLE RSSI: ~-40 (very strong) to ~-100 (very weak)
  if (rssi >= -55) return 4;
  if (rssi >= -65) return 3;
  if (rssi >= -75) return 2;
  if (rssi >= -85) return 1;
  return 0;
}

function SignalMeter({ rssi }: { rssi: number }) {
  const bars = signalBars(rssi);
  return (
    <View style={styles.meter}>
      {[0, 1, 2, 3].map((level) => (
        <View
          key={level}
          style={[
            styles.meterBar,
            { height: 6 + level * 4 },
            level < bars ? styles.meterBarOn : styles.meterBarOff,
          ]}
        />
      ))}
    </View>
  );
}

interface BleRowProps {
  item: BleSighting;
  rank: number;
  mapped?: boolean;
}

function BleRow({ item, rank, mapped }: BleRowProps) {
  const { t } = useTranslation();
  return (
    <View style={[styles.row, mapped && styles.rowMapped]}>
      <Text style={styles.rank}>{rank}</Text>
      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.id} numberOfLines={1}>
          {item.id}
        </Text>
      </View>
      <View style={styles.rssiWrap}>
        <SignalMeter rssi={item.rssi} />
        <Text style={styles.rssi}>
          {t('ble.rssiValue', { value: item.rssi })}
        </Text>
      </View>
    </View>
  );
}

export function BleScanScreen() {
  const { t } = useTranslation();
  const managerRef = useRef<BleManager | null>(null);
  const devicesRef = useRef<Map<string, BleSighting>>(new Map());
  const [devices, setDevices] = useState<BleSighting[]>([]);
  const [scanning, setScanning] = useState(false);
  const [adapterState, setAdapterState] = useState<State>(State.Unknown);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...devices].sort((a, b) => b.rssi - a.rssi),
    [devices],
  );

  /** Strongest mapped demo beacon currently in range → current zone. */
  const activeZone = useMemo(() => {
    let best: { sighting: BleSighting; zoneId: string } | null = null;
    for (const sighting of devices) {
      const known = lookupKnownBeacon(sighting.name);
      if (!known) continue;
      if (!best || sighting.rssi > best.sighting.rssi) {
        best = { sighting, zoneId: known.zoneId };
      }
    }
    return best;
  }, [devices]);

  /** Surrounding list stays empty until at least one mapped demo beacon is in range. */
  const listData = activeZone ? sorted : [];

  const stopScan = useCallback(() => {
    try {
      managerRef.current?.stopDeviceScan();
    } catch {
      // ignore
    }
    setScanning(false);
  }, []);

  const publishDevices = useCallback(() => {
    setDevices(Array.from(devicesRef.current.values()));
  }, []);

  const startScan = useCallback(async () => {
    setError(null);
    const granted = await requestBlePermissions();
    if (!granted) {
      setError(t('ble.permissionDenied'));
      return;
    }

    const manager = managerRef.current;
    if (!manager) {
      setError(t('ble.unavailable'));
      return;
    }

    const state = await manager.state();
    setAdapterState(state);
    if (state !== State.PoweredOn) {
      setError(t('ble.bluetoothOff'));
      return;
    }

    stopScan();
    devicesRef.current = new Map();
    publishDevices();
    setScanning(true);

    manager.startDeviceScan(
      null,
      { allowDuplicates: true, scanMode: ScanMode.LowLatency },
      (scanError, device: Device | null) => {
        if (scanError) {
          setError(scanError.message || t('ble.scanFailed'));
          stopScan();
          return;
        }
        if (!device?.id) return;
        const rssi = typeof device.rssi === 'number' ? device.rssi : -999;
        if (rssi <= -999) return;

        // Some beacons omit the local name on alternate packets; keep the last good name.
        const prev = devicesRef.current.get(device.id);
        const nextName = advertisedName(device);
        const name = nextName || prev?.name || t('ble.unnamed');

        devicesRef.current.set(device.id, {
          id: device.id,
          name,
          rssi,
          lastSeenAt: Date.now(),
        });
        publishDevices();
      },
    );
  }, [publishDevices, stopScan, t]);

  useEffect(() => {
    const manager = new BleManager();
    managerRef.current = manager;
    const sub = manager.onStateChange((state) => {
      setAdapterState(state);
      if (state !== State.PoweredOn) stopScan();
    }, true);
    return () => {
      stopScan();
      sub.remove();
      manager.destroy();
      managerRef.current = null;
    };
  }, [stopScan]);

  useFocusEffect(
    useCallback(() => {
      void startScan();
      return () => stopScan();
    }, [startScan, stopScan]),
  );

  // Periodically drop stale sightings so the list reflects the live environment.
  useEffect(() => {
    if (!scanning) return;
    const timer = setInterval(() => {
      const cutoff = Date.now() - 12_000;
      let changed = false;
      for (const [id, sighting] of devicesRef.current) {
        if (sighting.lastSeenAt < cutoff) {
          devicesRef.current.delete(id);
          changed = true;
        }
      }
      if (changed) publishDevices();
    }, 2000);
    return () => clearInterval(timer);
  }, [scanning, publishDevices]);

  return (
    <View style={styles.container}>
      <SectionHeader title={t('ble.title')} description={t('ble.description')} />

      <View style={styles.toolbar}>
        <View style={styles.statusChip}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: scanning ? colors.success : colors.textMuted },
            ]}
          />
          <Text style={styles.statusText}>
            {scanning
              ? t('ble.scanning', { count: listData.length })
              : t('ble.idle')}
          </Text>
        </View>
        <View style={styles.toolbarActions}>
          <HapticPressable
            style={styles.refreshBtn}
            onPress={() => void startScan()}
            accessibilityRole="button"
            accessibilityLabel={t('ble.refresh')}
          >
            <Ionicons name="refresh" size={18} color={colors.primary} />
            <Text style={styles.refreshBtnText}>{t('ble.refresh')}</Text>
          </HapticPressable>
          <HapticPressable
            style={[styles.scanBtn, scanning && styles.scanBtnStop]}
            onPress={() => (scanning ? stopScan() : void startScan())}
          >
            {scanning ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="bluetooth" size={18} color="#fff" />
            )}
            <Text style={styles.scanBtnText}>
              {scanning ? t('ble.stop') : t('ble.start')}
            </Text>
          </HapticPressable>
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="warning-outline" size={18} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {adapterState !== State.PoweredOn && !error ? (
        <Text style={styles.hint}>{t('ble.bluetoothOff')}</Text>
      ) : null}

      <View style={[styles.zoneCard, activeZone ? styles.zoneCardActive : styles.zoneCardIdle]}>
        <Text style={styles.zoneLabel}>{t('ble.zoneTitle')}</Text>
        {activeZone ? (
          <>
            <Text style={styles.zoneIn}>
              {t('ble.zoneIn', { zone: activeZone.zoneId })}
            </Text>
            <Text style={styles.zoneMeta}>
              {t('ble.zoneBeacon', { name: activeZone.sighting.name })}
              {' · '}
              {t('ble.rssiValue', { value: activeZone.sighting.rssi })}
            </Text>
          </>
        ) : (
          <Text style={styles.zoneNone}>{t('ble.zoneNone')}</Text>
        )}
      </View>

      <Text style={styles.listHeading}>{t('ble.allDevices')}</Text>

      <FlatList
        data={listData}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {scanning ? t('ble.emptyNoBeacon') : t('ble.emptyIdle')}
          </Text>
        }
        renderItem={({ item, index }) => (
          <BleRow
            item={item}
            rank={index + 1}
            mapped={lookupKnownBeacon(item.name) != null}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  refreshBtnText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  scanBtnStop: { backgroundColor: colors.error },
  scanBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFEBEE',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  errorText: { color: colors.error, flex: 1, fontSize: 13, lineHeight: 18 },
  hint: { color: colors.textMuted, marginBottom: 10, fontSize: 13 },
  zoneCard: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 14,
    gap: 4,
  },
  zoneCardActive: {
    backgroundColor: colors.surface,
    borderColor: colors.primary,
  },
  zoneCardIdle: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  zoneLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  zoneIn: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    marginTop: 2,
  },
  zoneMeta: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  zoneNone: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 22,
  },
  listHeading: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    marginBottom: 8,
  },
  list: { paddingBottom: 24, gap: 8 },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  rowMapped: {
    borderColor: colors.primary,
  },
  rank: {
    width: 28,
    textAlign: 'center',
    fontWeight: '800',
    color: colors.primary,
    fontSize: typography.body,
  },
  rowBody: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: '700', color: colors.text },
  id: { fontSize: 11, color: colors.textMuted },
  rssiWrap: { alignItems: 'flex-end', gap: 4, minWidth: 72 },
  rssi: { fontSize: 12, fontWeight: '700', color: colors.text },
  meter: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 18 },
  meterBar: { width: 4, borderRadius: 2 },
  meterBarOn: { backgroundColor: colors.primary },
  meterBarOff: { backgroundColor: colors.border },
});
