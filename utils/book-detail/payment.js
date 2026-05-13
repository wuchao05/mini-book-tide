const appStore = require('../../stores/book-detail/app-store')
const CommonApi = require('../../services/book-detail/api/common')
const WechatApi = require('../../services/book-detail/api/wechat')
const enums = require('../../config/book-detail/enums')
const platform = require('./platform')

const PAYMENT_RETURN_GUARD_KEY = 'splay_payment_return_guard'
const PAYMENT_RETURN_GUARD_TTL = 30 * 60 * 1000

function normalizeArgs(source, skuId, albumId, callback) {
  let resolvedAlbumId = albumId
  let resolvedCallback = callback
  if (typeof resolvedAlbumId === 'function') {
    resolvedCallback = resolvedAlbumId
    resolvedAlbumId = undefined
  }
  return {
    source,
    skuId,
    albumId: resolvedAlbumId,
    callback: resolvedCallback,
  }
}

function checkGlobalPaymentSupport() {
  return true
}

function shouldUseSystemLoading(source) {
  return source !== enums.PAY_SOURCE.FORECAST
}

function markPaymentReturnGuard() {
  try {
    wx.setStorageSync(
      PAYMENT_RETURN_GUARD_KEY,
      JSON.stringify({
        createdAt: Date.now(),
      }),
    )
  } catch (error) {
    console.error('写入支付返回保护标记失败', error)
  }
}

function readPaymentReturnGuard() {
  try {
    const raw = wx.getStorageSync(PAYMENT_RETURN_GUARD_KEY)
    if (!raw) {
      return null
    }

    const guard = JSON.parse(raw)
    if (!guard || typeof guard !== 'object') {
      wx.removeStorageSync(PAYMENT_RETURN_GUARD_KEY)
      return null
    }

    const createdAt = Number(guard.createdAt || 0)
    if (!createdAt || Date.now() - createdAt > PAYMENT_RETURN_GUARD_TTL) {
      wx.removeStorageSync(PAYMENT_RETURN_GUARD_KEY)
      return null
    }

    return guard
  } catch (error) {
    console.error('读取支付返回保护标记失败', error)
    wx.removeStorageSync(PAYMENT_RETURN_GUARD_KEY)
    return null
  }
}

function shouldSkipHotLaunchRedirect() {
  return !!readPaymentReturnGuard()
}

function consumeHotLaunchRedirectGuard() {
  try {
    wx.removeStorageSync(PAYMENT_RETURN_GUARD_KEY)
  } catch (error) {
    console.error('清理支付返回保护标记失败', error)
  }
}

async function startPayment(source, skuId, albumId, callback) {
  const normalized = normalizeArgs(source, skuId, albumId, callback)
  return startWechatPayment(
    normalized.source,
    normalized.skuId,
    normalized.albumId,
    normalized.callback,
  )
}

async function startWechatPayment(source, skuId, albumId, callback) {
  appStore.update({
    isPaying: true,
  })
  markPaymentReturnGuard()

  const info = platform.getPlatformInfo()
  const params = {
    sku_id: skuId || '',
    platform: info.isIOS ? 'ios' : info.isAndroid ? 'android' : 'unknown',
  }

  if (source !== enums.PAY_SOURCE.MINE) {
    if (typeof albumId === 'number') {
      params.album_id = albumId
    } else if (appStore.state.currentData && appStore.state.currentData.id) {
      params.album_id = appStore.state.currentData.id
    }
  }

  try {
    if (shouldUseSystemLoading(source)) {
      wx.showLoading({
        title: '加载中...',
        mask: true,
      })
    }
    const response = await WechatApi.createMchOrder(params)
    return callWechatPay(response.data, callback, source)
  } catch (error) {
    console.error('创建微信订单失败', error)
    appStore.update({
      isShowGuideEntry: true,
      isPaying: false,
    })
    if (shouldUseSystemLoading(source)) {
      wx.hideLoading()
    }
    wx.showToast({
      title: (error && error.message) || '订单创建失败',
      icon: 'none',
    })
    if (typeof callback === 'function') {
      callback(enums.PAY_STATUS.FAIL, error)
    }
    return false
  }
}

