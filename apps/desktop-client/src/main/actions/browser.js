const { shell } = require('electron');

async function openUrl({ url } = {}) {
  if (!url) throw new Error('open_url requires a url payload');
  await shell.openExternal(url);
}

module.exports = { openUrl };
