const { getBillById, createDisplayBill } = require('../../utils/bill')

Page({
  data: {
    bill: null
  },

  onLoad(options) {
    this.billId = options.id || ''
  },

  onShow() {
    this.loadDetail()
  },

  loadDetail() {
    const bill = getBillById(this.billId)
    if (!bill) {
      this.setData({ bill: null })
      return
    }

    this.setData({
      bill: createDisplayBill(bill)
    })
  },

  goManage() {
    wx.navigateTo({
      url: '/pages/bill-manage/index'
    })
  },

  goBack() {
    wx.navigateBack({
      delta: 1
    })
  }
})
