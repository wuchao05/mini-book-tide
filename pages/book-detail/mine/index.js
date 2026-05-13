const auth = require('../../../utils/book-detail/auth')
const appStore = require('../../../stores/book-detail/app-store')
const userStore = require('../../../stores/book-detail/user-store')
const CommonApi = require('../../../services/book-detail/api/common')
const paymentUtils = require('../../../utils/book-detail/payment')
const embeddedPayment = require('../../../utils/book-detail/embedded-payment')
const platform = require('../../../utils/book-detail/platform')
const enums = require('../../../config/book-detail/enums')
const { createBShellPage } = require('../../../utils/book-detail/launch-access')
const splayRuntime = require('../../../runtime/book-detail/app-runtime')
const {
  ensureLayoutConfig,
  getBootstrapConfig,
  getPageConfig,
  getAuxPageConfig,
  getResolvedTabBarItems,
} = require('../../../utils/book-detail/detail-layout')
const { buildBShellPageUrl } = require('../../../utils/shell-pages')
const { isDevelopEnv } = require('../../../utils/runtime-miniapp')

function createDevMenuItem() {
  return {
    key: 'clear-cache',
    name: '清除缓存',
    icon: '/assets/book-detail/s_icon_emoji.png',
    isClearCache: true,
    isDevOnly: true,
  }
}

createBShellPage({
  data: {
    platform: platform.getPlatformInfo(),
    navTop: platform.getPlatformInfo().statusBarHeight + platform.getPlatformInfo().navBarHeight + 10,
    userInfo: {},
    coin: 0,
    isFree: false,
    menuList: [],
    tabBarItems: [],
    pageBackground: '#f8f8fa',
    headerConfig: {},
    balanceCard: {},
    vipCard: {},
    commonArrowIcon: '',
    paymentPopupConfig: null,
  },

  async onLoad() {
    await this.syncShellConfig()
  },

  async onShow() {
    await splayRuntime.ensureStarted()
    await this.syncShellConfig()
    const success = await auth.ensureLogin()
    if (!success) {
      return
    }
    await this.loadUserInfo()
    await this.consumeEmbeddedPaymentResult()
  },

  async syncShellConfig() {
    await ensureLayoutConfig()
    const bootstrapConfig = getBootstrapConfig()
    const pageConfig = getPageConfig('mine')
    const accountCards = pageConfig.account_cards || []
    const menus = (pageConfig.menus || []).map((item) => {
      const actionType = item.action && item.action.type
      return Object.assign({}, item, {
        isCustomer: actionType === 'contact',
        isFavorite: actionType === 'favorite_tip',
      })
    })

    if (this.isDevEnv()) {
      menus.push(createDevMenuItem())
    }

    this.setData({
      tabBarItems: getResolvedTabBarItems(),
      pageBackground: (pageConfig.background && pageConfig.background.value) || '#f8f8fa',
      headerConfig: pageConfig.header || {},
      balanceCard: accountCards[0] || {},
      vipCard: accountCards[1] || {},
      menuList: menus,
      commonArrowIcon:
        (bootstrapConfig.assets && bootstrapConfig.assets.common_arrow_icon) || '',
      paymentPopupConfig: getAuxPageConfig('payment_popup') || null,
    })
  },

  async loadUserInfo() {
    await userStore.fetchUserInfo()
    this.setData({
      userInfo: userStore.state.userInfo || {},
      coin: userStore.state.coin || 0,
      isFree: !!appStore.state.config.isFree,
    })
  },

  async handleMenuTap(event) {
    const item = this.data.menuList[Number(event.currentTarget.dataset.index)]
    if (!item) {
      return
    }

    if (item.isClearCache) {
      this.handleClearCache()
      return
    }

    if (item.action && item.action.type === 'navigate_page') {
      const pageKey = item.action.params && item.action.params.page_key
      const targetUrl = buildBShellPageUrl(pageKey)
      if (targetUrl) {
        wx.navigateTo({
          url: targetUrl,
        })
      }
      return
    }

    if (item.action && item.action.type === 'favorite_tip') {
      wx.showToast({
        title: '点击右上角“...”，选择“收藏”即可',
        icon: 'none',
      })
    }
  },

  async goToCharge() {
    const supported = paymentUtils.checkGlobalPaymentSupport()
    if (!supported) {
      return
    }

    let ptl = ''
    if (appStore.state.config.isFree) {
      const response = await CommonApi.getPopSkuInfo()
      ptl = response.data ? response.data.bind_tpl_code || '' : ''
      if (!ptl) {
        return
      }
    }

    const packagePopup = this.selectComponent('#packagePopup')
    if (packagePopup) {
      packagePopup.open(ptl)
    }
  },

  async consumeEmbeddedPaymentResult() {
    const result = embeddedPayment.consumeMatchedReturnResult({
      source: enums.PAY_SOURCE.MINE,
    })
    if (!result || result.payStatus !== enums.PAY_STATUS.SUCCESS) {
      return
    }
    const packagePopup = this.selectComponent('#packagePopup')
    if (packagePopup) {
      packagePopup.close('paymentSuccess')
    }
    await this.handlePayStatus({
      detail: {
        status: result.payStatus,
      },
    })
  },

  async handlePayStatus(event) {
    if (event.detail.status === enums.PAY_STATUS.SUCCESS) {
      await this.loadUserInfo()
      wx.showToast({
        title: '充值成功',
        icon: 'success',
      })
    }
  },

  handleClearCache() {
    if (!this.isDevEnv()) {
      wx.showToast({
        title: '仅开发环境可用',
        icon: 'none',
      })
      return
    }

    wx.showModal({
      title: '清除缓存',
      content: '将清除内容授权标识，确认继续吗？',
      success: (result) => {
        if (!result.confirm) {
          return
        }

        wx.showToast({
          title: '缓存已清除',
          icon: 'none',
        })
      },
    })
  },

  isDevEnv() {
    return isDevelopEnv()
  },
})
