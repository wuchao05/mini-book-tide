const auth = require('../../../utils/book-detail/auth')
const CommonApi = require('../../../services/book-detail/api/common')
const contentEntry = require('../../../utils/book-detail/content-entry')
const { createBShellPage } = require('../../../utils/book-detail/launch-access')
const splayRuntime = require('../../../runtime/book-detail/app-runtime')
const {
  ensureLayoutConfig,
  getPageConfig,
  getResolvedTabBarItems,
  getActionPageUrl,
} = require('../../../utils/book-detail/detail-layout')
const { buildBShellPageUrl } = require('../../../utils/shell-pages')

createBShellPage({
  data: {
    loading: false,
    loadingMore: false,
    contentList: [],
    page: 1,
    pageSize: 10,
    totalPage: 0,
    tabBarItems: [],
    pageBackground: '#ffffff',
    emptyState: {},
    listConfig: {},
  },

  async onLoad() {
    await this.syncShellConfig()
  },

  async syncShellConfig() {
    await ensureLayoutConfig()
    const pageConfig = getPageConfig('follow')

    this.setData({
      tabBarItems: getResolvedTabBarItems(),
      pageBackground: (pageConfig.background && pageConfig.background.value) || '#ffffff',
      emptyState: pageConfig.empty_state || {},
      listConfig: pageConfig.list_config || {},
    })
  },

  async onShow() {
    await splayRuntime.ensureStarted()
    await this.syncShellConfig()
    const success = await auth.ensureLogin()
    if (!success) {
      return
    }
    this.resetAndFetch()
  },

  onPullDownRefresh() {
    this.resetAndFetch()
  },

  onReachBottom() {
    if (!this.data.loading && this.data.page < this.data.totalPage) {
      this.fetchListData(this.data.page + 1)
    }
  },

  resetAndFetch() {
    this.setData({
      page: 1,
      totalPage: 0,
      contentList: [],
    })
    this.fetchListData(1)
  },

  async fetchListData(pageNo) {
    this.setData({
      loading: pageNo === 1,
      loadingMore: pageNo > 1,
    })

    try {
      const response = await CommonApi.getHistoryList({
        page: pageNo,
        page_size: this.data.pageSize,
      })
      const data = (response.data && response.data.history_list) || []
      const total = (response.data && response.data.total_num) || 0
      this.setData({
        contentList: pageNo === 1 ? data : this.data.contentList.concat(data),
        page: pageNo,
        totalPage: Math.ceil(total / this.data.pageSize),
      })
    } catch (error) {
      void error
    } finally {
      this.setData({
        loading: false,
        loadingMore: false,
      })
      wx.stopPullDownRefresh()
    }
  },

  handleItemTap(event) {
    contentEntry.openAlbum(Number(event.currentTarget.dataset.id) || 0)
  },

  goToTheater() {
    const emptyStateActionUrl = getActionPageUrl(this.data.emptyState.action)

    wx.reLaunch({
      url: emptyStateActionUrl || buildBShellPageUrl('theater'),
    })
  },
})
