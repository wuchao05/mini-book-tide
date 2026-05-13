const userStore = require('../../stores/book-detail/user-store')
const { getCurrentMiniAppProfile, isDevelopEnv } = require('../runtime-miniapp')

const EMBEDDED_PAYMENT_APP_ID = 'wxb6109138e25d824b'
const EMBEDDED_PAYMENT_PAGE_PATH = 'pages/embedded-pay/index'
const EMBEDDED_PAYMENT_PROTOCOL = 'embedded-pay/v1'
const PENDING_KEY = 'book_detail_embedded_payment_pending'
const RESULT_KEY = 'book_detail_embedded_payment_result'

function createRequestId() {
  return ['embedded', Date.now(), Math.random().toString(16).slice(2, 10)].join('_')
}

function safeStringify(data) {
  try {
    return JSON.stringify(data)
  } catch (error) {
    console.error('序列化半屏支付数据失败', error)
    return ''
  }
}

function logJson(label, data) {
  const serialized = safeStringify(data)
  if (!serialized) {
    return
  }
  console.log(label + ' ' + serialized)
}

function safeParse(raw) {
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw)
  } catch (error) {
    console.error('解析半屏支付数据失败', error)
    return null
  }
}

function writeStorage(key, data) {
  try {
    const serialized = safeStringify(data)
    if (!serialized) {
      return false
    }
    wx.setStorageSync(key, serialized)
    return true
  } catch (error) {
    console.error('写入半屏支付存储失败', key, error)
    return false
  }
}

function readStorage(key) {
  try {
    return safeParse(wx.getStorageSync(key))
  } catch (error) {
    console.error('读取半屏支付存储失败', key, error)
    return null
  }
}

function removeStorage(key) {
  try {
    wx.removeStorageSync(key)
  } catch (error) {
    console.error('清理半屏支付存储失败', key, error)
  }
}

function getBookMiniProgramApp() {
  const profile = getCurrentMiniAppProfile()
  return (profile && profile.appIdentifier) || ''
}

async function ensureBookUserInfo() {
  const currentUserInfo = userStore.state.userInfo
  if (currentUserInfo && currentUserInfo.user_id !== undefined && currentUserInfo.user_id !== null) {
    return currentUserInfo
  }

  const success = await userStore.fetchUserInfo()
  if (!success) {
    return null
  }

  const userInfo = userStore.state.userInfo
  if (userInfo && userInfo.user_id !== undefined && userInfo.user_id !== null) {
    return userInfo
  }

  return null
}

function normalizeOptionalNumber(value) {
  if (value === undefined || value === null || value === '') {
    return undefined
  }
  const numericValue = Number(value)
  if (Number.isNaN(numericValue)) {
    return undefined
  }
  return numericValue
}

function buildSelectedSku(item) {
  if (!item || typeof item !== 'object') {
    return null
  }

  return {
    id: item.id,
    title: item.title || '',
    subTitle: item.sub_title || item.subTitle || '',
    price: item.price === undefined || item.price === null ? undefined : Number(item.price),
    originalPrice:
      item.original_price === undefined || item.original_price === null
        ? undefined
        : Number(item.original_price),
    giveCoin: item.give_coin === undefined || item.give_coin === null ? undefined : Number(item.give_coin),
    vipDay: item.vip_day === undefined || item.vip_day === null ? undefined : Number(item.vip_day),
    skuType: item.sku_type === undefined || item.sku_type === null ? undefined : Number(item.sku_type),
  }
}

function savePendingContext(context) {
  writeStorage(PENDING_KEY, context)
}

function getPendingContext() {
  return readStorage(PENDING_KEY)
}

function clearPendingContext() {
  removeStorage(PENDING_KEY)
}

function saveReturnResult(result) {
  writeStorage(RESULT_KEY, result)
}

function getReturnResult() {
  return readStorage(RESULT_KEY)
}

function clearReturnResult() {
  removeStorage(RESULT_KEY)
}

function buildLaunchPath(context) {
  const query = [
    `requestId=${encodeURIComponent(context.requestId)}`,
    `source=${encodeURIComponent(context.source)}`,
    `bizType=${encodeURIComponent(context.bizType)}`,
  ].join('&')
  return `${EMBEDDED_PAYMENT_PAGE_PATH}?${query}`
}

