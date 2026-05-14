import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('error_rate');
const dashboardTrend = new Trend('dashboard_duration');
const suppliersTrend = new Trend('suppliers_duration');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 5 },   // Ramp up to 5 users
    { duration: '1m',  target: 10 },  // Hold at 10 users
    { duration: '30s', target: 20 },  // Spike to 20 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests under 2s
    error_rate:        ['rate<0.05'],
  },
};

const BASE_URL = 'http://localhost:3001';

// Public endpoints (no auth required)
const PUBLIC_ENDPOINTS = [
  '/api/health',
];

export default function () {
  // 1. Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health: status 200': (r) => r.status === 200,
    'health: response ok': (r) => r.json('status') === 'ok',
  });
  errorRate.add(healthRes.status >= 500);

  sleep(0.5);

  // 2. Dashboard stats (expects 401 — auth required, but server must respond)
  const dashRes = http.get(`${BASE_URL}/api/dashboard/stats`);
  dashboardTrend.add(dashRes.timings.duration);
  check(dashRes, {
    'dashboard: server responds': (r) => r.status !== 0,
    'dashboard: not 500': (r) => r.status !== 500,
  });
  errorRate.add(dashRes.status >= 500);

  sleep(0.5);

  // 3. Suppliers list (expects 401 — auth required, but server must respond)
  const suppliersRes = http.get(`${BASE_URL}/api/suppliers`);
  suppliersTrend.add(suppliersRes.timings.duration);
  check(suppliersRes, {
    'suppliers: server responds': (r) => r.status !== 0,
    'suppliers: not 500': (r) => r.status !== 500,
  });
  errorRate.add(suppliersRes.status >= 500);

  sleep(0.5);

  // 4. ESG summary (expects 401 — auth required, but server must respond)
  const esgRes = http.get(`${BASE_URL}/api/esg/summary`);
  check(esgRes, {
    'esg: server responds': (r) => r.status !== 0,
    'esg: not 500': (r) => r.status !== 500,
  });
  errorRate.add(esgRes.status >= 500);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'k6/summary.json': JSON.stringify(data, null, 2),
  };
}
