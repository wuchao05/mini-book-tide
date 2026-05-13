const auth = require('../../../utils/book-detail/auth')
const CommonApi = require('../../../services/book-detail/api/common')
const { createBShellPage } = require('../../../utils/book-detail/launch-access')
const splayRuntime = require('../../../runtime/book-detail/app-runtime')
const { ensureLayoutConfig, getAuxPageConfig } = require('../../../utils/book-detail/detail-layout')

createBShellPage({
  navigationBarTitleText: '',
  data: {
    consumeList: [],
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
    this.getConsumeList(1)
  },

  async syncPageConfig() {
    await ensureLayoutConfig()
    const pageConfig = getAuxPageConfig('consume_record') || {}
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
    this.getConsumeList(1)
  },

  onReachBottom() {
    if (!this.data.loading && this.data.loadStatus === 'loadmore') {
      this.getConsumeList(this.data.page + 1)
    }
  },

  async getConsumeList(pageNo) {
    if (this.data.loading) {
      return
    }
    this.setData({
      loading: true,
      loadStatus: 'loading',
    })

    try {
      const response = await CommonApi.getConsumeRecord({
        page: pageNo,
        page_size: this.data.pageSize,
      })
      const data = (response.data && response.data.order_list) || []
      const total = (response.data && response.data.total) || 0
      this.setData({
        consumeList: pageNo === 1 ? data : this.data.consumeList.concat(data),
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
