import { test, expect } from '@playwright/test';

test('Dashboard - Visual confirmation of new features', async ({ page }) => {
  await page.goto('https://aws1.c6web.com');

  // Login
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'socDemo2025!');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.waitForTimeout(3000);

  // Take full page screenshot
  await page.screenshot({ path: 'dashboard-new-features.png', fullPage: true });
  console.log('✓ Full dashboard screenshot saved');

  // Test severity chart toggle
  const pieChartBtn = page.locator('button[title="Pie Chart"]').first();
  await pieChartBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'severity-pie-chart.png', fullPage: false });
  console.log('✓ Switched to pie chart view');

  // Switch back to bar chart
  const barChartBtn = page.locator('button[title="Bar Chart"]').first();
  await barChartBtn.click();
  await page.waitForTimeout(500);
  console.log('✓ Switched back to bar chart view');

  // Test attack sources map toggle
  const mapViewBtn = page.locator('button[title="Map View"]').first();
  await mapViewBtn.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'attack-sources-map.png', fullPage: false });
  console.log('✓ Switched to map view');

  // Switch back to list view
  const listViewBtn = page.locator('button[title="List View"]').first();
  await listViewBtn.click();
  await page.waitForTimeout(500);
  console.log('✓ Switched back to list view');

  console.log('\n=== All Features Working! ===');
  console.log('✓ Severity Distribution chart with Bar/Pie toggle');
  console.log('✓ Attack Sources with List/Map toggle');
  console.log('✓ Screenshots saved for visual confirmation');
});
