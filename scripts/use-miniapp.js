#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const {
  DEFAULT_PROFILE_KEY,
  getMiniAppProfile,
  getAllMiniAppProfiles,
} = require('../config/miniapp-profiles');

const projectRoot = path.resolve(__dirname, '..');
const targetKey = process.argv[2];

function logAvailableProfiles() {
  const profileKeys = getAllMiniAppProfiles().map((profile) => profile.key);
  console.log(`可用小程序: ${profileKeys.join(', ')}`);
  console.log(`示例: node scripts/use-miniapp.js ${DEFAULT_PROFILE_KEY}`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function setQueryParam(rawQuery, key, value) {
  const query = String(rawQuery || '');
  const pairs = query ? query.split('&') : [];
  const encodedKey = encodeURIComponent(key);
  const encodedValue = encodeURIComponent(value);
  let hasKey = false;

  const nextPairs = pairs.map((pair) => {
    const separatorIndex = pair.indexOf('=');
    const pairKey = separatorIndex >= 0 ? pair.slice(0, separatorIndex) : pair;

    if (pairKey !== key) {
      return pair;
    }

    hasKey = true;
    return `${encodedKey}=${encodedValue}`;
  });

  if (!hasKey) {
    nextPairs.push(`${encodedKey}=${encodedValue}`);
  }

  return nextPairs.join('&');
}

function updateLaunchConditionQueries(config, profile) {
  if (!(profile && profile.appIdentifier)) {
    return;
  }

  const launchList =
    config &&
    config.condition &&
    config.condition.miniprogram &&
    Array.isArray(config.condition.miniprogram.list)
      ? config.condition.miniprogram.list
      : [];

  launchList.forEach((item) => {
    if (!item || typeof item.query !== 'string') {
      return;
    }

    if (item.pathName !== 'pages/launcher/index' && !item.query.includes('account_index=')) {
      return;
    }

    item.query = setQueryParam(item.query, 'account_index', profile.appIdentifier);
  });
}

function writeCurrentMiniAppFile(profileKey) {
  const currentMiniAppPath = path.join(projectRoot, 'config/current-miniapp.js');
  const content = `const { DEFAULT_PROFILE_KEY, getMiniAppProfile } = require('./miniapp-profiles');

const CURRENT_MINIAPP_KEY = '${profileKey}';

const currentProfile =
  getMiniAppProfile(CURRENT_MINIAPP_KEY) || getMiniAppProfile(DEFAULT_PROFILE_KEY);

module.exports = {
  CURRENT_MINIAPP_KEY,
  currentProfile,
};
`;

  fs.writeFileSync(currentMiniAppPath, content, 'utf8');
}

function updateProjectConfig(profile) {
  const projectConfigPath = path.join(projectRoot, 'project.config.json');
  const projectConfig = readJson(projectConfigPath);

  projectConfig.description = profile.description;
  projectConfig.appid = profile.appId;
  projectConfig.projectname = profile.projectName;
  updateLaunchConditionQueries(projectConfig, profile);

  writeJson(projectConfigPath, projectConfig);
}

function updateProjectPrivateConfig(profile) {
  const privateConfigPath = path.join(projectRoot, 'project.private.config.json');

  if (!fs.existsSync(privateConfigPath)) {
    return;
  }

  const privateConfig = readJson(privateConfigPath);
  privateConfig.projectname = profile.projectName;
  updateLaunchConditionQueries(privateConfig, profile);
  writeJson(privateConfigPath, privateConfig);
}

function updateAppJson(profile) {
  const appJsonPath = path.join(projectRoot, 'app.json');
  const appJson = readJson(appJsonPath);

  appJson.window = appJson.window || {};
  appJson.window.navigationBarTitleText = profile.navigationBarTitleText;

  if (Array.isArray(profile.embeddedAppIdList) && profile.embeddedAppIdList.length) {
    appJson.embeddedAppIdList = profile.embeddedAppIdList.slice();
  } else {
    delete appJson.embeddedAppIdList;
  }

  writeJson(appJsonPath, appJson);
}

function updateSitemap(profile) {
  const sitemapPath = path.join(projectRoot, 'sitemap.json');
  const sitemap = readJson(sitemapPath);

  sitemap.desc = profile.sitemapDesc;

  writeJson(sitemapPath, sitemap);
}

function updatePageJson(filePath, patch) {
  const pageJsonPath = path.join(projectRoot, filePath);

  if (!fs.existsSync(pageJsonPath)) {
    return;
  }

  const pageJson = readJson(pageJsonPath);
  writeJson(pageJsonPath, Object.assign(pageJson, patch));
}

function updateAShellPageTitles(profile) {
  updatePageJson('pages/home/index.json', {
    navigationBarTitleText: profile.navigationBarTitleText,
  });
  updatePageJson('pages/about/index.json', {
    navigationBarTitleText: `关于${profile.appName}`,
  });
}

if (!targetKey || targetKey === '--list') {
  logAvailableProfiles();
  process.exit(0);
}

const profile = getMiniAppProfile(targetKey);

if (!profile) {
  console.error(`未找到小程序配置: ${targetKey}`);
  logAvailableProfiles();
  process.exit(1);
}

updateProjectConfig(profile);
updateProjectPrivateConfig(profile);
updateAppJson(profile);
updateSitemap(profile);
updateAShellPageTitles(profile);
writeCurrentMiniAppFile(profile.key);

console.log(`已切换到 ${profile.appName} (${profile.appId})`);
