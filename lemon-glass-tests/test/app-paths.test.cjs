const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveRendererRequestUrl
} = require('../app-paths.cjs');

const rendererRoot = path.resolve('renderer');

test('resolves the app root to index.html', () => {
  assert.equal(
    resolveRendererRequestUrl('avera://app/', rendererRoot),
    path.join(rendererRoot, 'index.html')
  );
});

test('resolves a normal renderer asset', () => {
  assert.equal(
    resolveRendererRequestUrl('avera://app/assets/app.js', rendererRoot),
    path.join(rendererRoot, 'assets', 'app.js')
  );
});

test('rejects traversal outside the renderer root', () => {
  assert.equal(
    resolveRendererRequestUrl('avera://app/%2e%2e%2fpackage.json', rendererRoot),
    null
  );
});

test('rejects another origin', () => {
  assert.equal(
    resolveRendererRequestUrl('https://example.com/index.html', rendererRoot),
    null
  );
});

test('rejects malformed encoded paths', () => {
  assert.equal(
    resolveRendererRequestUrl('avera://app/%E0%A4%A', rendererRoot),
    null
  );
});
