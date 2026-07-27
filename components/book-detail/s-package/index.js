const CommonApi = require('../../../services/book-detail/api/common')
const embeddedPayment = require('../../../utils/book-detail/embedded-payment')
const paymentUtils = require('../../../utils/book-detail/payment')
const enums = require('../../../config/book-detail/enums')
const appStore = require('../../../stores/book-detail/app-store')
const userStore = require('../../../stores/book-detail/user-store')
const platform = require('../../../utils/book-detail/platform')

const OLD_PACKAGE_TITLE = '短剧创作不易，感谢您的支持！'
const DEFAULT_PACKAGE_TITLE = '好内容值得支持，感谢您的陪伴！'

function normalizePackageTitle(title) {
  return title === OLD_PACKAGE_TITLE ? DEFAULT_PACKAGE_TITLE : title || ''
}

Component({
  properties: {
    shellConfig: {
      type: Object,
      value: null,
      observer(config) {
        this.setData({
          shellDefaultTitle: normalizePackageTitle(config && config.default_title),
        })
      },
    },
    source: {
      type: String,
      value: enums.PAY_SOURCE.MINE,
    },
    albumId: {
      type: Number,
      value: 0,
    },
    needCoin: {
      type: Number,
      value: 0,
    },
    embedded: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    visible: false,
    tempTitle: '',
    shellDefaultTitle: '',
    defaultTitle: DEFAULT_PACKAGE_TITLE,
    balance: 0,
    packageList: [],
    checkedPackageId: '',
    checkedPackage: null,
    chargeUnitSymbol: '¥',
    feePopupVisible: false,
  },

  methods: {
    async initData(ptl) {
      const info = platform.getPlatformInfo()
      this.setData({
        balance: userStore.state.coin || 0,
        chargeUnitSymbol: info.isIOS ? '¥' : '¥',
      })

      const params = {
        platform: info.isIOS ? 'ios' : info.isAndroid ? 'android' : 'unknown',
        account_index: appStore.state.accountIndex,
      }

      if (ptl) {
        params.ptl = ptl
      }
      if (this.properties.source !== enums.PAY_SOURCE.MINE && this.properties.albumId) {
        params.album_id = this.properties.albumId
      }

      try {
        const response = await CommonApi.getSkuList(params)
        const list = ((response.data && response.data.list) || []).map((item) =>
          Object.assign({}, item, {
            price: Number(item.price) / 100,
            original_price: Number(item.original_price) / 100,
            is_breath: Number(item.is_breath || 0),
            is_highlight: Number(item.is_highlight || 0),
            is_hand: Number(item.is_hand || 0),
          }),
        )
        this.setData({
          tempTitle: normalizePackageTitle(response.data && response.data.title),
          packageList: list.filter((item) => Number(item.price) > 0),
          checkedPackageId: list.length === 1 ? list[0].id : '',
          checkedPackage: list.length === 1 ? list[0] : null,
          balance: userStore.state.coin || 0,
        })
      } catch (error) {
        console.error('获取套餐失败', error)
        this.setData({
          packageList: [],
          checkedPackageId: '',
          checkedPackage: null,
        })
      }
    },

    async open(ptl) {
      await this.initData(ptl)
      this.setData({
        visible: true,
      })
    },

    close(trigger) {
      this.setData({
        visible: false,
        checkedPackageId: '',
        checkedPackage: null,
        feePopupVisible: false,
      })
      this.triggerEvent('close', { type: trigger || '' })
    },

    handleMaskTap() {
      this.close('mask')
    },

    handleSelect(event) {
      const { id } = event.currentTarget.dataset
      const checkedPackage = (this.data.packageList || []).find(
        (item) => String(item.id) === String(id),
      )
      if (checkedPackage && Number(checkedPackage.sku_type) === 3) {
        wx.showToast({
          title: '该场景下暂不可用',
          icon: 'none',
        })
        return
      }
      this.setData({
        checkedPackageId: id,
        checkedPackage,
      })
      this.startPayment()
    },

    async startPayment() {
      const checkedPackage = this.data.checkedPackage
      if (!checkedPackage || !checkedPackage.sku_id) {
        wx.showToast({
          title: '请选择商品',
          icon: 'none',
        })
        return
      }

      wx.showLoading({
        title: '加载中...',
        mask: true,
      })

      if (!appStore.state.config.enableEmbedPayment) {
        paymentUtils.startPayment(
          this.properties.source,
          checkedPackage.sku_id,
          this.properties.source === enums.PAY_SOURCE.MINE ? undefined : this.properties.albumId,
          (status) => {
            wx.hideLoading()
            if (status !== enums.PAY_STATUS.SUCCESS) {
              return
            }
            this.triggerEvent('paystatus', { status })
            this.close('paySuccess')
          },
        )
        return
      }

      const success = await embeddedPayment.launchConfiguredPayment({
        source: this.properties.source,
        bizType: this.properties.source === enums.PAY_SOURCE.MINE ? 'recharge' : 'unlock',
        skuItem: checkedPackage,
        albumId: this.properties.source === enums.PAY_SOURCE.MINE ? undefined : this.properties.albumId,
      })

      wx.hideLoading()
      if (!success) {
        return
      }
    },

    showFeePopup() {
      this.setData({
        feePopupVisible: true,
      })
      this.triggerEvent('showfeepopup')
    },

    closeFeePopup() {
      this.setData({
        feePopupVisible: false,
      })
    },
  },
})
