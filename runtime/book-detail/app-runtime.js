const env = require('../../config/book-detail/env');
const appStore = require('../../stores/book-detail/app-store');
const userStore = require('../../stores/book-detail/user-store');
const auth = require('../../utils/book-detail/auth');
const contentEntry = require('../../utils/book-detail/content-entry');
const platform = require('../../utils/book-detail/platform');
const CommonApi = require('../../services/book-detail/api/common');
const { getWeixinMiniProgramConfig } = require('../../config/book-detail/wechat-config');

const H5_FEED_FIRST_PAGE_SIZE = 10;

const runtimeState = {
  bootstrapPromise: Promise.resolve(),
  prepared: false,
};

function hasValidClickId(query) {
  const clickId = String((query && query.clickid) || '').trim();
  return !!clickId && clickId !== '__CLICK_ID__';
}

function getDefaultConfig(appid) {
  return getWeixinMiniProgramConfig(appid) || getWeixinMiniProgramConfig(env.appId) || {};
}

async function bootstrap(options) {
  handleStartupParams(options, true);

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
    click_id: (appStore.state.startParam && appStore.state.startParam.clickid) || '',
    promotion_id:
      (appStore.state.startParam &&
        (appStore.state.startParam.promotionid || appStore.state.startParam.promotion_id)) ||
      '',
    account_index: appStore.state.accountIndex || '',
  };
}

function buildH5FeedCachePatch(params, list) {
  return {
    ready: true,
    page: params.page,
    pageSize: params.page_size,
    app: params.app || '',
    clickId: params.click_id || '',
    promotionId: params.promotion_id || '',
    accountIndex: params.account_index || '',
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
          clickId: params.click_id || '',
          promotionId: params.promotion_id || '',
          accountIndex: params.account_index || '',
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

function handleStartupParams(options, isHotLaunch) {
  const query = (options && options.query) || {};
  const isFromExternalLink = hasValidClickId(query);
  const hasQuery = !!query && Object.keys(query).length > 0;

  if (!isHotLaunch) {
    appStore.update({
      isFromExternalLink,
      hasProcessedExternalLink: false,
      startParam: query,
      accountIndex: query.account_index || '',
    });
    return;
  }

  appStore.update({
    isHotLaunch: hasQuery,
    isFromExternalLink,
    startParam: query,
    accountIndex: query.account_index || '',
    hasProcessedExternalLink: false,
  });
}

async function consumeHotLaunchExternalLink() {
  if (
    !appStore.state.isHotLaunch ||
    !appStore.state.isFromExternalLink ||
    appStore.state.hasProcessedExternalLink
  ) {
    return false;
  }

  appStore.update({
    hasProcessedExternalLink: true,
  });

  await auth.ensureLogin();

  const startParam = appStore.state.startParam || {};
  const directAlbumId = Number(startParam.album_id || 0);

  if (directAlbumId) {
    contentEntry.openAlbum(directAlbumId, {
      replaceCurrent: true,
    });
    return true;
  }

  if (!startParam.id) {
    return false;
  }

  const reportResult = await contentEntry.reportClick(startParam);
  if (!reportResult) {
    return false;
  }

  const targetAlbumId = appStore.state.enableH5Page
    ? Number(reportResult.webview_album_id || reportResult.album_id || 0)
    : Number(reportResult.album_id || 0);

  if (targetAlbumId) {
    contentEntry.openAlbum(targetAlbumId, {
      replaceCurrent: true,
    });
    return true;
  }

  contentEntry.openAlbum(startParam.id, {
    replaceCurrent: true,
  });
  return true;
}

module.exports = {
  onLaunch(options) {
    appStore.update({
      platformInfo: platform.getPlatformInfo(),
    });
    handleStartupParams(options, false);
  },

  onShow(options) {
    runtimeState.bootstrapPromise = bootstrap(options);
  },

  ensureStarted(options) {
    if (!runtimeState.prepared) {
      this.onLaunch(options);
      this.onShow(options);
      runtimeState.prepared = true;
    }
    return runtimeState.bootstrapPromise || Promise.resolve();
  },

  waitForBootstrap() {
    return runtimeState.bootstrapPromise || Promise.resolve();
  },

  handleAppShow(options) {
    if (!runtimeState.prepared) {
      return this.ensureStarted(options);
    }

    handleStartupParams(options, true);
    runtimeState.bootstrapPromise = Promise.resolve().then(() =>
      syncH5PageSwitch({
        withList: true,
      }),
    );
    return runtimeState.bootstrapPromise;
  },

  consumeHotLaunchExternalLink,
};
