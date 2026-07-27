const userStore = require('../../stores/book-detail/user-store')
const appStore = require('../../stores/book-detail/app-store')
const CommonApi = require('../../services/book-detail/api/common')
const WechatApi = require('../../services/book-detail/api/wechat')
const enums = require('../../config/book-detail/enums')
const { getCurrentMiniAppProfile, isDevelopEnv } = require('../runtime-miniapp')
const platform = require('./platform')

const EMBEDDED_PAYMENT_APP_ID = 'wxb6109138e25d824b'
const EMBEDDED_PAYMENT_PAGE_PATH = 'pages/embedded-pay/index'
const EMBEDDED_PAYMENT_PROTOCOL = 'embedded-pay/v1'
const QINGMPAY_PAYMENT_PROTOCOL = 'qingmpay/v1'
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

function getPaymentPlatform() {
  const info = platform.getPlatformInfo()
  return info.isIOS ? 'ios' : info.isAndroid ? 'android' : 'unknown'
}

function parseAppletInfo(raw) {
  const info = typeof raw === 'string' ? safeParse(raw) : raw
  if (!info || typeof info !== 'object') {
    return null
  }

  const appId = String(info.appId || '').trim()
  const path = String(info.path || '').trim()
  if (!appId || !path) {
    return null
  }

  return {
    appId,
    path,
  }
}

function mapQingmpayStatus(status) {
  const normalizedStatus = String(status || '').toUpperCase()
  if (normalizedStatus === 'SUCCESS') {
    return enums.PAY_STATUS.SUCCESS
  }
  if (normalizedStatus === 'CANCEL') {
    return enums.PAY_STATUS.CANCEL
  }
  if (normalizedStatus === 'DOING') {
    return enums.PAY_STATUS.PROCESSING
  }
  return enums.PAY_STATUS.FAIL
}

