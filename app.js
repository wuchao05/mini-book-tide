const { ensureBookData } = require('./utils/bill');
const { APP_VERSION } = require('./constants');
const { getCurrentMiniAppProfile } = require('./utils/runtime-miniapp');
const embeddedPayment = require('./utils/book-detail/embedded-payment');

const DEFAULT_MINIAPP_SHELL_BASE_URL = 'https://edge.penetad.com';
const LAUNCHER_PAGE_PATH = '/pages/launcher/index';

function getMiniAppShellBaseUrl() {
  const profile = getCurrentMiniAppProfile();
  return (profile && profile.baseUrl) || DEFAULT_MINIAPP_SHELL_BASE_URL;
}

function normalizePagePath(path) {
  return String(path || '').replace(/^\//, '');
}

App({
  globalData: {
    version: APP_VERSION,
    miniAppShellConfig: null,
    miniAppShellConfigReady: false,
    bShellLayout: null,
    bShellLayoutReady: false,
    bShellPasscodePrompt: null,
  },

  onLaunch() {
    ensureBookData();
  },

  onShow(options) {
    embeddedPayment.captureEmbeddedPaymentReturn(options);

    const hasShownOnce = !!this._hasShownOnce;
    this._hasShownOnce = true;

    if (hasShownOnce || this.shouldRouteLaunchThroughLauncher(options)) {
      this.relaunchLauncher(options);
    }
  },

  shouldRouteLaunchThroughLauncher(options) {
    const path = normalizePagePath(options && options.path);
    if (!path || path === normalizePagePath(LAUNCHER_PAGE_PATH)) {
      return false;
    }
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    return !currentPage || currentPage.route !== normalizePagePath(LAUNCHER_PAGE_PATH);
  },

  relaunchLauncher(options) {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage && currentPage.route === normalizePagePath(LAUNCHER_PAGE_PATH)) {
      return;
    }

    wx.reLaunch({
      url: LAUNCHER_PAGE_PATH,
    });
  },

  getMiniAppShellRequestOptions() {
    const profile = getCurrentMiniAppProfile();
    const appIdentifier = (profile && profile.appIdentifier) || '';
    const baseUrl = getMiniAppShellBaseUrl();

    if (!appIdentifier) {
      return null;
    }

    return {
      appIdentifier,
      url: `${baseUrl}/miniapp/bootstrap?app=${encodeURIComponent(appIdentifier)}`,
      timeout: 10000,
    };
  },

  getBShellLayoutRequestOptions() {
    const profile = getCurrentMiniAppProfile();
    const appIdentifier = (profile && profile.appIdentifier) || '';
    const baseUrl = getMiniAppShellBaseUrl();

    if (!appIdentifier) {
      return null;
    }

    return {
      appIdentifier,
      url: `${baseUrl}/miniapp/layout?app=${encodeURIComponent(appIdentifier)}`,
      timeout: 10000,
    };
  },

  setMiniAppShellConfig(config) {
    const normalizedConfig = config && typeof config === 'object' ? config : null;

    this.globalData.miniAppShellConfig = normalizedConfig;
    this.globalData.miniAppShellConfigReady = true;

    if (!normalizedConfig || normalizedConfig.mode !== 'B') {
      this.globalData.bShellLayout = null;
      this.globalData.bShellLayoutReady = false;
      return;
    }
  },

  getMiniAppShellConfig() {
    return this.globalData.miniAppShellConfig;
  },

  requestMiniAppShellConfig() {
    const requestOptions = this.getMiniAppShellRequestOptions();

    if (!requestOptions) {
      console.warn('动态壳启动配置请求参数缺失');
      this.setMiniAppShellConfig(null);
      return Promise.resolve({
        success: false,
        data: null,
      });
    }

    return new Promise((resolve) => {
      wx.request({
        url: requestOptions.url,
        method: 'GET',
        timeout: requestOptions.timeout,
        success: (response) => {
          const data = response && response.data;
          if (!(data && data.code === 0 && data.data)) {
            console.warn('动态壳启动配置返回异常', data);
            this.setMiniAppShellConfig(null);
            resolve({
              success: false,
              data: null,
            });
            return;
          }

          this.setMiniAppShellConfig(data.data);
          resolve({
            success: true,
            data: data.data,
          });
        },
        fail: (error) => {
          console.warn('获取动态壳启动配置失败', error);
          this.setMiniAppShellConfig(null);
          resolve({
            success: false,
            data: null,
          });
        },
      });
    });
  },

  refreshMiniAppShellConfig(options = {}) {
    const { force = false } = options;

    if (!force && this._refreshMiniAppShellConfigPromise) {
      return this._refreshMiniAppShellConfigPromise;
    }

    const requestPromise = this.requestMiniAppShellConfig();

    if (force) {
      return requestPromise;
    }

    this._refreshMiniAppShellConfigPromise = requestPromise.finally(() => {
      this._refreshMiniAppShellConfigPromise = null;
    });

    return this._refreshMiniAppShellConfigPromise;
  },

  async fetchMiniAppShellConfigWithRetry(retryCount = 1) {
    let result = {
      success: false,
      data: null,
    };

    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      result = await this.refreshMiniAppShellConfig({
        force: true,
      });

      if (result.success) {
        return result;
      }
    }

    return result;
  },

  setBShellLayout(layout) {
    this.globalData.bShellLayout = layout && typeof layout === 'object' ? layout : null;
    this.globalData.bShellLayoutReady = !!this.globalData.bShellLayout;
  },

  getBShellLayout() {
    return this.globalData.bShellLayout;
  },

  requestBShellLayout() {
    const requestOptions = this.getBShellLayoutRequestOptions();

    if (!requestOptions) {
      console.warn('动态壳布局配置请求参数缺失');
      this.setBShellLayout(null);
      return Promise.resolve({
        success: false,
        data: null,
      });
    }

    return new Promise((resolve) => {
      wx.request({
        url: requestOptions.url,
        method: 'GET',
        timeout: requestOptions.timeout,
        success: (response) => {
          const data = response && response.data;
          if (!(data && data.code === 0 && data.data)) {
            console.warn('动态壳布局配置返回异常', data);
            this.setBShellLayout(null);
            resolve({
              success: false,
              data: null,
            });
            return;
          }

          this.setBShellLayout(data.data);
          resolve({
            success: true,
            data: data.data,
          });
        },
        fail: (error) => {
          console.warn('获取动态壳布局配置失败', error);
          this.setBShellLayout(null);
          resolve({
            success: false,
            data: null,
          });
        },
      });
    });
  },

  refreshBShellLayout(options = {}) {
    const { force = false } = options;

    if (!force && this._refreshBShellLayoutPromise) {
      return this._refreshBShellLayoutPromise;
    }

    const requestPromise = this.requestBShellLayout();

    if (force) {
      return requestPromise;
    }

    this._refreshBShellLayoutPromise = requestPromise.finally(() => {
      this._refreshBShellLayoutPromise = null;
    });

    return this._refreshBShellLayoutPromise;
  },

  async ensureBShellLayout(options = {}) {
    const { forceRefresh = false } = options;

    if (!this.globalData.miniAppShellConfigReady || forceRefresh) {
      const shellResult = await this.refreshMiniAppShellConfig({
        force: !!forceRefresh,
      });

      if (!(shellResult.success && shellResult.data && shellResult.data.mode === 'B')) {
        return this.getBShellLayout();
      }
    }

    if (!this.globalData.bShellLayoutReady || forceRefresh) {
      const result = await this.refreshBShellLayout({
        force: !!forceRefresh,
      });

      if (result.success) {
        return result.data;
      }
    }

    return this.getBShellLayout();
  },

});
