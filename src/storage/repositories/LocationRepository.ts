import { db } from '../db';
import { KnownLocation } from '../types';

interface KnownLocationRow {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isIndoor: number;
  status: string;
}

function mapLocation(row: KnownLocationRow): KnownLocation {
  return {
    id: row.id,
    label: row.label,
    latitude: row.latitude,
    longitude: row.longitude,
    radiusMeters: row.radiusMeters,
    isIndoor: row.isIndoor === 1,
    status: row.status === 'suggested' ? 'suggested' : 'active',
  };
}

export async function getKnownLocationsAsync(): Promise<KnownLocation[]> {
  try {
    const rows = await db.getAllAsync<KnownLocationRow>(
      'SELECT * FROM known_locations WHERE status = ?',
      ['active']
    );
    return rows.map(mapLocation);
  } catch (error) {
    console.error('[getKnownLocationsAsync] Database error:', error);
    return [];
  }
}

export async function getAllKnownLocationsAsync(): Promise<KnownLocation[]> {
  try {
    const rows = await db.getAllAsync<KnownLocationRow>('SELECT * FROM known_locations');
    return rows.map(mapLocation);
  } catch (error) {
    console.error('[getAllKnownLocationsAsync] Database error:', error);
    return [];
  }
}

export async function getSuggestedLocationsAsync(): Promise<KnownLocation[]> {
  const rows = await db.getAllAsync<KnownLocationRow>(
    'SELECT * FROM known_locations WHERE status = ?',
    ['suggested']
  );
  return rows.map(mapLocation);
}

export async function upsertKnownLocationAsync(loc: KnownLocation): Promise<void> {
  const status = loc.status ?? 'active';
  if (loc.id) {
    await db.runAsync(
      `UPDATE known_locations SET label=?, latitude=?, longitude=?, radiusMeters=?, isIndoor=?, status=? WHERE id=?`,
      [
        loc.label,
        loc.latitude,
        loc.longitude,
        loc.radiusMeters,
        loc.isIndoor ? 1 : 0,
        status,
        loc.id,
      ]
    );
  } else {
    await db.runAsync(
      `INSERT INTO known_locations (label, latitude, longitude, radiusMeters, isIndoor, status) VALUES (?,?,?,?,?,?)`,
      [loc.label, loc.latitude, loc.longitude, loc.radiusMeters, loc.isIndoor ? 1 : 0, status]
    );
  }
}

export async function denyKnownLocationAsync(id: number): Promise<void> {
  await db.runAsync('DELETE FROM known_locations WHERE id = ?', [id]);
}

export async function deleteKnownLocationAsync(id: number): Promise<void> {
  await db.runAsync('DELETE FROM known_locations WHERE id = ?', [id]);
}
