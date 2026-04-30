import { t } from '../../i18n';
import { IStorageService } from '../../storage/StorageService';

export interface IReminderMessageBuilder {
  buildReminderMessage(
    todayMinutes: number,
    dailyTarget: number,
    hour: number,
    contributors?: string[]
  ): Promise<{ title: string; body: string }>;
}

export class ReminderMessageBuilder implements IReminderMessageBuilder {
  constructor(private storageService: IStorageService) {}

  public async buildReminderMessage(
    todayMinutes: number,
    dailyTarget: number,
    hour: number,
    contributors?: string[]
  ): Promise<{ title: string; body: string }> {
    const progress = Math.min(1, todayMinutes / dailyTarget);

    // Title based on progress
    let title = t('notif_title_1');
    if (progress >= 0.9) title = t('notif_title_5');
    else if (progress >= 0.75) title = t('notif_title_4');
    else if (progress >= 0.5) title = t('notif_title_3');
    else if (progress >= 0.25) title = t('notif_title_2');

    // Body context
    let body: string = t('notif_body_generic');
    if (progress === 0) body = t('notif_body_start');
    else if (progress < 0.5) body = t('notif_body_early');
    else if (progress < 0.9) body = t('notif_body_progress_halfway');
    else body = t('notif_body_progress_almost');

    // Append contributors if present
    if (contributors && contributors.length > 0) {
      // The contributors are already fully formatted strings from the reminderAlgorithm
      const descriptions = [...contributors];
      let joined = '';
      if (descriptions.length === 1) {
        joined = descriptions[0];
      } else {
        const last = descriptions.pop();
        joined = `${descriptions.join(', ')}, ${t('notif_contributor_and')} ${last}`;
      }

      if (joined) {
        // Capitalize first letter
        joined = joined.charAt(0).toUpperCase() + joined.slice(1);
        body += ` ${joined}.`;
      }
    }

    return {
      title,
      body,
    };
  }
}
