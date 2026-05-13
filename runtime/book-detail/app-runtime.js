const env = require('../../config/book-detail/env');
const appStore = require('../../stores/book-detail/app-store');
const userStore = require('../../stores/book-detail/user-store');
const auth = require('../../utils/book-detail/auth');
const platform = require('../../utils/book-detail/platform');
const CommonApi = require('../../services/book-detail/api/common');
const { getWeixinMiniProgramConfig } = require('../../config/book-detail/wechat-config');

const H5_FEED_FIRST_PAGE_SIZE = 10;

const runtimeState = {
  bootstrapPromise: Promise.resolve(),
  prepared: false,
};

function getDefaultConfig(appid) {
  return getWeixinMiniProgramConfig(appid) || getWeixinMiniProgramConfig(env.appId) || {};
}

async function bootstrap() {
  const appid = getMiniProgramAppId();
  const config = getDefaultConfig(appid);

  if (appid) {
    appStore.update({
      appid,
    });
  }

  try {
    await appStore.initApp({
      appid: appid || env.appId,
      app: config.app || '',
      name: config.name || env.appName,
    });
  } catch (error) {
    console.error('初始化内容应用失败', error);
  }

  try {
    if (appStore.state.token) {
      await userStore.fetchUserInfo();
    } else {
      await auth.doLogin();
    }
  } catch (error) {
    console.error('内容自动登录失败', error);
  }

  await syncH5PageSwitch({
    withList: true,
  });
}

function buildH5FeedParams(page, pageSize) {
  return {
    page,
    page_size: pageSize,
    app: appStore.state.appIdentifier,
  };
}

function buildH5FeedCachePatch(params, list) {
  return {
    ready: true,
    page: params.page,
    pageSize: params.page_size,
    app: params.app || '',
    list: list || [],
  };
}

async function syncH5PageSwitch(options = {}) {
  const { withList = false } = options;
  const params = buildH5FeedParams(1, withList ? H5_FEED_FIRST_PAGE_SIZE : 1);

  try {
    const response = await CommonApi.getH5List(params);

    if (response.code === 0) {
      const enableH5Page = !!(response.data && response.data.enable_h5_page);
      const patch = {
        enableH5Page,
      };

      if (withList) {
        patch.h5FeedCache = buildH5FeedCachePatch(
          params,
          (response.data && response.data.list) || [],
        );
      } else {
        patch.h5FeedCache = Object.assign({}, appStore.state.h5FeedCache, {
          ready: false,
          app: params.app || '',
        });
      }

      appStore.update(patch);
    }
  } catch (error) {
    console.error('同步内容 H5 开关失败', error);
  }
}

function getMiniProgramAppId() {
  try {
    const accountInfo = wx.getAccountInfoSync();
    return accountInfo && accountInfo.miniProgram ? accountInfo.miniProgram.appId : '';
  } catch (error) {
    console.error('获取宿主 appid 失败', error);
    return '';
  }
}

module.exports = {
  onLaunch() {
    appStore.update({
      platformInfo: platform.getPlatformInfo(),
    });
  },

  onShow() {
    runtimeState.bootstrapPromise = bootstrap();
  },

  ensureStarted() {
    if (!runtimeState.prepared) {
      this.onLaunch();
      this.onShow();
      runtimeState.prepared = true;
    }
    return runtimeState.bootstrapPromise || Promise.resolve();
  },

  waitForBootstrap() {
    return runtimeState.bootstrapPromise || Promise.resolve();
  },

};
