// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

export const customErrorSerializer = (err: any) => {
  if (!err) return err;

  const serialized: any = {
    type: err.constructor?.name || err.name || 'Error',
    message: err.message || String(err),
  };

  if (err.code) serialized.code = err.code;
  if (err.statusCode) serialized.statusCode = err.statusCode;
  if (err.status) serialized.status = err.status;

  if (process.env['NODE_ENV'] !== 'production' || process.env['LOG_LEVEL'] === 'debug') {
    serialized.stack = err.stack;
  }

  Object.keys(err).forEach((key) => {
    if (!['message', 'stack', 'name', 'constructor'].includes(key)) {
      serialized[key] = err[key];
    }
  });

  return serialized;
};
