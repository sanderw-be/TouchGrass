import { t } from '../../i18n';
import { IStorageService } from '../../storage/StorageService';



// Define minimal interfaces for the injected dependencies
interface IWeatherServiceForReminderBuilder {
  isWeatherDataAvailable(): Promise<boolean>;
}

interface IWeatherAlgorithmForReminderBuilder {
  getWeatherEmoji(weatherCode: number | null): string;
  getWeatherDescription(weatherCode: number | null): string;
}

export interface IReminderMessageBuilder {
  buildReminderMessage(
    todayMinutes: number,
    dailyTarget: number,
    hour: number,
    contributors?: string[],
    includeWeather?: boolean
  ): Promise<{ title: string; body: string }>;
}

export class ReminderMessageBuilder implements IReminderMessageBuilder {
  constructor(
    private storageService: IStorageService,
    private weatherService: IWeatherServiceForReminderBuilder,
    private weatherAlgorithm: IWeatherAlgorithmForReminderBuilder
  ) {}

  public async buildReminderMessage(
    todayMinutes: number,
    dailyTarget: number,
    hour: number,
    contributors?: string[],
    includeWeather: boolean = true
  ): Promise<{ title: string; body: string }> {
    const progress = Math.min(1, todayMinutes / dailyTarget);

    // Title based on progress
    let titleKey = 'notif_title_1';
    if (progress >= 0.9) titleKey = 'notif_title_5';
    else if (progress >= 0.75) titleKey = 'notif_title_4';
    else if (progress >= 0.5) titleKey = 'notif_title_3';
    else if (progress >= 0.25) titleKey = 'notif_title_2';

    // Body context
    let bodyKey = 'notif_body_generic';
    if (progress === 0) bodyKey = 'notif_body_start';
    else if (progress < 0.5) bodyKey = 'notif_body_early';
    else if (progress < 0.9) bodyKey = 'notif_body_halfway';
    else bodyKey = 'notif_body_almost';

    let body = t(bodyKey);

    // Append contributors if present
    if (contributors && contributors.length > 0) {
      const descriptions = contributors.map((key) => String(t(key)));
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
        body += `. ${joined}.`;
      }
    } 
    
    if (includeWeather) {
      // Append weather context if weather enabled
      const weatherEnabled = (await this.storageService.getSettingAsync('weather_enabled', '1')) === '1';
      if (weatherEnabled) {
        let appendedWeather = false;

        // Try to get weather for this specific hour
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const hourDataList = await this.storageService.getWeatherConditionsForHourAsync(startOfDay.getTime(), hour, hour + 1);
        const hourData = hourDataList.length > 0 ? hourDataList[0] : null;

        if (hourData) {
          const preferCelsius = (await this.storageService.getSettingAsync('prefer_celsius', '1')) === '1';
          const emoji = this.weatherAlgorithm.getWeatherEmoji(hourData.weatherCode);
          const description = t(this.weatherAlgorithm.getWeatherDescription(hourData.weatherCode));
          const temperature = this._getTemperatureString(hourData.temperature, preferCelsius);
          body += `. ${emoji} ${t('notif_weather_context', { description, temperature })}.`;
          appendedWeather = true;
        }
        
        // Fallback for when weather is enabled but no specific hour data is found
        if (!appendedWeather && (await this.weatherService.isWeatherDataAvailable())) {
          const preferCelsius = (await this.storageService.getSettingAsync('prefer_celsius', '1')) === '1';
          const emoji = this.weatherAlgorithm.getWeatherEmoji(null); // Use null for generic/fallback emoji
          const description = t(this.weatherAlgorithm.getWeatherDescription(null)); // Use null for generic/fallback description
          const temperature = this._getTemperatureString(null, preferCelsius); // Use null for generic/fallback temperature
          body += `. ${emoji} ${t('notif_weather_context', { description, temperature })}.`;
        }
      }
    }

    return {
      title: t(titleKey),
      body,
    };
  }

  // Private helper method to format temperature string
  private _getTemperatureString(temperature: number | null, preferCelsius: boolean): string {
    if (temperature === null) {
      return t('weather_temp_unknown');
    }
    const unit = preferCelsius ? '°C' : '°F';
    return `${Math.round(temperature)}${unit}`;
  }
}

