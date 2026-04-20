import { getSettingAsync, setSettingAsync } from '../../storage';

export type ReminderQueueStatus = 'date_planned' | 'tick_planned' | 'consumed';

export interface ReminderQueueEntry {
  id: string; // unique notification identifier, also used as the Expo notification identifier
  slotMinutes: number; // minutes-of-day for this slot (e.g. 840 = 14:00)
  status: ReminderQueueStatus;
}

export class ReminderQueueManager {
  /** Read and parse the reminder queue from settings. Returns [] on parse error. */
  public async getQueue(): Promise<ReminderQueueEntry[]> {
    try {
      const raw = await getSettingAsync('smart_reminder_queue', '[]');
      return JSON.parse(raw) as ReminderQueueEntry[];
    } catch {
      return [];
    }
  }

  /** Serialize and persist the reminder queue to settings. */
  public async saveQueue(queue: ReminderQueueEntry[]): Promise<void> {
    await setSettingAsync('smart_reminder_queue', JSON.stringify(queue));
  }

  /** Format a slot-minutes value as HH:MM for log output. */
  public formatSlotMinutes(slotMinutes: number): string {
    const h = Math.floor(slotMinutes / 60);
    const m = slotMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  /** Format a queue entry as "id(HH:MM,status)" for log output. */
  public formatQueueEntry(entry: ReminderQueueEntry): string {
    return `${entry.id}(${this.formatSlotMinutes(entry.slotMinutes)},${entry.status})`;
  }

  /** Log the current reminder queue state for diagnostic purposes. */
  public async logReminderQueueSnapshot(): Promise<void> {
    const queue = await this.getQueue();
    if (queue.length === 0) {
      console.log('TouchGrass: [Queue] Snapshot: empty');
      return;
    }
    const entries = queue.map((e) => this.formatQueueEntry(e)).join(', ');
    console.log(`TouchGrass: [Queue] Snapshot (${queue.length}): ${entries}`);
  }
}

export const reminderQueueManager = new ReminderQueueManager();
