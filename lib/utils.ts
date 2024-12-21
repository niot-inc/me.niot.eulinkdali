'use strict';

import axios from 'axios';

export interface DaliDevice {
  general: {
    // 장치의 고유 식별자
    instanceId: number;
  };
  device: {
    // 장치의 템플릿 식별자: daliDimmableGroup, daliDimmableLight, daliBistableLight
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
