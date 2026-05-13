const DEFAULT_PROFILE_KEY = 'dongdong';

const profiles = {
  dongdong: {
    key: 'dongdong',
    appId: 'wx622e9e1d616706d4',
    appName: '洞洞助手',
    projectName: '洞洞助手',
    description: '洞洞助手微信小程序',
    navigationBarTitleText: '洞洞助手',
    sitemapDesc: '洞洞助手站点地图',
    appIdentifier: 'dongdong_wx_miniprogram',
    baseUrl: 'https://edge.penetad.com',
    embeddedAppIdList: ['wxb6109138e25d824b'],
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
