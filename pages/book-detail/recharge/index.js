const auth = require('../../../utils/book-detail/auth')
const CommonApi = require('../../../services/book-detail/api/common')
const { createBShellPage } = require('../../../utils/book-detail/launch-access')
const splayRuntime = require('../../../runtime/book-detail/app-runtime')
const { ensureLayoutConfig, getAuxPageConfig } = require('../../../utils/book-detail/detail-layout')

createBShellPage({
  navigationBarTitleText: '',
  data: {
    rechargeList: [],
    loadStatus: 'loadmore',
    loading: false,
    page: 1,
    pageSize: 10,
    totalPage: 0,
    pageConfig: {},
  },

  async onShow() {
    await splayRuntime.ensureStarted()
    await this.syncPageConfig()
    const success = await auth.ensureLogin()
    if (!success) {
      return
    }
    this.getRechargeList(1)
  },

  async syncPageConfig() {
    await ensureLayoutConfig()
    const pageConfig = getAuxPageConfig('recharge_record') || {}
    this.setData({
      pageConfig,
    })
    if (pageConfig.title) {
      wx.setNavigationBarTitle({
        title: pageConfig.title,
      })
    }
  },

  onPullDownRefresh() {
    this.getRechargeList(1)
  },

  onReachBottom() {
    if (!this.data.loading && this.data.loadStatus === 'loadmore') {
      this.getRechargeList(this.data.page + 1)
    }
  },

  async getRechargeList(pageNo) {
    if (this.data.loading) {
      return
    }
    this.setData({
      loading: true,
      loadStatus: 'loading',
    })

    try {
      const response = await CommonApi.getRechargeRecord({
        page: pageNo,
        page_size: this.data.pageSize,
      })
      const data = ((response.data && response.data.list) || []).map((item) =>
        Object.assign({}, item, {
          displayPrice:
            item.pay_type === 1
              ? `${item.price}钻`
              : `￥${(Number(item.price || 0) / 100).toFixed(2)}`,
        }),
      )
      const total = (response.data && response.data.total) || 0
      this.setData({
        rechargeList: pageNo === 1 ? data : this.data.rechargeList.concat(data),
        page: pageNo,
        totalPage: Math.ceil(total / this.data.pageSize),
        loadStatus: pageNo >= Math.ceil(total / this.data.pageSize) ? 'nomore' : 'loadmore',
      })
    } catch (error) {
      this.setData({
        loadStatus: 'loadmore',
      })
    } finally {
      this.setData({
        loading: false,
      })
      wx.stopPullDownRefresh()
    }
  },
})
