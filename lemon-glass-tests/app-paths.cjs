const path = require('node:path');

const APP_SCHEME = 'avera';
const APP_HOST = 'app';
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;

function resolveRendererRequestUrl(requestUrl, rendererRoot) {
  let parsed;

  try {
    parsed = new URL(requestUrl);
  } catch {
    return null;
  }

  if (
    parsed.protocol !== `${APP_SCHEME}:` ||
    parsed.hostname !== APP_HOST ||
    parsed.port ||
    parsed.username ||
    parsed.password
  ) {
    return null;
  }

  let decodedPath;

  try {
    decodedPath = decodeURIComponent(parsed.pathname);
  } catch {
    return null;
  }

  if (decodedPath.includes('\0')) {
    return null;
  }

  const relativePath = decodedPath === '/'
    ? 'index.html'
    : decodedPath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(rendererRoot, relativePath);
  const relativeToRoot = path.relative(rendererRoot, resolvedPath);

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return null;
  }

  return resolvedPath;
}

module.exports = {
  APP_HOST,
  APP_ORIGIN,
  APP_SCHEME,
  resolveRendererRequestUrl
};
