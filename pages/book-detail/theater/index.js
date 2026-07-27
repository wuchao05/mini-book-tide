const appStore = require('../../../stores/book-detail/app-store');
const auth = require('../../../utils/book-detail/auth');
const CommonApi = require('../../../services/book-detail/api/common');
const contentEntry = require('../../../utils/book-detail/content-entry');
const { createBShellPage } = require('../../../utils/book-detail/launch-access');
const platform = require('../../../utils/book-detail/platform');
const splayRuntime = require('../../../runtime/book-detail/app-runtime');
const {
  ensureLayoutConfig,
  getBootstrapConfig,
  getPageConfig,
  getResolvedTabBarItems,
  findSection,
  readMappedField,
  buildStandardDramaGroups,
  buildStandardDramaItem,
} = require('../../../utils/book-detail/detail-layout');
const { buildBShellPageUrl, resolveLegacyLink } = require('../../../utils/shell-pages');

const platformInfo = platform.getPlatformInfo();
platformInfo.navBarTotalHeight = platformInfo.statusBarHeight + platformInfo.navBarHeight;
platformInfo.navBarPlaceholderHeight = platformInfo.navBarTotalHeight + 12;
const THEATER_RESUME_FLOAT_STORAGE_KEY = 'splay_theater_resume_float_enabled';

const THEATER_TAB = {
  FEATURED: 0,
  YEAR: 1,
};

function normalizeTheaterTab(tab, enableH5Page) {
  // 年度精选可用时，剧场首页仅展示年度精选列表。
  return enableH5Page ? THEATER_TAB.YEAR : THEATER_TAB.FEATURED;
}

