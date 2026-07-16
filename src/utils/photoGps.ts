import * as Location from 'expo-location';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { PhotoGps } from '../data/models';

function isFiniteCoord(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function dmsToDecimal(parts: unknown, ref?: unknown): number | undefined {
  if (!Array.isArray(parts) || parts.length === 0) return undefined;
  if (parts.length === 1 && isFiniteCoord(parts[0])) {
    const value = parts[0];
    const letter = typeof ref === 'string' ? ref.toUpperCase() : '';
    return letter === 'S' || letter === 'W' ? -Math.abs(value) : value;
  }
  const [deg, min = 0, sec = 0] = parts.map((part) => (typeof part === 'number' ? part : Number(part)));
  if (!Number.isFinite(deg)) return undefined;
  let decimal = deg + min / 60 + sec / 3600;
  const letter = typeof ref === 'string' ? ref.toUpperCase() : '';
  if (letter === 'S' || letter === 'W') decimal *= -1;
  return decimal;
}

function gpsFromExif(exif: Record<string, unknown> | undefined): PhotoGps | undefined {
  if (!exif) return undefined;

  const gpsBlock =
    typeof exif.GPS === 'object' && exif.GPS !== null ? (exif.GPS as Record<string, unknown>) : exif;

  let latitude = isFiniteCoord(gpsBlock.GPSLatitude) ? gpsBlock.GPSLatitude : undefined;
  let longitude = isFiniteCoord(gpsBlock.GPSLongitude) ? gpsBlock.GPSLongitude : undefined;

  if (latitude === undefined) {
    latitude = dmsToDecimal(gpsBlock.GPSLatitude, gpsBlock.GPSLatitudeRef);
  }
  if (longitude === undefined) {
    longitude = dmsToDecimal(gpsBlock.GPSLongitude, gpsBlock.GPSLongitudeRef);
  }

  if (latitude === undefined || longitude === undefined) return undefined;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;

  return {
    latitude,
    longitude,
    capturedAt: new Date().toISOString(),
    source: 'exif',
  };
}

export async function ensureLocationPermission(): Promise<boolean> {
  const current = await Location.getForegroundPermissionsAsync();
  if (current.granted) return true;
  const requested = await Location.requestForegroundPermissionsAsync();
  return requested.granted;
}

async function gpsFromDevice(): Promise<PhotoGps | undefined> {
  const granted = await ensureLocationPermission();
  if (!granted) return undefined;

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy ?? undefined,
      capturedAt: new Date(position.timestamp).toISOString(),
      source: 'device',
    };
  } catch {
    return undefined;
  }
}

/** Prefer photo EXIF GPS; fall back to the device location at insert time. */
export async function resolvePhotoGps(asset?: ImagePickerAsset): Promise<PhotoGps | undefined> {
  const fromExif = gpsFromExif(asset?.exif as Record<string, unknown> | undefined);
  if (fromExif) return fromExif;
  return gpsFromDevice();
}

export function formatPhotoGps(gps: PhotoGps, decimals = 5): string {
  return `${gps.latitude.toFixed(decimals)}, ${gps.longitude.toFixed(decimals)}`;
}

export function photoGpsMapsUrl(gps: PhotoGps): string {
  return `https://www.google.com/maps/search/?api=1&query=${gps.latitude},${gps.longitude}`;
}
