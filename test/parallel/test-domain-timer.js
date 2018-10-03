'use strict';

const common = require('../common');
const assert = require('assert');
const domain = require('domain');
const util = require('util');

const d = new domain.Domain();

d.on('error', common.mustCall((err) => {
  assert.strictEqual(err.message, 'foobar');
  assert.strictEqual(err.domain, d);
  assert.strictEqual(err.domainEmitter, undefined);
  assert.strictEqual(err.domainBound, undefined);
  assert.strictEqual(err.domainThrown, true);
  assert(/domain:\n   Domain {/.test(util.inspect(err)));
}));

d.run(common.mustCall(() => {
  const timeout = setTimeout(common.mustCall(() => {
    throw new Error('foobar');
  }), 1);
  assert(/domain: \[Domain]/.test(util.inspect(timeout)));
}));
