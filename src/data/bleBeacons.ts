/** Demo BLE beacons used for zone presence. Names must match advertised localName/name. */
export interface KnownBleBeacon {
  /** Exact advertised device name */
  name: string;
  /** Zone id shown to the user (e.g. 00001) */
  zoneId: string;
}

export const KNOWN_BLE_BEACONS: readonly KnownBleBeacon[] = [
  { name: 'DEMO_Beacon_00001', zoneId: '00001' },
  { name: 'DEMO_Beacon_00002', zoneId: '00002' },
  { name: 'DEMO_Beacon_00003', zoneId: '00003' },
] as const;

const BY_NAME = new Map(
  KNOWN_BLE_BEACONS.map((b) => [b.name.toLowerCase(), b] as const),
);

/** Exact match first, then substring (some stacks append/prefix noise). */
export function lookupKnownBeacon(advertisedName: string): KnownBleBeacon | undefined {
  const key = advertisedName.trim().toLowerCase();
  if (!key) return undefined;
  const exact = BY_NAME.get(key);
  if (exact) return exact;
  for (const beacon of KNOWN_BLE_BEACONS) {
    if (key.includes(beacon.name.toLowerCase())) return beacon;
  }
  return undefined;
}

export function isKnownBeaconName(advertisedName: string): boolean {
  return lookupKnownBeacon(advertisedName) != null;
}
