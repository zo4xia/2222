/**
 * src/utils/cdnLoader.js
 * 
 * 通用双 CDN 动态加载与降级兜底工具
 * 遵循 CDN 五原则：国内双源（主 + 备）+ 本地/兜底降级 + 状态缓存与超时控制
 */

// 内存中缓存已成功或失败的资源，避免重复加载
const loadedResources = new Map();

/**
 * 动态加载单个 CSS 样式表，支持主源、备用源、本地降级
 * @param {Object} options
 * @param {string} options.id 唯一资源标识（用于避免重复注入）
 * @param {string} options.primary 主 CDN 地址
 * @param {string} [options.secondary] 备用 CDN 地址
 * @param {string} [options.fallback] 本地/终极降级 CSS 地址
 * @param {number} [options.timeout=5000] 超时时间 (ms)
 * @returns {Promise<boolean>}
 */
export function loadCssWithFallback({ id, primary, secondary, fallback, timeout = 5000 }) {
  if (typeof document === 'undefined') return Promise.resolve(false);
  const cacheKey = `css:${id || primary}`;
  if (loadedResources.has(cacheKey)) {
    return Promise.resolve(loadedResources.get(cacheKey));
  }

  const existing = document.getElementById(id);
  if (existing) {
    loadedResources.set(cacheKey, true);
    return Promise.resolve(true);
  }

  const tryLoad = (url) => {
    return new Promise((resolve, reject) => {
      if (!url) return reject(new Error('Empty URL'));
      const link = document.createElement('link');
      if (id) link.id = id;
      link.rel = 'stylesheet';
      link.href = url;

      let timer = null;
      let settled = false;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        link.onload = null;
        link.onerror = null;
      };

      link.onload = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(true);
      };

      link.onerror = (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (link.parentNode) link.parentNode.removeChild(link);
        reject(err);
      };

      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        if (link.parentNode) link.parentNode.removeChild(link);
        reject(new Error(`CSS timeout: ${url}`));
      }, timeout);

      document.head.appendChild(link);
    });
  };

  return tryLoad(primary)
    .catch((err) => {
      console.warn(`[CDN] 主源加载失败: ${primary}，尝试备用源...`, err);
      if (secondary) {
        return tryLoad(secondary);
      }
      throw err;
    })
    .catch((err) => {
      console.warn(`[CDN] 备用源加载失败，尝试本地降级: ${fallback || 'none'}`, err);
      if (fallback) {
        return tryLoad(fallback);
      }
      return false;
    })
    .then((success) => {
      loadedResources.set(cacheKey, !!success);
      return !!success;
    })
    .catch(() => {
      loadedResources.set(cacheKey, false);
      return false;
    });
}

/**
 * 动态加载单个 JavaScript 脚本，支持主源、备用源、本地降级
 * @param {Object} options
 * @param {string} options.id 唯一资源标识
 * @param {string} options.primary 主 CDN 地址
 * @param {string} [options.secondary] 备用 CDN 地址
 * @param {string} [options.fallback] 本地/兜底脚本地址
 * @param {() => boolean} [options.checkGlobal] 检测全局变量是否挂载成功
 * @param {number} [options.timeout=6000] 超时时间 (ms)
 * @returns {Promise<boolean>}
 */
export function loadScriptWithFallback({ id, primary, secondary, fallback, checkGlobal, timeout = 6000 }) {
  if (typeof document === 'undefined') return Promise.resolve(false);
  const cacheKey = `js:${id || primary}`;
  if (loadedResources.has(cacheKey)) {
    return Promise.resolve(loadedResources.get(cacheKey));
  }

  if (checkGlobal && checkGlobal()) {
    loadedResources.set(cacheKey, true);
    return Promise.resolve(true);
  }

  const tryLoad = (url) => {
    return new Promise((resolve, reject) => {
      if (!url) return reject(new Error('Empty URL'));
      const script = document.createElement('script');
      if (id) script.id = id;
      script.src = url;
      script.async = true;

      let timer = null;
      let settled = false;

      const cleanup = () => {
        if (timer) clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
      };

      script.onload = () => {
        if (settled) return;
        settled = true;
        cleanup();
        if (checkGlobal && !checkGlobal()) {
          reject(new Error(`Global symbol check failed for: ${url}`));
          return;
        }
        resolve(true);
      };

      script.onerror = (err) => {
        if (settled) return;
        settled = true;
        cleanup();
        if (script.parentNode) script.parentNode.removeChild(script);
        reject(err);
      };

      timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        if (script.parentNode) script.parentNode.removeChild(script);
        reject(new Error(`Script timeout: ${url}`));
      }, timeout);

      document.head.appendChild(script);
    });
  };

  return tryLoad(primary)
    .catch((err) => {
      console.warn(`[CDN] 主脚本加载失败: ${primary}，尝试备用源...`, err);
      if (secondary) {
        return tryLoad(secondary);
      }
      throw err;
    })
    .catch((err) => {
      console.warn(`[CDN] 备用脚本加载失败，尝试本地兜底: ${fallback || 'none'}`, err);
      if (fallback) {
        return tryLoad(fallback);
      }
      return false;
    })
    .then((success) => {
      loadedResources.set(cacheKey, !!success);
      return !!success;
    })
    .catch(() => {
      loadedResources.set(cacheKey, false);
      return false;
    });
}
