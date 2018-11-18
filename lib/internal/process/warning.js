'use strict';

const { warningFile } = process.binding('config');
const prefix = `(${process.release.name}:${process.pid}) `;
const { ERR_INVALID_ARG_TYPE } = require('internal/errors').codes;

exports.setup = setupProcessWarnings;

// Lazily loaded
let fs;
let fd;

function noop() {}

function writeOut(message) {
  if (console && typeof console.error === 'function')
    return console.error(message);
  process._rawDebug(message);
}

function onClose(fd) {
  return () => fs.close(fd, noop);
}

function acquireFd(message) {
  if (fd === undefined) {
    fs = require('fs');
    try {
      fd = fs.openSync(warningFile, 'a');
      process.on('exit', onClose(fd));
    } catch (err) {
      return writeOut(message);
    }
  }
  fs.appendFile(fd, `${message}\n`, (err) => {
    if (err) {
      return writeOut(message);
    }
  });
}

function setupProcessWarnings() {
  // Prevent warnings from being emitted.
  if (!process.noProcessWarnings && process.env.NODE_NO_WARNINGS !== '1') {
    process.emitWarning = noop
    return;
  }

  let deprecationWarnings;

  // process.emitWarning(error)
  // process.emitWarning(str[, type[, code]][, ctor])
  // process.emitWarning(str[, options])
  process.emitWarning = (warning, type, code, ctor) => {
    let detail;
    if (type !== null && typeof type === 'object' && !Array.isArray(type)) {
      ctor = type.ctor;
      code = type.code;
      if (typeof type.detail === 'string')
        detail = type.detail;
      type = type.type || 'Warning';
    } else if (typeof type === 'function') {
      ctor = type;
      code = undefined;
      type = 'Warning';
    }
    if (type !== undefined && typeof type !== 'string') {
      throw new ERR_INVALID_ARG_TYPE('type', 'string', type);
    }
    if (typeof code === 'function') {
      ctor = code;
      code = undefined;
    } else if (code !== undefined && typeof code !== 'string') {
      throw new ERR_INVALID_ARG_TYPE('code', 'string', code);
    }
    if (typeof warning === 'string') {
      // eslint-disable-next-line no-restricted-syntax
      warning = new Error(warning);
      warning.name = String(type || 'Warning');
      if (code !== undefined) warning.code = code;
      if (detail !== undefined) warning.detail = detail;
      Error.captureStackTrace(warning, ctor || process.emitWarning);
    } else if (!(warning instanceof Error)) {
      throw new ERR_INVALID_ARG_TYPE('warning', ['Error', 'string'], warning);
    }
    let trace = process.traceProcessWarnings;
    if (warning.name === 'DeprecationWarning') {
      if (process.noDeprecation)
        return;
      if (process.throwDeprecation)
        throw warning;
      if (deprecationWarnings === undefined) {
        deprecationWarnings = new Set();
      }
      if (deprecationWarnings.has(code)) {
        return;
      }
      deprecationWarnings.add(code);
      if (!trace) {
        trace = process.traceDeprecation;
      }
    }

    process.emit('warning', warning);

    let msg = prefix;
    if (warning.code)
      msg += `[${warning.code}] `;
    if (trace && warning.stack) {
      msg += `${warning.stack}`;
    } else {
      const toString =
        typeof warning.toString === 'function' ?
          warning.toString : Error.prototype.toString;
      msg += `${toString.call(warning)}`;
    }
    if (typeof warning.detail === 'string') {
      msg += `\n${warning.detail}`;
    }

    if (typeof warningFile === 'string') {
      acquireFd(msg);
      return;
    }
    writeOut(msg);
  };
}
