import { test, expect } from '@playwright/test';

test('Dashboard - Check new components', async ({ page }) => {
  // Navigate to the application
  await page.goto('https://aws1.c6web.com');

  // Login
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'socDemo2025!');
  await page.click('button[type="submit"]');

  // Wait for navigation after login
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  
  // Wait a bit for data to load
  await page.waitForTimeout(2000);

  // Take a screenshot of the dashboard
  await page.screenshot({ path: 'dashboard-full.png', fullPage: true });

  // Check for Severity Distribution chart
  const severityChart = page.locator('text=Severity Distribution');
  await expect(severityChart).toBeVisible();
  console.log('✓ Severity Distribution found');

  // Check for Top Attack Sources
  const attackSources = page.locator('text=Top Attack Sources');
  await expect(attackSources).toBeVisible();
  console.log('✓ Top Attack Sources found');

  // Check for chart toggle buttons (Bar/Pie)
  const chartToggles = page.locator('button[title="Bar Chart"], button[title="Pie Chart"]');
  const toggleCount = await chartToggles.count();
  console.log(`Found ${toggleCount} chart toggle buttons`);

  // Check for map view toggle buttons (List/Map)
  const mapToggles = page.locator('button[title="List View"], button[title="Map View"]');
  const mapToggleCount = await mapToggles.count();
  console.log(`Found ${mapToggleCount} map toggle buttons`);

  // Take screenshot of severity chart area
  const severitySection = page.locator('text=Severity Distribution').locator('..');
  await severitySection.screenshot({ path: 'severity-chart.png' });

  // Take screenshot of attack sources area
  const attackSection = page.locator('text=Top Attack Sources').locator('..');
  await attackSection.screenshot({ path: 'attack-sources.png' });

  // Check console for any errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('Browser Error:', msg.text());
    }
  });

  // Log page content for debugging
  const bodyText = await page.locator('body').textContent();
  console.log('Page contains "Severity Distribution":', bodyText?.includes('Severity Distribution'));
  console.log('Page contains "Top Attack Sources":', bodyText?.includes('Top Attack Sources'));
});
