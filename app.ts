'use strict';

import Homey from 'homey';
import axios from 'axios';


module.exports = class MyApp extends Homey.App {

  private tokenRefreshInterval: NodeJS.Timeout | null = null;

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('MyApp has been initialized');

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
    } else {
      this.log('Initial settings are insufficient for authentication');
    }
  }

  async onSettingsChanged() {
    // 필요한 설정 값들이 모두 존재하는지 확인
    const serverUrl = this.homey.settings.get('server_url');
    const username = this.homey.settings.get('username');
    const password = this.homey.settings.get('password');

    if (serverUrl && username && password) {
      // 기존 토큰 갱신 주기 중지
      this.stopTokenRefreshInterval();

      // 새로운 인증 시도
      await this.authenticate(serverUrl, username, password);

      // 새로운 토큰 갱신 주기 시작
      this.startTokenRefreshInterval();
    } else {
      this.log('Initial settings are insufficient for authentication');
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
      const response = await axios.post(`${serverUrl}/api/v1/auth/refresh`, {
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

  async onUninit() {
    // 앱 종료 시 인터벌 정리
    this.stopTokenRefreshInterval();
  }

};
