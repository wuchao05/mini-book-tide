const { ensureBookData } = require('./utils/bill');
const { APP_VERSION } = require('./constants');
const splayRuntime = require('./runtime/book-detail/app-runtime');
const { resolveLaunchTarget } = require('./utils/launch-target');
const { getCurrentMiniAppProfile } = require('./utils/runtime-miniapp');
const paymentUtils = require('./utils/book-detail/payment');
const embeddedPayment = require('./utils/book-detail/embedded-payment');
const { buildPageUrl, isDirectBShellPath } = require('./utils/shell-pages');

const DEFAULT_MINIAPP_SHELL_BASE_URL = 'https://edge.penetad.com';
const LAUNCHER_PAGE_PATH = '/pages/launcher/index';

const APP_MODE = {
  ASHELL: 'ashell',
  BSHELL: 'bshell',
};

function normalizeMode(mode) {
  if (mode === APP_MODE.BSHELL) {
    return mode;
  }

  return APP_MODE.ASHELL;
}

function normalizeQueryValue(value) {
  if (value === undefined || value === null) {
    return '';
  }

  return String(value);
}

function isSameRouteQuery(currentOptions, targetQuery) {
  const currentKeys = Object.keys(currentOptions || {});
  const targetKeys = Object.keys(targetQuery || {});

  if (currentKeys.length !== targetKeys.length) {
    return false;
  }

  return targetKeys.every(
    (key) => normalizeQueryValue(currentOptions[key]) === normalizeQueryValue(targetQuery[key]),
  );
}

function hasValidClickId(query) {
  const clickId = String((query && query.clickid) || '').trim();
  return !!clickId && clickId !== '__CLICK_ID__';
}

function buildHotLaunchLauncherQuery(path, query) {
  const nextQuery = Object.assign({}, query || {});

  if (!nextQuery.target_path && isDirectBShellPath(path || '')) {
    nextQuery.target_path = String(path || '').replace(/^\//, '');
  }

  return nextQuery;
}

function getMiniAppShellBaseUrl() {
  const profile = getCurrentMiniAppProfile();
  return (profile && profile.baseUrl) || DEFAULT_MINIAPP_SHELL_BASE_URL;
}

App({
  globalData: {
    version: APP_VERSION,
    currentMode: APP_MODE.ASHELL,
    miniAppShellConfig: null,
    miniAppShellConfigReady: false,
    bShellLayout: null,
    bShellLayoutReady: false,
    launchOptions: {
      path: '',
      query: {},
    },
  },

  onLaunch(options) {
    ensureBookData();
    this.updateLaunchContext(options);
  },

  onShow(options) {
    this.setLaunchOptions(options);
    embeddedPayment.captureEmbeddedPaymentReturn(options);

    if (this._hasShownOnce) {
      this.handleHotLaunch(options);
      return;
    }

    this._hasShownOnce = true;
  },

  async handleHotLaunch(options) {
    const normalizedOptions = options || {
      path: '',
      query: {},
    };
    const launchTarget = resolveLaunchTarget(normalizedOptions.path, normalizedOptions.query);
    const targetPath = launchTarget.entryPath || '';
    const hasDirectBShellTarget = !!targetPath && isDirectBShellPath(targetPath);
    const hasExternalLaunchParams = hasValidClickId(normalizedOptions.query || {});
    const hasLaunchQuery = Object.keys(launchTarget.entryQuery || {}).length > 0;
    const shouldHandleBShellHotLaunch = hasDirectBShellTarget || hasLaunchQuery;
    const hasPaymentReturnGuard = paymentUtils.shouldSkipHotLaunchRedirect();

    if (hasPaymentReturnGuard) {
      paymentUtils.consumeHotLaunchRedirectGuard();
    }

    if (!shouldHandleBShellHotLaunch) {
      return;
    }

    if (hasExternalLaunchParams && hasPaymentReturnGuard) {
      return;
    }

    await splayRuntime.handleAppShow(normalizedOptions);

    if (hasExternalLaunchParams) {
      wx.reLaunch({
        url: buildPageUrl(
          LAUNCHER_PAGE_PATH,
          buildHotLaunchLauncherQuery(normalizedOptions.path, normalizedOptions.query),
        ),
      });
      return;
    }

    if (hasDirectBShellTarget) {
      this.openHotLaunchTarget(targetPath, launchTarget.entryQuery);
      return;
    }

    await splayRuntime.consumeHotLaunchExternalLink();
  },

  openHotLaunchTarget(path, query) {
    const targetUrl = buildPageUrl(path, query);
    if (!targetUrl) {
      return;
    }

    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    const normalizedPath = String(path || '').replace(/^\//, '');

    if (
      currentPage &&
      currentPage.route === normalizedPath &&
      isSameRouteQuery(currentPage.options || {}, query || {})
    ) {
      return;
    }

    if (currentPage && currentPage.route === normalizedPath) {
      wx.redirectTo({
        url: targetUrl,
      });
      return;
    }

    wx.navigateTo({
      url: targetUrl,
    });
  },

  hasActiveBShellSession() {
    return this.globalData.currentMode === APP_MODE.BSHELL;
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
      return Promise.resolve({
        success: false,
        data: this.getMiniAppShellConfig(),
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
            resolve({
              success: false,
              data: this.getMiniAppShellConfig(),
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
          resolve({
            success: false,
            data: this.getMiniAppShellConfig(),
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
      data: this.getMiniAppShellConfig(),
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
      return Promise.resolve({
        success: false,
        data: this.getBShellLayout(),
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
            resolve({
              success: false,
              data: this.getBShellLayout(),
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
          resolve({
            success: false,
            data: this.getBShellLayout(),
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

  updateLaunchContext(options) {
    const normalizedOptions = options || {
      path: '',
      query: {},
    };

    this.globalData.launchOptions = {
      path: normalizedOptions.path || '',
      query: normalizedOptions.query || {},
    };

    if (isDirectBShellPath(normalizedOptions.path || '')) {
      this.globalData.currentMode = APP_MODE.BSHELL;
    }
  },

  setCurrentMode(mode) {
    this.globalData.currentMode = normalizeMode(mode);
  },

  setLaunchOptions(options) {
    const normalizedOptions = options || {
      path: '',
      query: {},
    };

    this.globalData.launchOptions = {
      path: normalizedOptions.path || '',
      query: normalizedOptions.query || {},
    };
  },
});