createBShellPage({
  data: {
    platform: platformInfo,
    appStore: {
      isFromExternalLink: false,
      enableH5Page: false,
    },
    activeIndex: 0,
    swiperIndex: 0,
    currentSwiperIndex: 0,
    bannerList: [],
    hotList: [],
    goodList: [],
    yearGoodList: [],
    loadingStatus: 'loading',
    yearLoadingStatus: 'loading',
    page: 1,
    pageSize: 10,
    yearPage: 1,
    yearPageSize: 10,
    isHasH5Permission: false,
    loaded: false,
    revenueDialogVisible: false,
    showResumeCard: false,
    resumeCard: null,
    layoutReady: false,
    h5PermissionReady: false,
    tabBarItems: [],
    pageBackground: '#ffffff',
    allSwitchTabs: [],
    switchTabs: [],
    hotSection: {
      item_schema: {},
    },
    goodSection: {},
    yearSection: {},
    resumeConfig: {},
    revenueDialogConfig: {},
  },

  async onLoad(options) {
    await this.syncShellConfig();
    this.applyInitialTab(options);
  },

  async syncShellConfig() {
    await ensureLayoutConfig();
    const bootstrapConfig = getBootstrapConfig();
    const pageConfig = getPageConfig('theater');
    const switchSection = findSection(pageConfig, 'theater_tabs', 'switch_tabs') || {};
    const hotSection = findSection(pageConfig, 'hot', 'hot_swiper') || {
      item_schema: {},
    };
    const goodSection = findSection(pageConfig, 'selected_list', 'grid_list') || {};
    const yearSection = findSection(pageConfig, 'year_list', 'grid_list') || {};

    this.setData({
      layoutReady: true,
      tabBarItems: getResolvedTabBarItems(),
      pageBackground:
        (pageConfig.background && pageConfig.background.value) ||
        (bootstrapConfig.theme && bootstrapConfig.theme.page_bg_color) ||
        '#ffffff',
      allSwitchTabs: switchSection.items || [],
      switchTabs: this.getVisibleSwitchTabs(switchSection.items || []),
      hotSection,
      goodSection,
      yearSection,
      resumeConfig: (pageConfig.floating && pageConfig.floating.resume_card) || {},
      revenueDialogConfig: (pageConfig.dialogs && pageConfig.dialogs.revenue_dialog) || {},
    });
  },

  applyInitialTab(options) {
    const nextIndex = normalizeTheaterTab(
      options && options.tab,
      this.data.h5PermissionReady && appStore.state.enableH5Page,
    );

    if (nextIndex === this.data.activeIndex) {
      return;
    }

    this.setData({
      activeIndex: nextIndex,
    });
  },

  buildH5ListParams(page, pageSize) {
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
  },

  getMatchedH5FeedCache(params) {
    const cache = appStore.state.h5FeedCache || {};
    if (!cache.ready) {
      return null;
    }
    if (params.page !== cache.page || params.page_size !== cache.pageSize) {
      return null;
    }
    if ((params.app || '') !== (cache.app || '')) {
      return null;
    }
    if ((params.click_id || '') !== (cache.clickId || '')) {
      return null;
    }
    if ((params.promotion_id || '') !== (cache.promotionId || '')) {
      return null;
    }
    if ((params.account_index || '') !== (cache.accountIndex || '')) {
      return null;
    }
    return cache;
  },

  async onShow() {
    await splayRuntime.ensureStarted(getApp().globalData.launchOptions);
    await this.syncShellConfig();
    this.applyPendingTab();
    this.syncGlobalState();
    const loginSuccess = await auth.ensureLogin();
    await Promise.all([this.loadPageData(), this.syncResumeCard(loginSuccess)]);
    this.handleStartupParams();
  },

  applyPendingTab() {
    const pendingTab = appStore.state.pendingTheaterTab;

    if (pendingTab === null || pendingTab === undefined || pendingTab === '') {
      return;
    }

    appStore.update({
      pendingTheaterTab: null,
    });

    const nextIndex = normalizeTheaterTab(
      pendingTab,
      this.data.h5PermissionReady && appStore.state.enableH5Page,
    );

    if (nextIndex === this.data.activeIndex) {
      return;
    }

    this.setData({
      activeIndex: nextIndex,
    });
  },

  onHide() {
    appStore.update({
      isHotLaunch: false,
    });
    wx.hideLoading();
  },

  onReachBottom() {
    if (this.data.appStore.enableH5Page) {
      if (this.data.yearLoadingStatus === 'loadmore') {
        this.setData({
          yearPage: this.data.yearPage + 1,
        });
        this.getYearGoodData();
      }
      return;
    }

    if (this.data.loadingStatus === 'loadmore') {
      this.setData({
        page: this.data.page + 1,
      });
      this.getGoodData();
    }
  },

  syncGlobalState() {
    this.setData({
      appStore: {
        isFromExternalLink: appStore.state.isFromExternalLink,
        enableH5Page: this.data.h5PermissionReady && appStore.state.enableH5Page,
      },
      activeIndex: normalizeTheaterTab(
        this.data.activeIndex,
        this.data.h5PermissionReady && appStore.state.enableH5Page,
      ),
    });
  },

  getVisibleSwitchTabs(switchTabs, enableH5Page = this.data.appStore.enableH5Page) {
    const list = Array.isArray(switchTabs) ? switchTabs : [];
    if (enableH5Page) {
      return list;
    }
    return list.slice(0, THEATER_TAB.YEAR);
  },

  async loadPageData() {
    if (this.data.loaded) {
      return;
    }

    // 先确认年度精选开关；开启后首页只保留年度精选，不再请求推荐内容。
    await this.getYearGoodData();
    if (appStore.state.enableH5Page) {
      this.setData({
        loaded: true,
      });
      return;
    }

    await Promise.all([this.getBannerData(), this.getHotData(), this.getGoodData()]);

    this.setData({
      loaded: true,
    });
  },

  isResumeCardEnabled() {
    return !!wx.getStorageSync(THEATER_RESUME_FLOAT_STORAGE_KEY);
  },

  clearResumeCard() {
    if (!this.data.showResumeCard && !this.data.resumeCard) {
      return;
    }

    this.setData({
      showResumeCard: false,
      resumeCard: null,
    });
  },

  normalizeResumeCard(record) {
    if (!record) {
      return null;
    }

    const resumeConfig = this.data.resumeConfig || {};
    const albumId = Number(record.album_id || record.id || 0);
    const progressText = String(record.watch_progress || '')
      .trim()
      .replace(/^(已)?看到\s*/, '');
    const updateText = String(record.update_text || '').trim();

    if (!albumId) {
      return null;
    }

    return {
      albumId,
      cover: record.cover || '',
      title: record.title || resumeConfig.default_title || '',
      eyebrow: resumeConfig.eyebrow_text || '',
      progressText: progressText
        ? `${resumeConfig.progress_prefix || ''}${progressText}`
        : updateText
          ? `${resumeConfig.update_prefix || ''}${updateText}`
          : resumeConfig.fallback_progress_text || '',
    };
  },

  async syncResumeCard(loginSuccess = true) {
    const shouldShowResumeCard =
      loginSuccess && this.isResumeCardEnabled() && !!appStore.state.enableH5Page;

    if (!shouldShowResumeCard) {
      this.clearResumeCard();
      return;
    }

    try {
      const response = await CommonApi.getHistoryList({
        page: 1,
        page_size: 1,
      });
      const list = (response.data && response.data.history_list) || [];
      const resumeCard = this.normalizeResumeCard(list[0]);

      this.setData({
        showResumeCard: !!resumeCard,
        resumeCard,
      });
    } catch (error) {
      this.clearResumeCard();
    }
  },

  async getBannerData() {
    try {
      const response = await CommonApi.getBanner();
      if (response.code === 0) {
        const bannerSection =
          findSection(getPageConfig('theater'), 'banner', 'banner_swiper') || {};
        const itemSchema = bannerSection.item_schema || {};
        this.setData({
          bannerList: (
            (response.data || []).map((item) => ({
              id: item.id || item.album_id || item.link || '',
              cover: readMappedField(item, itemSchema.image || 'cover', ''),
              link: item.link || '',
            })) || []
          ).filter((item) => item.cover),
        });
      }
    } catch (error) {}
  },

  async getHotData() {
    try {
      const response = await CommonApi.getHotList();
      if (response.code === 0) {
        const groups = buildStandardDramaGroups(
          (response.data && response.data.node_list) || [],
          (this.data.hotSection && this.data.hotSection.group_schema) || {},
          (this.data.hotSection && this.data.hotSection.item_schema) || {},
        );
        this.setData({
          hotList: groups,
        });
      }
    } catch (error) {}
  },

  async getGoodData() {
    this.setData({
      loadingStatus: 'loading',
    });

    try {
      const response = await CommonApi.getAllList({
        page: this.data.page,
        page_size: this.data.pageSize,
      });
      const section = this.data.goodSection || {};
      const list = ((response.data && response.data.list) || []).map((item) =>
        buildStandardDramaItem(item, section.item_schema || {}),
      );
      const goodList = this.data.page === 1 ? list : this.data.goodList.concat(list);
      this.setData({
        goodList,
        loadingStatus: list.length ? 'loadmore' : 'nomore',
      });
    } catch (error) {
      this.setData({
        loadingStatus: 'loadmore',
      });
    }
  },

  async getYearGoodData() {
    this.setData({
      yearLoadingStatus: 'loading',
    });
    const params = this.buildH5ListParams(this.data.yearPage, this.data.yearPageSize);
    const cache = this.getMatchedH5FeedCache(params);
    if (cache) {
      const enableH5Page = !!appStore.state.enableH5Page;
      const section = this.data.yearSection || {};
      appStore.update({
        h5FeedCache: Object.assign({}, cache, {
          ready: false,
        }),
      });
      this.setData({
        yearGoodList: (cache.list || []).map((item) =>
          buildStandardDramaItem(item, section.item_schema || {}),
        ),
        yearLoadingStatus: (cache.list || []).length ? 'loadmore' : 'nomore',
        isHasH5Permission: enableH5Page,
        h5PermissionReady: true,
        switchTabs: this.getVisibleSwitchTabs(this.data.allSwitchTabs, enableH5Page),
        appStore: {
          isFromExternalLink: appStore.state.isFromExternalLink,
          enableH5Page,
        },
        activeIndex: normalizeTheaterTab(this.data.activeIndex, enableH5Page),
      });
      return;
    }

    try {
      const response = await CommonApi.getH5List(params);
      const section = this.data.yearSection || {};
      const list = ((response.data && response.data.list) || []).map((item) =>
        buildStandardDramaItem(item, section.item_schema || {}),
      );
      const yearGoodList = this.data.yearPage === 1 ? list : this.data.yearGoodList.concat(list);
      const enableH5Page = !!(response.data && response.data.enable_h5_page);
      appStore.update({
        enableH5Page,
      });
      this.setData({
        yearGoodList,
        yearLoadingStatus: list.length ? 'loadmore' : 'nomore',
        isHasH5Permission: enableH5Page,
        h5PermissionReady: true,
        switchTabs: this.getVisibleSwitchTabs(this.data.allSwitchTabs, enableH5Page),
        appStore: {
          isFromExternalLink: appStore.state.isFromExternalLink,
          enableH5Page,
        },
        activeIndex: normalizeTheaterTab(this.data.activeIndex, enableH5Page),
      });
    } catch (error) {
      this.setData({
        yearLoadingStatus: 'loadmore',
      });
    }
  },

  async handleStartupParams() {
    await splayRuntime.consumeHotLaunchExternalLink();
  },

  changeActiveIndex(event) {
    const nextIndex = Number(event.currentTarget.dataset.index);
    if (nextIndex === 1 && (!this.data.h5PermissionReady || !this.data.appStore.enableH5Page)) {
      return;
    }
    this.setData({
      activeIndex: nextIndex,
    });
  },

  handleSwiperAnimationFinish(event) {
    this.setData({
      swiperIndex: event.detail.current,
    });
  },

  handleSwiperChange(event) {
    this.setData({
      currentSwiperIndex: event.detail.current,
    });
  },

  handleBannerTap(event) {
    const item = this.data.bannerList[Number(event.currentTarget.dataset.index)];
    if (!item || !item.link) {
      return;
    }
    if (item.link.indexOf('pages/video/video') !== -1) {
      const queryString = item.link.split('?')[1] || '';
      const params = {};
      queryString.split('&').forEach((pair) => {
        const parts = pair.split('=');
        if (parts[0]) {
          params[parts[0]] = parts[1];
        }
      });
      contentEntry.openAlbum(Number(params.id) || 0);
      return;
    }

    const link =
      item.link.indexOf('pages/') === 0 ? resolveLegacyLink(`/${item.link}`) : '/' + item.link;
    wx.navigateTo({
      url: link,
    });
  },

  handlePlayTap(event) {
    contentEntry.openAlbum(Number(event.currentTarget.dataset.id) || 0);
  },

  handleWebPlayTap(event) {
    contentEntry.openAlbumNative(Number(event.currentTarget.dataset.id) || 0);
  },

  handleResumeCardTap() {
    const resumeCard = this.data.resumeCard;

    if (!resumeCard || !resumeCard.albumId) {
      return;
    }

    this.toForecastPage(resumeCard.albumId, resumeCard.episode_no);
  },

  handleResumeCardClose() {
    this.clearResumeCard();
  },

  toForecastPage(id, episode_no) {
    wx.navigateTo({
      url: buildBShellPageUrl('forecast', { album_id: id, episode_index: episode_no - 1 }),
    });
  },

  closeRevenueDialog() {
    this.setData({
      revenueDialogVisible: false,
    });
  },

  handleRevenueDramaTap(event) {
    const drama = event.detail;
    if (drama && drama.id) {
      contentEntry.openAlbum(drama.id);
    }
  },

});
