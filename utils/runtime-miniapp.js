const { currentProfile } = require('../config/current-miniapp')
const { getMiniAppProfileByAppId } = require('../config/miniapp-profiles')

function getMiniProgramAppId() {
  try {
    const accountInfo = wx.getAccountInfoSync()
    return accountInfo && accountInfo.miniProgram ? accountInfo.miniProgram.appId : ''
  } catch (error) {
    console.error('获取小程序 appId 失败', error)
    return ''
  }
}

function getMiniProgramEnvVersion() {
  try {
    const accountInfo = wx.getAccountInfoSync()
    return accountInfo && accountInfo.miniProgram ? accountInfo.miniProgram.envVersion || '' : ''
  } catch (error) {
    console.warn('获取小程序运行环境失败', error)
    return ''
  }
}

function isReleaseEnv() {
  return getMiniProgramEnvVersion() === 'release'
}

function isDevelopEnv() {
  return getMiniProgramEnvVersion() === 'develop'
}

function getCurrentMiniAppProfile() {
  return getMiniAppProfileByAppId(getMiniProgramAppId()) || currentProfile
}

module.exports = {
  getMiniProgramEnvVersion,
  getMiniProgramAppId,
  isDevelopEnv,
  isReleaseEnv,
  getCurrentMiniAppProfile,
}
