const { getAllBills, getSummary, formatAmount } = require('../../utils/bill')
const { getCurrentMiniAppProfile } = require('../../utils/runtime-miniapp')

Page({
  data: {
    appName: '',
    summary: {
      income: '0.00',
      expense: '0.00',
      count: 0
    },
    menuList: [
      {
        title: '账单管理',
        tag: 'LIST',
        url: '/pages/bill-manage/index'
      },
      {
        title: '数据统计',
        tag: 'TREND',
        url: '/pages/stats/index'
      },
      {
        title: '关于账本',
        tag: 'INFO',
        url: '/pages/about/index'
      }
    ]
  },

  onShow() {
    this.loadMiniAppProfile()
    this.loadSummary()
  },

  loadMiniAppProfile() {
    const profile = getCurrentMiniAppProfile()
    const appName = (profile && profile.appName) || '账本'

    this.setData({
      appName,
      menuList: this.data.menuList.map(function(item) {
        if (item.tag !== 'INFO') {
          return item
        }

        return Object.assign({}, item, {
          title: '关于' + appName
        })
      })
    })
  },

  loadSummary() {
    const bills = getAllBills()
    const summary = getSummary(bills)
    this.setData({
      summary: {
        income: formatAmount(summary.income),
        expense: formatAmount(summary.expense),
        count: summary.count
      }
    })
  },

  goPage(event) {
    wx.navigateTo({
      url: event.currentTarget.dataset.url
    })
  }
})
