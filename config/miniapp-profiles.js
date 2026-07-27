const DEFAULT_PROFILE_KEY = 'dongdong';

const profiles = {
  ddnl: {
    key: 'ddnl',
    appId: 'wxa9218c0a31498ede',
    appName: '洞洞能力',
    projectName: '洞洞能力',
    description: '洞洞能力微信小程序',
    navigationBarTitleText: '洞洞能力',
    sitemapDesc: '洞洞能力站点地图',
    appIdentifier: 'ddnl_wx_miniprogram',
    baseUrl: 'https://edge.penetad.com',
    embeddedAppIdList: ['wxb6109138e25d824b', 'wxc4062af340a792a1', 'wxeebb579cc94297d6'],
    // h5PlayerUrl: 'https://splay-midnight-player-h5.yncctech.com',
    enableMockData: false,
  },
};

function cloneProfile(profile) {
  return profile ? { ...profile } : null;
}

function getMiniAppProfile(key) {
  const normalizedKey = String(key || '').trim();

  if (!normalizedKey) {
    return null;
  }

  if (profiles[normalizedKey]) {
    return cloneProfile(profiles[normalizedKey]);
  }

  const matchedProfile = Object.values(profiles).find((profile) => profile.key === normalizedKey);

  return cloneProfile(matchedProfile);
}

function getDefaultMiniAppProfile() {
  return getMiniAppProfile(DEFAULT_PROFILE_KEY);
}

function getMiniAppProfileByAppId(appId) {
  const normalizedAppId = String(appId || '').trim();

  if (!normalizedAppId) {
    return null;
  }

  const matchedProfile = Object.values(profiles).find(
    (profile) => profile.appId === normalizedAppId,
  );

  return cloneProfile(matchedProfile);
}

function getAllMiniAppProfiles() {
  return Object.values(profiles).map((profile) => cloneProfile(profile));
}

module.exports = {
  DEFAULT_PROFILE_KEY,
  profiles,
  getMiniAppProfile,
  getDefaultMiniAppProfile,
  getMiniAppProfileByAppId,
  getAllMiniAppProfiles,
};
