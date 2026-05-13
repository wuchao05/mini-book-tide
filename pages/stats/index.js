const {
  getAllBills,
  getSummary,
  getCurrentMonthKey,
  getRecentMonths,
  groupByCategory,
  formatAmount,
  formatMonthText
} = require('../../utils/bill')

function createRankList(list) {
  const maxAmount = list.length ? list[0].amount : 0
  return list.slice(0, 5).map(function(item) {
    const width = maxAmount ? Math.max((item.amount / maxAmount) * 100, 12) : 0
    return {
      name: item.name,
      amount: formatAmount(item.amount),
      width: width.toFixed(2) + '%'
    }
  })
}

Page({
  data: {
    overview: {
      totalIncome: '0.00',
      totalExpense: '0.00',
      balance: '0.00',
      count: 0,
      monthIncome: '0.00',
      monthExpense: '0.00',
      monthLabel: ''
    },
    trendList: [],
    expenseRank: [],
    incomeRank: []
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const bills = getAllBills()
    const summary = getSummary(bills)
    const currentMonthKey = getCurrentMonthKey()
    const monthBills = bills.filter(function(item) {
      return String(item.date || '').slice(0, 7) === currentMonthKey
    })
    const monthSummary = getSummary(monthBills)
    const monthKeys = getRecentMonths(6)

    const trendSource = monthKeys.map(function(monthKey) {
      const currentBills = bills.filter(function(item) {
        return String(item.date || '').slice(0, 7) === monthKey
      })
      const currentSummary = getSummary(currentBills)
      return {
        monthKey,
        label: monthKey.slice(5) + '月',
        income: currentSummary.income,
        expense: currentSummary.expense
      }
    })

    const maxAmount = trendSource.reduce(function(result, item) {
      return Math.max(result, item.income, item.expense)
    }, 0)

    const trendList = trendSource.map(function(item) {
      const incomeWidth = maxAmount ? Math.max((item.income / maxAmount) * 100, item.income ? 10 : 0) : 0
      const expenseWidth = maxAmount ? Math.max((item.expense / maxAmount) * 100, item.expense ? 10 : 0) : 0
      return {
        monthKey: item.monthKey,
        label: item.label,
        income: formatAmount(item.income),
        expense: formatAmount(item.expense),
        incomeWidth: incomeWidth.toFixed(2) + '%',
        expenseWidth: expenseWidth.toFixed(2) + '%'
      }
    })

    this.setData({
      overview: {
        totalIncome: formatAmount(summary.income),
        totalExpense: formatAmount(summary.expense),
        balance: formatAmount(summary.balance),
        count: summary.count,
        monthIncome: formatAmount(monthSummary.income),
        monthExpense: formatAmount(monthSummary.expense),
        monthLabel: formatMonthText(currentMonthKey)
      },
      trendList,
      expenseRank: createRankList(groupByCategory(bills, 'expense')),
      incomeRank: createRankList(groupByCategory(bills, 'income'))
    })
  }
})
