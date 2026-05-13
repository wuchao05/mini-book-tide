const passcodeAuth = require('./passcode-auth')
const { buildBShellPageUrl } = require('../shell-pages')

const ASHELL_HOME = '/pages/home/index'
const BSHELL_THEATER = '/pages/book-detail/theater/index'

function openAShellWithPasscodePrompt(message) {
  passcodeAuth.requestPrompt(message || '请输入口令')
  wx.switchTab({
    url: ASHELL_HOME,
    fail() {
      wx.reLaunch({
        url: ASHELL_HOME,
      })
    },
  })
}

function openBShellEntry(auth) {
  const currentAuth = auth || passcodeAuth.readValidAuth()
  const albumId = Number(currentAuth && currentAuth.albumId)

  if (albumId && !(currentAuth && currentAuth.hasOpenedInitialAlbum)) {
    passcodeAuth.markInitialAlbumOpened()
    wx.reLaunch({
      url: BSHELL_THEATER,
      success() {
        wx.navigateTo({
          url: buildBShellPageUrl('forecast', {
            album_id: albumId,
          }),
        })
      },
    })
    return
  }

  wx.reLaunch({
    url: BSHELL_THEATER,
  })
}

module.exports = {
  openAShellWithPasscodePrompt,
  openBShellEntry,
}
