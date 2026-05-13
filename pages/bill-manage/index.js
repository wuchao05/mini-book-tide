const {
  getAllBills,
  getSummary,
  createDisplayBill,
  removeBillById,
  formatAmount
} = require('../../utils/bill')

Page({
  data: {
    filter: 'all',
    filterTabs: [
      { label: '全部', value: 'all' },
      { label: '收入', value: 'income' },
      { label: '支出', value: 'expense' }
    ],
    summary: {
      count: 0,
      income: '0.00',
      expense: '0.00'
    },
    bills: []
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const allBills = getAllBills()
    const summary = getSummary(allBills)
    this.allBills = allBills
    this.setData({
      summary: {
        count: summary.count,
        income: formatAmount(summary.income),
        expense: formatAmount(summary.expense)
      }
    })
    this.applyFilter(this.data.filter)
  },

  applyFilter(filter) {
    const bills = (this.allBills || []).filter(function(item) {
      return filter === 'all' ? true : item.type === filter
    }).map(function(item) {
      return createDisplayBill(item)
    })

    this.setData({
      filter,
      bills
    })
  },

  handleFilterChange(event) {
    this.applyFilter(event.currentTarget.dataset.filter)
  },

  goDetail(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/bill-detail/index?id=' + id
    })
  },

  deleteBill(event) {
    const id = event.currentTarget.dataset.id
    wx.showModal({
      title: '删除账单',
      content: '删除后该账单将不再显示，是否继续？',
      success: (result) => {
        if (!result.confirm) {
          return
        }

        removeBillById(id)
        wx.showToast({
          title: '已删除',
          icon: 'success'
        })
        this.loadData()
      }
    })
  }
})
