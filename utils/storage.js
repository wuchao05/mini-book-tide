const { STORAGE_KEYS } = require('../constants')

function setStorage(key, value) {
  try {
    wx.setStorageSync(key, value)
  } catch (error) {
    console.warn(`写入缓存失败: ${key}`, error)
  }
}

function getStorage(key, fallbackValue = null) {
  try {
    const value = wx.getStorageSync(key)
    return value === '' || value === undefined ? fallbackValue : value
  } catch (error) {
    console.warn(`读取缓存失败: ${key}`, error)
    return fallbackValue
  }
}

function removeStorage(key) {
  try {
    wx.removeStorageSync(key)
  } catch (error) {
    console.warn(`清除缓存失败: ${key}`, error)
  }
}

module.exports = {
  STORAGE_KEYS,
  setStorage,
  getStorage,
  removeStorage,
}
