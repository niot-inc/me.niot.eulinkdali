'use strict';

import Homey from 'homey';
import { setDeviceDim, setDeviceOnOff } from '../../lib/utils';

module.exports = class GroupDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    this.log('GroupDevice has been initialized');

    // Register a capability listener
    this.registerCapabilityListener('onoff', this.onCapabilityOnoff.bind(this));
    this.registerCapabilityListener('dim', this.onCapabilityDim.bind(this));
  }

  async onCapabilityOnoff(value: boolean) {
    const deviceData = this.getData() as { id: string };
    const instanceId = deviceData.id;

    await setDeviceOnOff(this.homey.settings.get('access_token'), this.homey.settings.get('server_url'), instanceId, value);

    this.log(`GroupDevice ${instanceId} on/off state has been set to`, value);
  }

  async onCapabilityDim(value: number) {
    const deviceData = this.getData() as { id: string };
    const instanceId = deviceData.id;

    const level = Math.round(value * 100);
    await setDeviceDim(this.homey.settings.get('access_token'), this.homey.settings.get('server_url'), instanceId, level);

    this.log(`GroupDevice ${instanceId} dim level has been set to`, level);
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('GroupDevice has been added');
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    this.log('GroupDevice settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name: string) {
    this.log('GroupDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('GroupDevice has been deleted');
  }

};