function getMerchantOrderField(order, keys, defaultValue) {
  for (let index = 0; index < keys.length; index += 1) {
    const value = order[keys[index]]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return defaultValue
}

function isPaymentCancelError(error) {
  if (!error) {
    return false
  }
  const errCode = Number(error.errCode)
  const errMsg = String(error.errMsg || '').toLowerCase()
  return errCode === -2 || errMsg.indexOf('cancel') !== -1 || errMsg.indexOf('取消') !== -1
}

function getPaymentFailStatus(error) {
  return isPaymentCancelError(error) ? enums.PAY_STATUS.CANCEL : enums.PAY_STATUS.FAIL
}

function getPaymentFailMessage(error) {
  if (isPaymentCancelError(error)) {
    return '取消支付'
  }
  return (error && error.errMsg) || '支付失败'
}

function callWechatPay(order, callback, source) {
  const outOrderNo = getMerchantOrderField(
    order,
    ['OutOrderNo', 'outOrderNo', 'out_order_no', 'out_trade_no'],
    '',
  )
  return new Promise((resolve) => {
    wx.requestPayment({
      timeStamp: String(getMerchantOrderField(order, ['timeStamp', 'timestamp', 'time_stamp'], '')),
      nonceStr: String(getMerchantOrderField(order, ['nonceStr', 'nonce_str'], '')),
      package: String(getMerchantOrderField(order, ['package', 'payPackage', 'pay_package'], '')),
      signType: String(getMerchantOrderField(order, ['signType', 'sign_type'], 'RSA')),
      paySign: String(getMerchantOrderField(order, ['paySign', 'pay_sign'], '')),
      success() {
        if (shouldUseSystemLoading(source)) {
          wx.showLoading({
            title: '订单处理中...',
            mask: true,
          })
        }
        pollingOrder(outOrderNo, callback, undefined, undefined, source).finally(() => resolve(true))
      },
      fail(error) {
        console.error('微信支付失败', error)
        const failStatus = getPaymentFailStatus(error)
        appStore.update({
          isPaying: false,
        })
        if (shouldUseSystemLoading(source)) {
          wx.hideLoading()
        }
        wx.showToast({
          icon: 'none',
          title: getPaymentFailMessage(error),
        })
        
        if (typeof callback === 'function') {
          callback(failStatus, error)
        }
        resolve(false)
      },
    })
  })
}

async function pollingOrder(outOrderNo, callback, maxRetries, interval, source) {
  let retries = typeof maxRetries === 'number' ? maxRetries : 10
  const sleep = (duration) =>
    new Promise((resolve) => {
      setTimeout(resolve, duration)
    })

  while (retries > 0) {
    retries -= 1
    try {
      const response = await CommonApi.getOrderInfo(outOrderNo)
      const payStatus = response && response.data ? response.data.pay_status : 0
      if (payStatus && payStatus !== enums.PAY_STATUS.PROCESSING) {
        if (shouldUseSystemLoading(source)) {
          wx.hideLoading()
        }
        appStore.update({
          isPaying: false,
        })
        if (typeof callback === 'function') {
          callback(payStatus)
        }
        return payStatus
      }
    } catch (error) {
      console.error('轮询订单失败', error)
    }
    if (retries > 0) {
      await sleep(typeof interval === 'number' ? interval : 1000)
    }
  }

  if (shouldUseSystemLoading(source)) {
    wx.hideLoading()
  }
  appStore.update({
    isPaying: false,
  })
  if (typeof callback === 'function') {
    callback(enums.PAY_STATUS.FAIL)
  }
  return enums.PAY_STATUS.FAIL
}

module.exports = {
  checkGlobalPaymentSupport,
  shouldSkipHotLaunchRedirect,
  consumeHotLaunchRedirectGuard,
  startPayment,
  startWechatPayment,
  callWechatPay,
  pollingOrder,
}
