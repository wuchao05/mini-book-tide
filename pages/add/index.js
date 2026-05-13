const { addBill, formatDate } = require('../../utils/bill')

const CATEGORY_MAP = {
  expense: ['餐食', '通勤', '日常', '居家', '学习', '娱乐'],
  income: ['工资', '兼职', '奖金', '退款', '转账', '其他']
}

Page({
  data: {
    type: 'expense',
    typeTabs: [
      { label: '支出', value: 'expense' },
      { label: '收入', value: 'income' }
    ],
    categoryMap: CATEGORY_MAP,
    category: '餐食',
    amount: '',
    note: '',
    date: formatDate(new Date())
  },

  handleTypeChange(event) {
    const type = event.currentTarget.dataset.type
    this.setData({
      type,
      category: CATEGORY_MAP[type][0]
    })
  },

  handleCategoryChange(event) {
    this.setData({
      category: event.currentTarget.dataset.category
    })
  },

  handleAmountInput(event) {
    this.setData({
      amount: event.detail.value
    })
  },

  handleNoteInput(event) {
    this.setData({
      note: event.detail.value
    })
  },

  handleDateChange(event) {
    this.setData({
      date: event.detail.value
    })
  },

  submitBill() {
    const amount = Number(this.data.amount)
    if (!amount || amount <= 0) {
      wx.showToast({
        title: '请输入正确金额',
        icon: 'none'
      })
      return
    }

    addBill({
      type: this.data.type,
      category: this.data.category,
      amount,
      note: this.data.note,
      date: this.data.date
    })

    wx.showToast({
      title: '已保存',
      icon: 'success'
    })

    this.setData({
      amount: '',
      note: '',
      category: CATEGORY_MAP[this.data.type][0],
      date: formatDate(new Date())
    })

    setTimeout(function() {
      wx.switchTab({
        url: '/pages/home/index'
      })
    }, 450)
  }
})
