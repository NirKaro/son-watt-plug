// src/platform.ts
import { API, DynamicPlatformPlugin, Logging, PlatformAccessory, PlatformConfig, Service, Characteristic } from 'homebridge';
import axios from 'axios';

export class SonoffWattageMonitor implements DynamicPlatformPlugin {
  private readonly log: Logging;
  private readonly api: API;
  private readonly Service: typeof Service;
  private readonly Characteristic: typeof Characteristic;
  private accessories: PlatformAccessory[] = [];
  private wattageThreshold: number;
  private sonoffDeviceId: string;
  private interval: NodeJS.Timeout | null = null;

  constructor(log: Logging, config: PlatformConfig, api: API) {
    this.log = log;
    this.api = api;
    this.Service = this.api.hap.Service;
    this.Characteristic = this.api.hap.Characteristic;

    this.wattageThreshold = config.wattageThreshold || 1000; // Default 1000W
    this.sonoffDeviceId = config.sonoffDeviceId;

    if (!this.sonoffDeviceId) {
      this.log.error('Sonoff Device ID is not configured!');
      return;
    }

    this.api.on('didFinishLaunching', () => {
      this.log.info('Sonoff Wattage Monitor Plugin Initialized');
      this.startMonitoring();
    });
  }

  async getSonoffPowerUsage(): Promise<{ switchState: boolean; wattage: number } | null> {
    try {
      const response = await axios.get(`http://localhost:3000/ewelink/${this.sonoffDeviceId}/power`);
      return {
        switchState: response.data.state === 'on',
        wattage: response.data.wattage,
      };
    } catch (error) {
      this.log.error('Error fetching Sonoff power data:', error);
      return null;
    }
  }

  async turnOffSonoffSwitch() {
    try {
      await axios.post(`http://localhost:3000/ewelink/${this.sonoffDeviceId}/off`);
      this.log.info('Sonoff switch turned off due to low wattage');
    } catch (error) {
      this.log.error('Failed to turn off Sonoff switch:', error);
    }
  }

  startMonitoring() {
    this.interval = setInterval(async () => {
      const powerData = await this.getSonoffPowerUsage();
      if (powerData && powerData.switchState && powerData.wattage < this.wattageThreshold) {
        this.log.info(`Wattage (${powerData.wattage}W) is below threshold (${this.wattageThreshold}W), turning off switch.`);
        await this.turnOffSonoffSwitch();
      }
    }, 5000); // Check every 5 seconds
  }

  configureAccessory(accessory: PlatformAccessory) {
    this.accessories.push(accessory);
  }
}
