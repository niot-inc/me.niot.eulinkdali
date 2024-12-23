'use strict';

import axios from 'axios';

export interface DaliDevice {
  general: {
    // 장치의 고유 식별자
    instanceId: number;
  };
  device: {
    // 장치의 템플릿 식별자: daliDimmableGroup, daliDimmableLight, daliBistableLight, daliSceneController
    internalId: string;
  };
  configuration: {
    // should be `dali`
    activeConnector: string;
    // 장치의 이름
    name: string;
  };
}

export async function getDaliDevices(accessToken: string, serverUrl: string) {
  const response = await axios.get<DaliDevice[]>(`http://${serverUrl}/api/v1/instance`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000, // 10초 타임아웃 설정 (10000밀리초)
  });

  // 필요한 데이터만 추출
  return response.data.map((device) => ({
    // 장치의 고유 식별자
    instanceId: device.general.instanceId,
    // 장치의 이름
    name: device.configuration.name,
    // should be `dali`
    activeConnector: device.configuration.activeConnector,
    // 장치의 템플릿 식별자: daliDimmableGroup, daliDimmableLight, daliBistableLight 등
    internalId: device.device.internalId,
  }));
}

/**
 * Set the on/off state of a device.
 * @param accessToken
 * @param serverUrl
 * @param instanceId
 * @param on The on/off state.
 */
export async function setDeviceOnOff(accessToken: string, serverUrl: string, instanceId: string, on: boolean) {
  const body = {
    source: 'button', rowId: 1, command: on ? 'turnOn' : 'turnOff', params: null,
  };
  await axios.put(`http://${serverUrl}/api/v1/instance/${instanceId}/panel/action`, body, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000, // 10초 타임아웃 설정 (10000밀리초)
  });
}

/**
 * Toggle the on/off state of a device.
 * @param accessToken
 * @param serverUrl
 * @param instanceId
 */
export async function setDeviceToggle(accessToken: string, serverUrl: string, instanceId: string) {
  const body = {
    source: 'button', rowId: 0, command: 'toggle', params: null,
  };
  await axios.put(`http://${serverUrl}/api/v1/instance/${instanceId}/panel/action`, body, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000, // 10초 타임아웃 설정 (10000밀리초)
  });
}

/**
 * Set the dim level of a device. Only works for dimmable devices.
 * @param accessToken
 * @param serverUrl
 * @param instanceId
 * @param dim The dim level, between 0 and 100.
 */
export async function setDeviceDim(accessToken: string, serverUrl: string, instanceId: string, dim: number) {
  const body = {
    source: 'slider', rowId: 2, command: 'setLevel', params: { slider: dim },
  };
  await axios.put(`http://${serverUrl}/api/v1/instance/${instanceId}/panel/action`, body, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000, // 10초 타임아웃 설정 (10000밀리초)
  });
}

/**
 * Set the scene of a scene controller.
 * @param accessToken
 * @param serverUrl
 * @param instanceId
 * @param sceneId The scene ID to set. Should be between 0 and 15. (send GOTO SCENE <sceneId> DALI command)
 */
export async function recallScene(accessToken: string, serverUrl: string, instanceId: string, sceneId: number) {
  const rowId = sceneId % 4;
  const body = {
    source: 'button', rowId, command: `setScene${sceneId + 1}`, params: null,
  };
  await axios.put(`http://${serverUrl}/api/v1/instance/${instanceId}/panel/action`, body, {
    headers: { Authorization: `Bearer ${accessToken}` },
    timeout: 10000, // 10초 타임아웃 설정 (10000밀리초)
  });
}
