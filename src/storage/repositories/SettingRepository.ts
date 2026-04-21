import { db } from '../db';

export async function getSettingAsync(key: string, fallback: string): Promise<string> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM app_settings WHERE key = ?',
      [key]
    );
    return row?.value ?? fallback;
  } catch (error) {
    console.error('[getSettingAsync] Database error:', error);
    return fallback;
  }
}

export async function setSettingAsync(key: string, value: string): Promise<void> {
  await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [key, value]);
}