function getEmbeddedPaymentChannel() {
  const config = appStore.state.config || {}
  if (config.embeddedPaymentChannel === 'qingmPay') {
    return 'qingmpay'
  }
  return 'legacy'
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

function buildCanceledResult(pendingContext) {
  return {
    protocol: (pendingContext && pendingContext.protocol) || '',
    requestId: (pendingContext && pendingContext.requestId) || '',
    status: 'CANCEL',
    payStatus: enums.PAY_STATUS.CANCEL,
    bizType: (pendingContext && pendingContext.bizType) || '',
    source: (pendingContext && pendingContext.source) || '',
    skuId: (pendingContext && pendingContext.skuId) || '',
    albumId: pendingContext ? normalizeOptionalNumber(pendingContext.albumId) : undefined,
    episodeIndex: pendingContext ? normalizeOptionalNumber(pendingContext.episodeIndex) : undefined,
    outTradeNo: (pendingContext && pendingContext.outTradeNo) || '',
    pdorderid: (pendingContext && pendingContext.pdorderid) || '',
    finishedAt: Date.now(),
  }
}

function buildProcessingResult(pendingContext) {
  return {
    protocol: (pendingContext && pendingContext.protocol) || '',
    requestId: (pendingContext && pendingContext.requestId) || '',
    status: 'QUERYING',
    payStatus: enums.PAY_STATUS.PROCESSING,
    bizType: (pendingContext && pendingContext.bizType) || '',
    source: (pendingContext && pendingContext.source) || '',
    skuId: (pendingContext && pendingContext.skuId) || '',
    albumId: pendingContext ? normalizeOptionalNumber(pendingContext.albumId) : undefined,
    episodeIndex: pendingContext ? normalizeOptionalNumber(pendingContext.episodeIndex) : undefined,
    outTradeNo: (pendingContext && pendingContext.outTradeNo) || '',
    pdorderid: (pendingContext && pendingContext.pdorderid) || '',
    finishedAt: Date.now(),
  }
}

function buildOrderStatusResult(pendingContext, payStatus) {
  return {
    protocol: (pendingContext && pendingContext.protocol) || '',
    requestId: (pendingContext && pendingContext.requestId) || '',
    status: String(payStatus || ''),
    payStatus: Number(payStatus || 0),
    bizType: (pendingContext && pendingContext.bizType) || '',
    source: (pendingContext && pendingContext.source) || '',
    skuId: (pendingContext && pendingContext.skuId) || '',
    albumId: pendingContext ? normalizeOptionalNumber(pendingContext.albumId) : undefined,
    episodeIndex: pendingContext ? normalizeOptionalNumber(pendingContext.episodeIndex) : undefined,
    outTradeNo: (pendingContext && pendingContext.outTradeNo) || '',
    pdorderid: (pendingContext && pendingContext.pdorderid) || '',
    finishedAt: Date.now(),
  }
}

function savePaymentReturnResult(result) {
  saveReturnResult(result)
  return result
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function queryQingmpayOrderResult(pendingContext) {
  const outOrderNo = (pendingContext && (pendingContext.outTradeNo || pendingContext.pdorderid)) || ''
  if (!outOrderNo) {
    return null
  }

  let retries = 3
  while (retries > 0) {
    retries -= 1
    try {
      const response = await CommonApi.getOrderInfo(outOrderNo)
      const payStatus = response && response.data ? Number(response.data.pay_status || 0) : 0
      if (payStatus && payStatus !== enums.PAY_STATUS.PROCESSING) {
        return buildOrderStatusResult(pendingContext, payStatus)
      }
    } catch (error) {
      console.error('查询合利宝支付订单失败', error)
    }

    if (retries > 0) {
      await wait(800)
    }
  }

  return null
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

async function launchQingmpayPayment(options) {
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

  const albumId = normalizeOptionalNumber(options && options.albumId)
  const episodeIndex = normalizeOptionalNumber(options && options.episodeIndex)
  const dramaId = normalizeOptionalNumber(
    (options && options.dramaId) || skuItem.drama_Id || skuItem.drama_id || skuItem.dramaId,
  )
  const context = {
    protocol: QINGMPAY_PAYMENT_PROTOCOL,
    requestId: createRequestId(),
    bizType: (options && options.bizType) || 'recharge',
    source: (options && options.source) || 'mine',
    skuId: skuItem.sku_id,
    albumId,
    episodeIndex,
    app,
    user_id: userInfo.user_id,
    selectedSku: (options && options.selectedSku) || buildSelectedSku(skuItem),
    createdAt: Date.now(),
  }

  const orderParams = {
    sku_id: skuItem.sku_id,
    platform: getPaymentPlatform(),
    album_id: albumId === undefined ? 0 : albumId,
    raw: 0,
  }
  if (dramaId !== undefined) {
    orderParams.drama_Id = dramaId
  }

  let orderResult = null
  let appletInfo = null
  try {
    const response = await WechatApi.createQingmpayOrder(orderParams)
    if (!response || response.code !== 0) {
      throw new Error((response && response.message) || '创建支付订单失败')
    }

    const paymentData = response.data || {}
    if (String(paymentData.errcode) !== '0') {
      throw new Error(paymentData.err || '创建支付订单失败')
    }

    orderResult = paymentData.result || {}
    appletInfo = parseAppletInfo(orderResult.appletInfo || orderResult.pay_info)
    if (!appletInfo) {
      throw new Error('支付信息异常')
    }
  } catch (error) {
    console.error('创建合利宝支付订单失败', error)
    wx.showToast({
      title: (error && error.message) || '创建支付订单失败',
      icon: 'none',
    })
    return false
  }

  Object.assign(context, {
    paymentAppId: appletInfo.appId,
    paymentPath: appletInfo.path,
    outTradeNo: orderResult.outTradeNo || '',
    pdorderid: orderResult.pdorderid || '',
    money: orderResult.money || '',
  })
  savePendingContext(context)

  return new Promise((resolve) => {
    const openOptions = {
      appId: appletInfo.appId,
      path: appletInfo.path,
      extraData: {
        protocol: QINGMPAY_PAYMENT_PROTOCOL,
        requestId: context.requestId,
        outTradeNo: context.outTradeNo,
        pdorderid: context.pdorderid,
      },
      success() {
        logJson('[qingmpay] openEmbeddedMiniProgram success', {
          requestId: context.requestId,
          outTradeNo: context.outTradeNo,
          pdorderid: context.pdorderid,
        })
        resolve(true)
      },
      fail(error) {
        console.error('打开合利宝支付小程序失败', error)
        clearPendingContext()
        wx.showToast({
          title: '打开支付小程序失败',
          icon: 'none',
        })
        resolve(false)
      },
    }

    logJson('[qingmpay] launch context', context)
    logJson('[qingmpay] openEmbeddedMiniProgram options', {
      appId: openOptions.appId,
      path: openOptions.path,
      extraData: openOptions.extraData,
    })

    wx.openEmbeddedMiniProgram(openOptions)
  })
}

function launchConfiguredPayment(options) {
  if (getEmbeddedPaymentChannel() === 'qingmpay') {
    return launchQingmpayPayment(options)
  }
  return launchEmbeddedPayment(options)
}

function captureEmbeddedPaymentReturn(options) {
  const referrerInfo = options && options.referrerInfo
  const extraData = (referrerInfo && referrerInfo.extraData) || {}
  const pendingContext = getPendingContext()

  if (!pendingContext) {
    return null
  }

  const isQingmpayReferrer =
    !!(
      pendingContext.protocol === QINGMPAY_PAYMENT_PROTOCOL &&
      (!referrerInfo || pendingContext.paymentAppId === referrerInfo.appId)
    )
  if (isQingmpayReferrer) {
    const orderPayStatus = extraData.orderPayStatus || ''
    const result = {
      protocol: QINGMPAY_PAYMENT_PROTOCOL,
      requestId: (pendingContext && pendingContext.requestId) || '',
      status: orderPayStatus || 'QUERYING',
      payStatus: orderPayStatus ? mapQingmpayStatus(orderPayStatus) : enums.PAY_STATUS.PROCESSING,
      bizType: (pendingContext && pendingContext.bizType) || '',
      source: (pendingContext && pendingContext.source) || '',
      skuId: (pendingContext && pendingContext.skuId) || '',
      albumId: pendingContext ? normalizeOptionalNumber(pendingContext.albumId) : undefined,
      episodeIndex: pendingContext ? normalizeOptionalNumber(pendingContext.episodeIndex) : undefined,
      outTradeNo: (pendingContext && pendingContext.outTradeNo) || '',
      pdorderid: (pendingContext && pendingContext.pdorderid) || extraData.orderNum || '',
      orderNum: extraData.orderNum || '',
      amount: extraData.amount || '',
      finishedAt: Date.now(),
    }

    return savePaymentReturnResult(result)
  }

  const isLegacyEmbeddedReferrer =
    pendingContext.protocol === EMBEDDED_PAYMENT_PROTOCOL &&
    (!referrerInfo || referrerInfo.appId === EMBEDDED_PAYMENT_APP_ID)

  if (!isLegacyEmbeddedReferrer) {
    return null
  }

  if (extraData.protocol && extraData.protocol !== EMBEDDED_PAYMENT_PROTOCOL) {
    return savePaymentReturnResult(buildCanceledResult(pendingContext))
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

  return savePaymentReturnResult(result.payStatus ? result : buildCanceledResult(pendingContext))
}

async function consumeMatchedReturnResult(options) {
  const pendingContext = getPendingContext()
  let returnResult = getReturnResult()

  if (!pendingContext) {
    return null
  }

  if (!returnResult && pendingContext.protocol === QINGMPAY_PAYMENT_PROTOCOL) {
    returnResult = buildProcessingResult(pendingContext)
  }

  if (!returnResult) {
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

  if (
    pendingContext.protocol === QINGMPAY_PAYMENT_PROTOCOL &&
    Number(returnResult.payStatus) === enums.PAY_STATUS.PROCESSING
  ) {
    const queriedResult = await queryQingmpayOrderResult(pendingContext)
    if (!queriedResult) {
      return null
    }
    returnResult = queriedResult
  }

  clearPendingContext()
  clearReturnResult()
  return Object.assign({}, pendingContext, returnResult)
}

module.exports = {
  EMBEDDED_PAYMENT_APP_ID,
  EMBEDDED_PAYMENT_PROTOCOL,
  QINGMPAY_PAYMENT_PROTOCOL,
  launchEmbeddedPayment,
  launchQingmpayPayment,
  launchConfiguredPayment,
  captureEmbeddedPaymentReturn,
  consumeMatchedReturnResult,
  getPendingContext,
  clearPendingContext,
  clearReturnResult,
}
