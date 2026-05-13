const { currentProfile } = require('../current-miniapp');

module.exports = {
  appName: currentProfile.appName,
  baseUrl: currentProfile.baseUrl,
  appId: currentProfile.appId,
  h5PlayerUrl: currentProfile.h5PlayerUrl,
}
