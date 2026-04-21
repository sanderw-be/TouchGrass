import { IStorageService } from '../../storage/StorageService';
import { ReminderQueueEntry } from '../notificationManager';

export interface IReminderQueueManager {
  getQueue(): Promise<ReminderQueueEntry[]>;
  saveQueue(queue: ReminderQueueEntry[]): Promise<void>;
  clearQueue(): Promise<void>;
  addToQueue(entry: ReminderQueueEntry): Promise<void>;
  logReminderQueueSnapshot(): Promise<void>;
}

export class ReminderQueueManager implements IReminderQueueManager {
  constructor(private storageService: IStorageService) {}

  public async logReminderQueueSnapshot(): Promise<void> {
    const queue = await this.getQueue();
    const snapshot =
      queue.length === 0 ? 'empty' : queue.map((e) => `${e.slotMinutes}[${e.status}]`).join(', ');
    await this.storageService.insertBackgroundLogAsync('reminder', `Queue snapshot: ${snapshot}`);
  }

  public async getQueue(): Promise<ReminderQueueEntry[]> {
    const raw = await this.storageService.getSettingAsync('smart_reminder_queue', '[]');
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public async saveQueue(queue: ReminderQueueEntry[]): Promise<void> {
    await this.storageService.setSettingAsync('smart_reminder_queue', JSON.stringify(queue));
  }

  public async clearQueue(): Promise<void> {
    await this.saveQueue([]);
  }

  public async addToQueue(entry: ReminderQueueEntry): Promise<void> {
    const queue = await this.getQueue();
    queue.push(entry);
    await this.saveQueue(queue);
  }
}
