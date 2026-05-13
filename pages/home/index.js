const {
  ensureBookData,
  getAllBills,
  getCurrentMonthKey,
  getSummary,
  formatAmount,
  formatMonthText,
  createDisplayBill
} = require('../../utils/bill')
const { getCurrentMiniAppProfile } = require('../../utils/runtime-miniapp')
const passcodeAuth = require('../../utils/book-detail/passcode-auth')
const passcodeEntry = require('../../utils/book-detail/passcode-entry')

Page({
  data: {
    appName: '',
    monthLabel: '',
    monthBillCount: 0,
    summary: {
      income: '0.00',
      expense: '0.00',
      balance: '0.00'
    },
    filter: 'all',
    filterTabs: [
      { label: '全部', value: 'all' },
      { label: '收入', value: 'income' },
      { label: '支出', value: 'expense' }
    ],
    recentBills: [],
    recentHint: '最近 0 条',
    passcodeDialogVisible: false,
    passcodeValue: '',
    passcodeError: '',
    passcodeSubmitting: false
  },

  onShow() {
    this.loadMiniAppProfile()
    this.loadPageData()
    this.syncPasscodePrompt()
  },

  syncPasscodePrompt() {
    const promptState = passcodeAuth.consumePrompt()
    if (!promptState) {
      return
    }

    this.setData({
      passcodeDialogVisible: true,
      passcodeValue: '',
      passcodeError: promptState.message || ''
    })
  },

  loadMiniAppProfile() {
    const profile = getCurrentMiniAppProfile()
    const appName = (profile && profile.appName) || '账本'

    this.setData({
      appName
    })
    wx.setNavigationBarTitle({
      title: appName
    })
  },

  loadPageData() {
    ensureBookData()
    const bills = getAllBills()
    const currentMonthKey = getCurrentMonthKey()
    const monthBills = bills.filter(function(item) {
      return String(item.date || '').slice(0, 7) === currentMonthKey
    })
    const monthSummary = getSummary(monthBills)

    this.allBills = bills
    this.setData({
      monthLabel: formatMonthText(currentMonthKey),
      monthBillCount: monthBills.length,
      summary: {
        income: formatAmount(monthSummary.income),
        expense: formatAmount(monthSummary.expense),
        balance: formatAmount(monthSummary.balance)
      }
    })

    this.applyFilter(this.data.filter)
  },

  handleFilterChange(event) {
    this.applyFilter(event.currentTarget.dataset.filter)
  },

  applyFilter(filter) {
    const matchedBills = (this.allBills || []).filter(function(item) {
      return filter === 'all' ? true : item.type === filter
    })

    this.setData({
      filter,
      recentBills: matchedBills.slice(0, 6).map(function(item) {
        return createDisplayBill(item)
      }),
      recentHint: matchedBills.length ? '最近 ' + matchedBills.length + ' 条' : '暂无记录'
    })
  },

  goToDetail(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({
      url: '/pages/bill-detail/index?id=' + id
    })
  },

  noop() {},

  handlePasscodeInput(event) {
    this.setData({
      passcodeValue: event.detail.value,
      passcodeError: ''
    })
  },

  async submitPasscode() {
    if (this.data.passcodeSubmitting) {
      return
    }

    const passcode = String(this.data.passcodeValue || '').trim()
    if (!passcode) {
      this.setData({
        passcodeError: '请输入口令'
      })
      return
    }

    this.setData({
      passcodeSubmitting: true,
      passcodeError: ''
    })

    const result = await passcodeAuth.verifyPasscode(passcode)
    if (!result.success) {
      if (result.reason === 'network') {
        wx.showToast({
          title: result.message || '网络异常，请稍后重试',
          icon: 'none'
        })
      }
      this.setData({
        passcodeValue: '',
        passcodeError: result.message || '口令无效，请重新输入',
        passcodeSubmitting: false
      })
      return
    }

    const app = getApp()
    const layoutResult = app && app.refreshBShellLayout
      ? await app.refreshBShellLayout({
          force: true
        })
      : {
          success: false
        }

    if (!(layoutResult && layoutResult.success)) {
      wx.showToast({
        title: '网络异常，请稍后重试',
        icon: 'none'
      })
      this.setData({
        passcodeSubmitting: false
      })
      return
    }

    this.setData({
      passcodeDialogVisible: false,
      passcodeValue: '',
      passcodeError: '',
      passcodeSubmitting: false
    })
    passcodeEntry.openBShellEntry(result.auth)
  }
})