async function launchEmbeddedPayment(options) {
  if (typeof wx.openEmbeddedMiniProgram !== 'function') {
    wx.showToast({
      title: '当前微信版本暂不支持',
      icon: 'none',
    })
    return false
  }

  const userInfo = await ensureBookUserInfo()
  if (!userInfo) {
    wx.showToast({
      title: '获取用户信息失败',
      icon: 'none',
    })
    return false
  }

  const app = getBookMiniProgramApp()
  if (!app) {
    wx.showToast({
      title: '获取应用信息失败',
      icon: 'none',
    })
    return false
  }

  const skuItem = options && options.skuItem
  if (!skuItem || !skuItem.sku_id) {
    wx.showToast({
      title: '商品信息错误',
      icon: 'none',
    })
    return false
  }

  const context = {
    protocol: EMBEDDED_PAYMENT_PROTOCOL,
    requestId: createRequestId(),
    bizType: (options && options.bizType) || 'recharge',
    source: (options && options.source) || 'mine',
    skuId: skuItem.sku_id,
    albumId: normalizeOptionalNumber(options && options.albumId),
    episodeIndex: normalizeOptionalNumber(options && options.episodeIndex),
    app,
    user_id: userInfo.user_id,
    selectedSku: (options && options.selectedSku) || buildSelectedSku(skuItem),
    createdAt: Date.now(),
  }

  savePendingContext(context)

  return new Promise((resolve) => {
    const openOptions = {
      appId: EMBEDDED_PAYMENT_APP_ID,
      path: buildLaunchPath(context),
      extraData: context,
      success() {
        logJson('[embedded-payment] openEmbeddedMiniProgram success', {
          requestId: context.requestId,
        })
        resolve(true)
      },
      fail(error) {
        console.error('打开半屏支付小程序失败', error)
        clearPendingContext()
        wx.showToast({
          title: '打开充值小程序失败',
          icon: 'none',
        })
        resolve(false)
      },
    }

    if (isDevelopEnv()) {
      openOptions.envVersion = 'develop'
    }

    logJson('[embedded-payment] launch context', context)
    logJson('[embedded-payment] openEmbeddedMiniProgram options', {
      appId: openOptions.appId,
      path: openOptions.path,
      envVersion: openOptions.envVersion || 'release',
      extraData: openOptions.extraData,
    })

    wx.openEmbeddedMiniProgram(openOptions)
  })
}

function captureEmbeddedPaymentReturn(options) {
  const referrerInfo = options && options.referrerInfo
  const extraData = referrerInfo && referrerInfo.extraData
  if (!referrerInfo || referrerInfo.appId !== EMBEDDED_PAYMENT_APP_ID) {
    return null
  }
  if (!extraData || extraData.protocol !== EMBEDDED_PAYMENT_PROTOCOL) {
    return null
  }

  const result = {
    protocol: EMBEDDED_PAYMENT_PROTOCOL,
    requestId: extraData.requestId || '',
    status: extraData.status || '',
    payStatus: Number(extraData.payStatus || 0),
    bizType: extraData.bizType || '',
    source: extraData.source || '',
    skuId: extraData.skuId || '',
    albumId: normalizeOptionalNumber(extraData.albumId),
    episodeIndex: normalizeOptionalNumber(extraData.episodeIndex),
    outTradeNo: extraData.outTradeNo || '',
    finishedAt: Date.now(),
  }

  saveReturnResult(result)
  return result
}

function consumeMatchedReturnResult(options) {
  const pendingContext = getPendingContext()
  const returnResult = getReturnResult()

  if (!pendingContext || !returnResult) {
    return null
  }

  if (
    pendingContext.requestId &&
    returnResult.requestId &&
    pendingContext.requestId !== returnResult.requestId
  ) {
    return null
  }

  if (options && options.source && String(options.source) !== String(returnResult.source || '')) {
    return null
  }

  if (
    options &&
    options.albumId !== undefined &&
    options.albumId !== null &&
    String(options.albumId) !== String(returnResult.albumId === undefined ? '' : returnResult.albumId)
  ) {
    return null
  }

  clearPendingContext()
  clearReturnResult()
  return Object.assign({}, pendingContext, returnResult)
}

module.exports = {
  EMBEDDED_PAYMENT_APP_ID,
  EMBEDDED_PAYMENT_PROTOCOL,
  launchEmbeddedPayment,
  captureEmbeddedPaymentReturn,
  consumeMatchedReturnResult,
  getPendingContext,
  clearPendingContext,
  clearReturnResult,
}
