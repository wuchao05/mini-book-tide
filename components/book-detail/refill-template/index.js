const embeddedPayment = require('../../../utils/book-detail/embedded-payment')
const paymentUtils = require('../../../utils/book-detail/payment')
const enums = require('../../../config/book-detail/enums')
const appStore = require('../../../stores/book-detail/app-store')

Component({
  properties: {
    show: {
      type: Boolean,
      value: false,
    },
    episodeList: {
      type: Array,
      value: [],
    },
    swipeIndex: {
      type: Number,
      value: 0,
    },
    userInfo: {
      type: Object,
      value: null,
    },
    rechargeInfo: {
      type: Object,
      value: null,
    },
  },

  data: {
    showChargeNotice: false,
    isPaying: false,
  },

  methods: {
    noop() {},

    async payItem(event) {
      const item = event.currentTarget.dataset.item
      if (!item || !item.sku_id) {
        return
      }

      if (this.data.isPaying) {
        wx.showToast({
          title: '支付进行中，请稍候',
          icon: 'none',
        })
        return
      }

      const albumId = appStore.state.currentData && appStore.state.currentData.id
      const episodeIndex = this.properties.swipeIndex || 0

      this.setData({
        isPaying: true,
      })

      wx.showLoading({
        title: '加载中...',
        mask: true,
      })

      if (!appStore.state.config.enableEmbedPayment) {
        paymentUtils.startPayment(
          enums.PAY_SOURCE.FORECAST,
          item.sku_id,
          Number(albumId || 0),
          (status) => {
            wx.hideLoading()
            this.setData({
              isPaying: false,
            })

            if (status !== enums.PAY_STATUS.SUCCESS) {
              return
            }

            this.triggerEvent('paymentReturn', {
              status,
              episodeIndex: String(episodeIndex),
            })
          },
        )
        return
      }

      const success = await embeddedPayment.launchEmbeddedPayment({
        source: enums.PAY_SOURCE.FORECAST,
        bizType: 'unlock',
        skuItem: item,
        albumId: Number(albumId || 0),
        episodeIndex: Number(episodeIndex || 0),
        selectedSku: {
          id: item.id,
          title: item.title || '',
          subTitle: item.sub_title || '',
          price: Number(item.price || 0) / 100,
          originalPrice: item.original_price ? Number(item.original_price) / 100 : undefined,
          giveCoin: item.give_coin === undefined ? undefined : Number(item.give_coin),
          vipDay: item.vip_day === undefined ? undefined : Number(item.vip_day),
          skuType: item.sku_type === undefined ? undefined : Number(item.sku_type),
        },
      })

      wx.hideLoading()
      this.setData({
        isPaying: false,
      })

      if (!success) {
        return
      }
    },

    closeModal() {
      if (this.data.isPaying) {
        wx.showToast({
          title: '支付进行中，请稍候',
          icon: 'none',
        })
        return
      }
      this.triggerEvent('close')
    },

    openChargeNotice() {
      this.setData({
        showChargeNotice: true,
      })
    },

    closeChargeNotice() {
      this.setData({
        showChargeNotice: false,
      })
    },
  },
})
