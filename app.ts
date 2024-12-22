'use strict';

import Homey from 'homey';
import WebSocketAsPromised from 'websocket-as-promised';
import axios from 'axios';
import WebSocket from 'ws';
import _ from 'lodash';

module.exports = class MyApp extends Homey.App {

  private wsp: WebSocketAsPromised | null = null;
  private reconnectInterval: NodeJS.Timeout | null = null;
  private tokenRefreshInterval: NodeJS.Timeout | null = null;

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    // 설정 변경 감지
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.homey.settings.on('set', this.onSettingsChanged.bind(this));

    // 초기 설정 값 가져오기
    const serverUrl = this.homey.settings.get('server_url');
    const username = this.homey.settings.get('username');
    const password = this.homey.settings.get('password');

    // 설정 값이 모두 존재하는 경우에만 인증 시도
    if (serverUrl && username && password) {
      // 인증 시도
      this.log(`Attempting authentication with initial settings: ${serverUrl}, ${username}`);
      await this.authenticate(serverUrl, username, password);

      // 토큰 갱신 주기 시작
      this.startTokenRefreshInterval();

      // 웹소켓 초기화 및 연결
      await this.initializeWebSocket(serverUrl);
    } else {
      this.log('Initial settings are insufficient for authentication');
    }

    this.log('MyApp has been initialized');
  }

  async onSettingsChanged(key: string) {
    this.log(`Settings have been changed: ${key}`);

    // 서버 주소, 사용자 이름, 비밀번호가 변경된 경우에만 재인증 시도
    if (key === 'server_url' || key === 'username' || key === 'password') {
      // 필요한 설정 값들이 모두 존재하는지 확인
      const serverUrl = this.homey.settings.get('server_url');
      const username = this.homey.settings.get('username');
      const password = this.homey.settings.get('password');

      if (serverUrl && username && password) {
        // 기존 웹소켓 연결 종료
        await this.closeWebSocket();

        // 기존 토큰 갱신 주기 중지
        this.stopTokenRefreshInterval();

        // 새로운 인증 시도
        await this.authenticate(serverUrl, username, password);

        // 새로운 토큰 갱신 주기 시작
        this.startTokenRefreshInterval();

        // 새로운 서버 주소로 웹소켓 초기화 및 연결
        await this.initializeWebSocket(serverUrl);
      }
    }
  }

  async authenticate(serverUrl: string, username: string, password: string) {
    try {
      const response = await axios.post(`http://${serverUrl}/api/v1/auth/login`, {
        username,
        password,
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000, // 10초 타임아웃 설정 (10000밀리초)
      });

      const { accessToken, refreshToken } = response.data;
      this.homey.settings.set('access_token', accessToken); // expires in 2 hours
      this.homey.settings.set('refresh_token', refreshToken); // expires in 7 days
      this.log('Authentication successful');
    } catch (error) {
      if (error instanceof axios.AxiosError) {
        this.error('Error during authentication:', error.message);
      } else {
        this.error('Unexpected error:', error);
      }
    }
  }

  startTokenRefreshInterval() {
    const refreshInterval = 60 * 60 * 1000; // 안전하게 1시간마다 갱신

    this.tokenRefreshInterval = this.homey.setInterval(async () => {
      const refreshToken = this.homey.settings.get('refresh_token');
      if (refreshToken) {
        await this.refreshAccessToken(refreshToken);
      } else {
        this.error('No refresh token available');
      }
    }, refreshInterval);
  }

  stopTokenRefreshInterval() {
    if (this.tokenRefreshInterval) {
      this.homey.clearInterval(this.tokenRefreshInterval);
      this.tokenRefreshInterval = null;
    }
  }

  async refreshAccessToken(refreshToken: string) {
    try {
      const serverUrl = this.homey.settings.get('server_url');
      const response = await axios.post(`http://${serverUrl}/api/v1/auth/refresh`, {
        refreshToken,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10초 타임아웃 설정 (10000밀리초)
      });

      const { accessToken, refreshToken: newRefreshToken } = response.data;
      this.homey.settings.set('access_token', accessToken);
      if (newRefreshToken) {
        this.homey.settings.set('refresh_token', newRefreshToken);
      }
      this.log('Access token refreshed successfully');
    } catch (error) {
      this.error('Error refreshing access token:', error);
    }
  }

  private handleWebSocketMessage(message: {messageType: string, instanceId: number, variableName: string, variableValue: number}) {
    const { instanceId, variableName, variableValue } = message;

    // 나머지는 UI 업데이트용 메시지이므로 무시
    if (message.messageType !== 'variableValue') return;

    const dimmableDevices = this.homey.drivers.getDriver('dimmable').getDevices();
    const groupDevices = this.homey.drivers.getDriver('group').getDevices();
    const allDevices = [...dimmableDevices, ...groupDevices];

    allDevices.forEach((device) => {
      const deviceData = device.getData() as { id: string };
      if (deviceData.id === instanceId.toString()) {
        const dimValue = _.round(variableValue / 100, 2);
        this.log(`Setting ${variableName} of ${device.getName()}(${deviceData.id}) to ${dimValue}`);
        if (dimValue <= 0) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          device.setCapabilityValue('onoff', false);
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          device.setCapabilityValue('dim', 0);
        } else if (dimValue >= 1) {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          device.setCapabilityValue('onoff', true);
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          device.setCapabilityValue('dim', 1);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          device.setCapabilityValue('dim', dimValue);
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          device.setCapabilityValue('onoff', true);
        }
      }
    });

    const bistableDriver = this.homey.drivers.getDriver('bistable').getDevices();
    bistableDriver.forEach((device) => {
      const deviceData = device.getData() as { id: string };
      if (deviceData.id === instanceId.toString()) {
        this.log(`Setting ${variableName} of ${device.getName()}(${deviceData.id}) to ${variableValue}`);
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        device.setCapabilityValue('onoff', variableValue === 1);
      }
    });
  }

  async onUninit() {
    // 앱 종료 시 인터벌 정리
    this.stopTokenRefreshInterval();

    // 웹소켓 연결 종료
    await this.closeWebSocket();
  }

  private async openWebSocket() {
    try {
      if (this.wsp && this.wsp.isClosed) {
        await this.wsp.open();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error('Failed to open WebSocket connection:', message);
    }
  }

  private async initializeWebSocket(serverUrl: string) {
    if (this.wsp) {
      this.log('Closing existing WebSocket connection before initializing a new one');
      await this.closeWebSocket();
    }
    this.wsp = new WebSocketAsPromised(`ws://${serverUrl}/api/v1/stream/instance-values`, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createWebSocket: (url) => (new WebSocket(url) as any),
      extractMessageData: (event) => event,
      unpackMessage: (data) => JSON.parse(data as string),
    });

    this.wsp.onOpen.addListener(() => {
      this.log('WebSocket connection established');
      if (this.reconnectInterval) {
        clearInterval(this.reconnectInterval);
        this.reconnectInterval = null;
      }
    });

    this.wsp.onClose.addListener(() => {
      this.log('WebSocket connection closed, attempting to reconnect...');
      if (!this.reconnectInterval) {
        this.reconnectInterval = this.homey.setInterval(() => this.reconnectWebSocket(), 5000);
      }
    });

    this.wsp.onError.addListener((error: Error) => {
      this.error('WebSocket error:', error.message);
    });

    this.wsp.onUnpackedMessage.addListener((message) => {
      this.handleWebSocketMessage(message);
    });

    await this.openWebSocket();
  }

  private async reconnectWebSocket() {
    this.log('Attempting to reconnect WebSocket...');
    await this.openWebSocket();
  }

  private async closeWebSocket() {
    try {
      if (this.wsp && this.wsp.isOpened) {
        await this.wsp.close();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.error('Failed to close WebSocket connection:', message);
    }
  }

};
