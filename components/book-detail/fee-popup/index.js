Component({
  properties: {
    config: {
      type: Object,
      value: null,
    },
    visible: {
      type: Boolean,
      value: false,
    },
  },

  data: {
    noticeList: [],
  },

  lifetimes: {
    attached() {
      this.syncNoticeList(this.properties.config)
    },
  },

  observers: {
    config(config) {
      this.syncNoticeList(config)
    },
  },

  methods: {
    syncNoticeList(config) {
      const configList = this.properties.config && this.properties.config.items
      if (Array.isArray(configList) && configList.length) {
        this.setData({
          noticeList: configList,
        })
        return
      }

      this.setData({
        noticeList: [
          '1. K币、会员及剧卡属于虚拟商品，1元兑换100K币，剧卡用于解锁整部剧，一经购买不得退换；',
          '2. 充值后到账可能有延迟，2小时内未到账请联系客服；',
          '3. 未满18周岁的未成年人，应在父母或其他监护人监护、指导、同意下进行如付费充值、付费观看等相关操作。',
          '4. 客服工作时间：10:00~22:00',
        ],
      })
    },

    handleClose() {
      this.triggerEvent('close')
    },
  },
})
