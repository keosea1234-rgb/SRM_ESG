import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('error_rate');
const dashboardTrend = new Trend('dashboard_duration');
const suppliersTrend = new Trend('suppliers_duration');

export const options = {
  vus: 50,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    error_rate: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const JWT_TOKEN = __ENV.JWT_TOKEN || '';

function authHeaders() {
  if (!JWT_TOKEN) return {};
  return { Authorization: `Bearer ${JWT_TOKEN}` };
}

export default function () {
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health: status 200': (r) => r.status === 200,
    'health: response ok': (r) => r.json('status') === 'ok',
  });
  errorRate.add(healthRes.status >= 500);

  sleep(0.5);

  const dashRes = http.get(`${BASE_URL}/api/dashboard/stats`, { headers: authHeaders() });
  dashboardTrend.add(dashRes.timings.duration);
  check(dashRes, {
    'dashboard: server responds': (r) => r.status !== 0,
    'dashboard: not 500': (r) => r.status !== 500,
  });
  errorRate.add(dashRes.status >= 500);

  sleep(0.5);

  const suppliersRes = http.get(`${BASE_URL}/api/suppliers`, { headers: authHeaders() });
  suppliersTrend.add(suppliersRes.timings.duration);
  check(suppliersRes, {
    'suppliers: server responds': (r) => r.status !== 0,
    'suppliers: not 500': (r) => r.status !== 500,
  });
  errorRate.add(suppliersRes.status >= 500);

  sleep(0.5);

  const esgRes = http.get(`${BASE_URL}/api/esg/summary`, { headers: authHeaders() });
  check(esgRes, {
    'esg: server responds': (r) => r.status !== 0,
    'esg: not 500': (r) => r.status !== 500,
  });
  errorRate.add(esgRes.status >= 500);

  sleep(1);
}

export function handleSummary(data) {
  return {
    'load-test-result.json': JSON.stringify(data, null, 2),
  };
}
