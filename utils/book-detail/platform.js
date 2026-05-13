let platformInfo = null

function computePlatformInfo() {
  const systemInfo = wx.getSystemInfoSync()
  const statusBarHeight = systemInfo.statusBarHeight || 0
  let menuButtonInfo = null
  try {
    menuButtonInfo = wx.getMenuButtonBoundingClientRect()
  } catch (error) {
    menuButtonInfo = null
  }
  const navBarHeight = menuButtonInfo
    ? (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height
    : 44

  return {
    platform: 'mp-weixin',
    systemInfo,
    statusBarHeight,
    navBarHeight,
    menuButtonInfo,
    navTop: statusBarHeight + 4,
    isWechat: true,
    isIOS: String(systemInfo.platform || '').toLowerCase() === 'ios',
    isAndroid: String(systemInfo.platform || '').toLowerCase() === 'android',
  }
}

function getPlatformInfo() {
  if (!platformInfo) {
    platformInfo = computePlatformInfo()
  }
  return platformInfo
}

module.exports = {
  getPlatformInfo,
}
