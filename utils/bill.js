const { currentProfile } = require('../config/current-miniapp')

const STORAGE_KEY = 'mini-book-tide-data-v1'

function padNumber(value) {
  return String(value).padStart(2, '0')
}

function formatDate(date) {
  const current = date instanceof Date ? date : new Date(date)
  return [
    current.getFullYear(),
    padNumber(current.getMonth() + 1),
    padNumber(current.getDate())
  ].join('-')
}

function formatDateText(dateString) {
  if (!dateString) {
    return ''
  }

  const parts = dateString.split('-')
  if (parts.length !== 3) {
    return dateString
  }

  return parts[0] + '年' + parts[1] + '月' + parts[2] + '日'
}

function formatMonthText(monthString) {
  if (!monthString) {
    return ''
  }

  const parts = monthString.split('-')
  if (parts.length !== 2) {
    return monthString
  }

  return parts[0] + '年' + parts[1] + '月'
}

function getCurrentMonthKey() {
  return formatDate(new Date()).slice(0, 7)
}

function getOffsetDate(days) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

function getMonthStartOffset(monthOffset, day) {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() + monthOffset)
  date.setDate(day)
  return formatDate(date)
}

function toAmount(value) {
  const numeric = Number(value)
  if (!numeric || numeric < 0) {
    return 0
  }
  return Math.round(numeric * 100) / 100
}

function formatAmount(value) {
  return toAmount(value).toFixed(2)
}

function sortBills(list) {
  return list.slice().sort(function(a, b) {
    if (a.date === b.date) {
      return (b.createdAt || 0) - (a.createdAt || 0)
    }
    return a.date < b.date ? 1 : -1
  })
}

function createDemoBills() {
  const now = Date.now()
  return sortBills([
    {
      id: 'demo_1',
      type: 'income',
      category: '工资',
      amount: 6800,
      note: '月初到账',
      date: getMonthStartOffset(0, 3),
      createdAt: now - 900000
    },
    {
      id: 'demo_2',
      type: 'expense',
      category: '餐食',
      amount: 48,
      note: '午间简餐',
      date: getOffsetDate(-1),
      createdAt: now - 800000
    },
    {
      id: 'demo_3',
      type: 'expense',
      category: '通勤',
      amount: 22,
      note: '地铁换乘',
      date: getOffsetDate(-2),
      createdAt: now - 700000
    },
    {
      id: 'demo_4',
      type: 'income',
      category: '兼职',
      amount: 920,
      note: '周末设计稿',
      date: getOffsetDate(-4),
      createdAt: now - 600000
    },
    {
      id: 'demo_5',
      type: 'expense',
      category: '日常',
      amount: 136.5,
      note: '生活用品补货',
      date: getOffsetDate(-6),
      createdAt: now - 500000
    },
    {
      id: 'demo_6',
      type: 'expense',
      category: '学习',
      amount: 88,
      note: '线上课程月卡',
      date: getOffsetDate(-8),
      createdAt: now - 400000
    },
    {
      id: 'demo_7',
      type: 'expense',
      category: '居家',
      amount: 1680,
      note: '房租水电',
      date: getMonthStartOffset(-1, 28),
      createdAt: now - 300000
    },
    {
      id: 'demo_8',
      type: 'income',
      category: '退款',
      amount: 120,
      note: '退货返款',
      date: getMonthStartOffset(-1, 16),
      createdAt: now - 200000
    }
  ])
}

function getDefaultData() {
  return {
    version: 1,
    initializedAt: Date.now(),
    bills: currentProfile && currentProfile.enableMockData ? createDemoBills() : [],
    updatedAt: Date.now()
  }
}

function ensureBookData() {
  const data = wx.getStorageSync(STORAGE_KEY)
  if (!data || !Array.isArray(data.bills)) {
    const defaultData = getDefaultData()
    wx.setStorageSync(STORAGE_KEY, defaultData)
    return defaultData
  }
  if (!(currentProfile && currentProfile.enableMockData)) {
    const hasDemoBills = data.bills.some(bill => bill.id && bill.id.startsWith('demo_'))
    if (hasDemoBills) {
      data.bills = data.bills.filter(bill => !(bill.id && bill.id.startsWith('demo_')))
      data.updatedAt = Date.now()
      wx.setStorageSync(STORAGE_KEY, data)
    }
  }
  return data
}

function getBookData() {
  return ensureBookData()
}

function saveBookData(data) {
  const nextData = {
    version: 1,
    initializedAt: data.initializedAt || Date.now(),
    bills: sortBills(data.bills || []),
    updatedAt: Date.now()
  }

  wx.setStorageSync(STORAGE_KEY, nextData)
  return nextData
}

function getAllBills() {
  return getBookData().bills || []
}

function getBillById(id) {
  return getAllBills().find(function(item) {
    return item.id === id
  })
}

function addBill(payload) {
  const data = getBookData()
  const bill = {
    id: 'bill_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    type: payload.type,
    category: payload.category,
    amount: toAmount(payload.amount),
    note: (payload.note || '').trim(),
    date: payload.date,
    createdAt: Date.now()
  }

  data.bills.unshift(bill)
  saveBookData(data)
  return bill
}

function removeBillById(id) {
  const data = getBookData()
  data.bills = data.bills.filter(function(item) {
    return item.id !== id
  })
  saveBookData(data)
  return data.bills
}

function getSummary(bills) {
  return (bills || []).reduce(function(result, item) {
    const amount = toAmount(item.amount)
    if (item.type === 'income') {
      result.income += amount
    } else {
      result.expense += amount
    }
    result.balance = result.income - result.expense
    result.count += 1
    return result
  }, {
    income: 0,
    expense: 0,
    balance: 0,
    count: 0
  })
}

function getBillsByMonth(monthKey) {
  return getAllBills().filter(function(item) {
    return String(item.date || '').slice(0, 7) === monthKey
  })
}

function getRecentMonths(count) {
  const list = []
  const date = new Date()
  date.setDate(1)

  for (let index = count - 1; index >= 0; index -= 1) {
    const current = new Date(date)
    current.setMonth(current.getMonth() - index)
    list.push(formatDate(current).slice(0, 7))
  }

  return list
}

function groupByCategory(bills, type) {
  const map = {}

  ;(bills || []).forEach(function(item) {
    if (type && item.type !== type) {
      return
    }
    const key = item.category || '未分类'
    map[key] = (map[key] || 0) + toAmount(item.amount)
  })

  return Object.keys(map).map(function(key) {
    return {
      name: key,
      amount: map[key]
    }
  }).sort(function(a, b) {
    return b.amount - a.amount
  })
}

function createDisplayBill(item) {
  return {
    id: item.id,
    type: item.type,
    typeText: item.type === 'income' ? '收入' : '支出',
    category: item.category,
    amount: formatAmount(item.amount),
    note: item.note || '未填写备注',
    date: item.date,
    dateText: formatDateText(item.date)
  }
}

module.exports = {
  STORAGE_KEY,
  formatDate,
  formatDateText,
  formatMonthText,
  formatAmount,
  getCurrentMonthKey,
  getBookData,
  getAllBills,
  getBillById,
  ensureBookData,
  addBill,
  removeBillById,
  getSummary,
  getBillsByMonth,
  getRecentMonths,
  groupByCategory,
  createDisplayBill
}
