import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const buildRoot = path.join(projectRoot, 'build', 'web-mobile');
const outDir = path.join(projectRoot, 'dist');
const outFile = path.join(outDir, 'PlaytestDemo.single.html');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

function toRel(file) {
  return path.relative(buildRoot, file).replace(/\\/g, '/');
}

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  const mimes = {
    '.bin': 'application/octet-stream',
    '.css': 'text/css;charset=utf-8',
    '.gif': 'image/gif',
    '.html': 'text/html;charset=utf-8',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'application/javascript;charset=utf-8',
    '.json': 'application/json;charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.ogg': 'audio/ogg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml;charset=utf-8',
    '.ttf': 'font/ttf',
    '.wasm': 'application/wasm',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  };
  return mimes[ext] ?? 'application/octet-stream';
}

function readUtf8(rel) {
  return fs.readFileSync(path.join(buildRoot, rel), 'utf8');
}

function escapeScript(text) {
  return text
    .replace(/<\/script/gi, '<\\/script')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

if (!fs.existsSync(path.join(buildRoot, 'index.html'))) {
  throw new Error(`Web Mobile build not found: ${buildRoot}`);
}

const inlineFiles = {};
for (const file of walk(buildRoot)) {
  const rel = toRel(file);
  if (rel === 'index.html') {
    continue;
  }
  const data = fs.readFileSync(file);
  inlineFiles[rel] = {
    mime: mimeFor(file),
    size: data.length,
    data: data.toString('base64'),
  };
}

const style = readUtf8('style.css');
const polyfills = readUtf8('src/polyfills.bundle.js');
const system = readUtf8('src/system.bundle.js');
const importMap = JSON.parse(readUtf8('src/import-map.json'));
if (importMap.imports?.cc) {
  importMap.imports.cc = './cocos-js/cc.js';
}

const runtimePatch = String.raw`
(function () {
  var files = window.__INLINE_FILES__;
  var keys = Object.keys(files).sort(function (a, b) { return b.length - a.length; });
  var blobUrls = Object.create(null);
  var byteCache = Object.create(null);
  var textDecoder = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
  var nativeFetch = window.fetch ? window.fetch.bind(window) : null;
  var NativeXHR = window.XMLHttpRequest;

  function normalizeSegments(path) {
    var out = [];
    path.replace(/\\/g, '/').split('/').forEach(function (part) {
      if (!part || part === '.') return;
      if (part === '..') out.pop();
      else out.push(part);
    });
    return out.join('/');
  }

  function pathFromUrl(value) {
    if (value && typeof Request !== 'undefined' && value instanceof Request) {
      value = value.url;
    }
    value = String(value || '');
    if (!value || value.indexOf('data:') === 0 || value.indexOf('blob:') === 0) {
      return null;
    }
    var clean = value.split('#')[0].split('?')[0].replace(/\\/g, '/');
    try {
      var parsed = new URL(value, location.href);
      clean = decodeURIComponent(parsed.pathname).replace(/\\/g, '/');
    } catch (err) {}
    clean = clean.replace(/^\/[A-Za-z]:\//, '');
    clean = clean.replace(/^\/+/, '');
    clean = normalizeSegments(clean);
    if (files[clean]) return clean;
    var buildIndex = clean.lastIndexOf('build/web-mobile/');
    if (buildIndex >= 0) {
      var fromBuild = clean.slice(buildIndex + 'build/web-mobile/'.length);
      if (files[fromBuild]) return fromBuild;
    }
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (clean === key || clean.endsWith('/' + key)) {
        return key;
      }
    }
    return null;
  }

  function bytesFor(key) {
    if (byteCache[key]) return byteCache[key];
    var raw = atob(files[key].data);
    var bytes = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i += 1) {
      bytes[i] = raw.charCodeAt(i);
    }
    byteCache[key] = bytes;
    return bytes;
  }

  function textFor(key) {
    var bytes = bytesFor(key);
    if (textDecoder) return textDecoder.decode(bytes);
    var text = '';
    for (var i = 0; i < bytes.length; i += 1) {
      text += String.fromCharCode(bytes[i]);
    }
    return decodeURIComponent(escape(text));
  }

  function blobFor(key) {
    return new Blob([bytesFor(key)], { type: files[key].mime });
  }

  function blobUrlFor(key) {
    if (!blobUrls[key]) {
      blobUrls[key] = URL.createObjectURL(blobFor(key));
    }
    return blobUrls[key];
  }

  window.__INLINE_LOOKUP__ = pathFromUrl;
  window.__INLINE_BLOB_URL__ = function (value) {
    var key = pathFromUrl(value);
    return key ? blobUrlFor(key) : value;
  };

  if (nativeFetch) {
    window.fetch = function (input, init) {
      var key = pathFromUrl(input);
      if (!key) return nativeFetch(input, init);
      return Promise.resolve(new Response(bytesFor(key).slice(0), {
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': files[key].mime,
          'Content-Length': String(files[key].size),
        },
      }));
    };
  }

  if (NativeXHR) {
    function InlineXMLHttpRequest() {
      this._listeners = Object.create(null);
      this._headers = Object.create(null);
      this._native = null;
      this._key = null;
      this._url = '';
      this.readyState = 0;
      this.status = 0;
      this.statusText = '';
      this.response = null;
      this.responseText = '';
      this.responseType = '';
      this.responseURL = '';
      this.timeout = 0;
      this.withCredentials = false;
      this.onreadystatechange = null;
      this.onload = null;
      this.onerror = null;
      this.onloadend = null;
      this.onabort = null;
      this.ontimeout = null;
    }

    InlineXMLHttpRequest.UNSENT = 0;
    InlineXMLHttpRequest.OPENED = 1;
    InlineXMLHttpRequest.HEADERS_RECEIVED = 2;
    InlineXMLHttpRequest.LOADING = 3;
    InlineXMLHttpRequest.DONE = 4;
    InlineXMLHttpRequest.prototype.UNSENT = 0;
    InlineXMLHttpRequest.prototype.OPENED = 1;
    InlineXMLHttpRequest.prototype.HEADERS_RECEIVED = 2;
    InlineXMLHttpRequest.prototype.LOADING = 3;
    InlineXMLHttpRequest.prototype.DONE = 4;

    InlineXMLHttpRequest.prototype.addEventListener = function (type, listener) {
      (this._listeners[type] || (this._listeners[type] = [])).push(listener);
      if (this._native) this._native.addEventListener(type, listener);
    };

    InlineXMLHttpRequest.prototype.removeEventListener = function (type, listener) {
      var list = this._listeners[type];
      if (list) {
        var index = list.indexOf(listener);
        if (index >= 0) list.splice(index, 1);
      }
      if (this._native) this._native.removeEventListener(type, listener);
    };

    InlineXMLHttpRequest.prototype._dispatch = function (type) {
      var event = { type: type, target: this, currentTarget: this };
      var handler = this['on' + type];
      if (typeof handler === 'function') handler.call(this, event);
      var list = this._listeners[type];
      if (list) {
        list.slice().forEach(function (listener) {
          listener.call(this, event);
        }, this);
      }
    };

    InlineXMLHttpRequest.prototype._bindNative = function () {
      var self = this;
      ['readystatechange', 'load', 'error', 'loadend', 'abort', 'timeout', 'progress'].forEach(function (type) {
        self._native.addEventListener(type, function (event) {
          self.readyState = self._native.readyState;
          self.status = self._native.status;
          self.statusText = self._native.statusText;
          self.response = self._native.response;
          self.responseText = self._native.responseText;
          self.responseURL = self._native.responseURL;
          self._dispatch(type, event);
        });
      });
      Object.keys(this._listeners).forEach(function (type) {
        self._listeners[type].forEach(function (listener) {
          self._native.addEventListener(type, listener);
        });
      });
    };

    InlineXMLHttpRequest.prototype.open = function (method, url, async, user, password) {
      this._key = pathFromUrl(url);
      this._url = String(url);
      if (!this._key) {
        this._native = new NativeXHR();
        this._bindNative();
        return this._native.open(method, url, async !== false, user, password);
      }
      this.readyState = 1;
      this.responseURL = this._url;
      this._dispatch('readystatechange');
    };

    InlineXMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      if (this._native) return this._native.setRequestHeader(name, value);
      this._headers[String(name).toLowerCase()] = String(value);
    };

    InlineXMLHttpRequest.prototype.overrideMimeType = function () {};

    InlineXMLHttpRequest.prototype.getResponseHeader = function (name) {
      if (this._native) return this._native.getResponseHeader(name);
      if (!this._key) return null;
      name = String(name).toLowerCase();
      if (name === 'content-type') return files[this._key].mime;
      if (name === 'content-length') return String(files[this._key].size);
      return null;
    };

    InlineXMLHttpRequest.prototype.getAllResponseHeaders = function () {
      if (this._native) return this._native.getAllResponseHeaders();
      if (!this._key) return '';
      return 'content-type: ' + files[this._key].mime + '\r\ncontent-length: ' + files[this._key].size + '\r\n';
    };

    InlineXMLHttpRequest.prototype.send = function (body) {
      if (this._native) return this._native.send(body);
      var self = this;
      setTimeout(function () {
        var key = self._key;
        var bytes = bytesFor(key);
        var responseType = self.responseType || '';
        self.status = 200;
        self.statusText = 'OK';
        self.readyState = 4;
        if (responseType === 'arraybuffer') {
          self.response = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
          self.responseText = '';
        } else if (responseType === 'blob') {
          self.response = blobFor(key);
          self.responseText = '';
        } else if (responseType === 'json') {
          self.responseText = textFor(key);
          self.response = JSON.parse(self.responseText);
        } else {
          self.responseText = textFor(key);
          self.response = self.responseText;
        }
        self._dispatch('readystatechange');
        self._dispatch('load');
        self._dispatch('loadend');
      }, 0);
    };

    InlineXMLHttpRequest.prototype.abort = function () {
      if (this._native) return this._native.abort();
      this._dispatch('abort');
      this._dispatch('loadend');
    };

    window.XMLHttpRequest = InlineXMLHttpRequest;
  }

  function patchSrc(proto) {
    if (!proto) return;
    var descriptor = Object.getOwnPropertyDescriptor(proto, 'src');
    if (!descriptor || !descriptor.set || !descriptor.get) return;
    Object.defineProperty(proto, 'src', {
      configurable: true,
      enumerable: descriptor.enumerable,
      get: descriptor.get,
      set: function (value) {
        var key = pathFromUrl(value);
        descriptor.set.call(this, key ? blobUrlFor(key) : value);
      },
    });
  }

  patchSrc(window.HTMLImageElement && window.HTMLImageElement.prototype);
  patchSrc(window.HTMLMediaElement && window.HTMLMediaElement.prototype);
  patchSrc(window.HTMLScriptElement && window.HTMLScriptElement.prototype);
  patchSrc(window.HTMLSourceElement && window.HTMLSourceElement.prototype);

  var nativeSetAttribute = window.Element && window.Element.prototype.setAttribute;
  if (nativeSetAttribute) {
    window.Element.prototype.setAttribute = function (name, value) {
      var lower = String(name).toLowerCase();
      if (lower === 'src' || lower === 'href') {
        var key = pathFromUrl(value);
        if (key) value = blobUrlFor(key);
      }
      return nativeSetAttribute.call(this, name, value);
    };
  }

  if (window.System && System.constructor && System.constructor.prototype) {
    var systemProto = System.constructor.prototype;
    var nativeCreateScript = systemProto.createScript;
    systemProto.createScript = function (url) {
      var key = pathFromUrl(url);
      if (!key) return nativeCreateScript.call(this, url);
      var script = document.createElement('script');
      script.async = true;
      script.src = blobUrlFor(key);
      return script;
    };
  }
})();
`;

const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PlaytestDemo</title>
  <meta name="viewport" content="width=device-width,user-scalable=no,initial-scale=1,minimum-scale=1,maximum-scale=1,minimal-ui=true">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="format-detection" content="telephone=no">
  <meta name="renderer" content="webkit">
  <meta name="force-rendering" content="webkit">
  <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
  <meta name="msapplication-tap-highlight" content="no">
  <meta name="full-screen" content="yes">
  <meta name="x5-fullscreen" content="true">
  <meta name="360-fullscreen" content="true">
  <meta name="x5-page-mode" content="app">
  <style>${escapeScript(style)}</style>
</head>
<body>
  <div id="GameDiv" cc_exact_fit_screen="true">
    <div id="Cocos3dGameContainer">
      <canvas id="GameCanvas" oncontextmenu="event.preventDefault()" tabindex="99"></canvas>
    </div>
  </div>
  <script>window.__INLINE_FILES__=${jsonForScript(inlineFiles)};</script>
  <script>${escapeScript(polyfills)}</script>
  <script>${escapeScript(system)}</script>
  <script>${escapeScript(runtimePatch)}</script>
  <script type="systemjs-importmap">${jsonForScript(importMap)}</script>
  <script>System.import('./index.js').catch(function (err) { console.error(err); });</script>
</body>
</html>
`;

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, html);

const bytes = fs.statSync(outFile).size;
console.log(`Packed ${Object.keys(inlineFiles).length} files into ${outFile}`);
console.log(`Output size: ${(bytes / 1024 / 1024).toFixed(2)} MB`);
