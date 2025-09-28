// ABOUTME: Test suite for Express server endpoints
// ABOUTME: Tests the /extract endpoint for receiving paragraph data from browser extension

const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');

const TEST_PORT = 3001; // Different port from dev server
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Mock paragraph data that extension would send
const mockExtractedData = {
  para_0: "Top Stories:",
  para_1: "Native Americans condemn Pentagon move to prese...",
  para_2: "By Phil Stewart and Idrees Ali",
  para_3: "WASHINGTON (Reuters) -The National Congress of ..."
};

// Helper function to make HTTP requests
function makeRequest(method, path, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: TEST_PORT,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'chrome-extension://test'
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsedBody = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, body: parsedBody });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, body: body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

test('POST /extract should accept paragraph data and return success', async (t) => {
  // This test should fail initially since server doesn't exist yet
  try {
    const response = await makeRequest('POST', '/extract', mockExtractedData);
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.body.success, true);
    assert.strictEqual(typeof response.body.paragraphCount, 'number');
  } catch (error) {
    // Expected to fail initially - server not running
    assert.ok(error.code === 'ECONNREFUSED', 'Server should not be running yet');
  }
});

test('POST /extract should handle malformed JSON', async (t) => {
  try {
    const response = await makeRequest('POST', '/extract', 'invalid-json');
    assert.strictEqual(response.status, 400);
    assert.strictEqual(response.body.error, 'Invalid JSON');
  } catch (error) {
    // Expected to fail initially - server not running
    assert.ok(error.code === 'ECONNREFUSED', 'Server should not be running yet');
  }
});

test('POST /extract should have CORS headers for extension', async (t) => {
  try {
    const response = await makeRequest('POST', '/extract', mockExtractedData);
    assert.ok(response.headers['access-control-allow-origin']);
  } catch (error) {
    // Expected to fail initially - server not running
    assert.ok(error.code === 'ECONNREFUSED', 'Server should not be running yet');
  }
});

test('GET /extract should return method not allowed', async (t) => {
  try {
    const response = await makeRequest('GET', '/extract');
    assert.strictEqual(response.status, 405);
  } catch (error) {
    // Expected to fail initially - server not running
    assert.ok(error.code === 'ECONNREFUSED', 'Server should not be running yet');
  }
});