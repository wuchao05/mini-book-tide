const { DEFAULT_PROFILE_KEY, getMiniAppProfile } = require('./miniapp-profiles');

const CURRENT_MINIAPP_KEY = 'ddnl';

const currentProfile =
  getMiniAppProfile(CURRENT_MINIAPP_KEY) || getMiniAppProfile(DEFAULT_PROFILE_KEY);

module.exports = {
  CURRENT_MINIAPP_KEY,
  currentProfile,
};
