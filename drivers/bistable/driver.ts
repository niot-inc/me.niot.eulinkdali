'use strict';

import Homey from 'homey';
import axios from 'axios';
import { getDaliDevices } from '../../lib/utils';

module.exports = class BistableDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('BistableDriver has been initialized');
  }

  /**
   * onPairListDevices is called when a user is adding a device and the 'list_devices' view is called.
   * This should return an array with the data of devices that are available for pairing.
   */
  async onPairListDevices() {
    const accessToken = this.homey.settings.get('access_token');
    const serverUrl = this.homey.settings.get('server_url');

    const devices = await getDaliDevices(accessToken, serverUrl).catch((error) => {
      if (axios.isAxiosError(error)) {
        this.error('API Error:', error.response?.data || error.message);
      } else {
        this.error('Unexpected error:', error);
      }
      return [];
    });
    return devices.filter(
      (device) => device.activeConnector === 'dali' && device.internalId === 'daliBistableLight',
    ).map((device) => ({
      name: device.name,
      data: {
        id: device.instanceId.toString(),
      },
    }));
  }

};
