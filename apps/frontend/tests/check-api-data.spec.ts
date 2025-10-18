import { test, expect } from '@playwright/test';

test('Dashboard - Check API responses and data', async ({ page }) => {
  const apiResponses: any[] = [];

  // Intercept API calls
  page.on('response', async response => {
    const url = response.url();
    if (url.includes('/api/')) {
      try {
        const data = await response.json();
        apiResponses.push({
          url: url.split('/api/')[1],
          status: response.status(),
          data: data
        });
      } catch (e) {
        // Not JSON
      }
    }
  });

  // Navigate to the application
  await page.goto('https://aws1.c6web.com');

  // Login
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'socDemo2025!');
  await page.click('button[type="submit"]');

  // Wait for navigation after login
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  
  // Wait for API calls to complete
  await page.waitForTimeout(3000);

  // Print API responses
  console.log('\n=== API Responses ===');
  apiResponses.forEach(resp => {
    console.log(`\n${resp.url} (${resp.status}):`);
    console.log(JSON.stringify(resp.data, null, 2).substring(0, 500));
  });

  // Check if severity data has the right structure
  const severityResp = apiResponses.find(r => r.url.includes('severity-distribution'));
  if (severityResp) {
    console.log('\n=== Severity Distribution Data ===');
    console.log(JSON.stringify(severityResp.data, null, 2));
  }

  // Check if top sources data exists
  const topSourcesResp = apiResponses.find(r => r.url.includes('top-sources'));
  if (topSourcesResp) {
    console.log('\n=== Top Sources Data ===');
    console.log(JSON.stringify(topSourcesResp.data, null, 2));
  } else {
    console.log('\n=== Top Sources API NOT CALLED ===');
  }

  // Check what's in the severity chart area
  const severityArea = page.locator('text=Severity Distribution').locator('..').locator('..');
  const severityHTML = await severityArea.innerHTML();
  console.log('\n=== Severity Chart HTML (first 500 chars) ===');
  console.log(severityHTML.substring(0, 500));

  // Check what's in the attack sources area
  const attackArea = page.locator('text=Top Attack Sources').locator('..').locator('..');
  const attackHTML = await attackArea.innerHTML();
  console.log('\n=== Attack Sources HTML (first 500 chars) ===');
  console.log(attackHTML.substring(0, 500));
});
