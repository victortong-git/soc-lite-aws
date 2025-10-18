import { test } from '@playwright/test';

test('Map view screenshot', async ({ page }) => {
  await page.goto('https://aws1.c6web.com');
  
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'socDemo2025!');
  await page.click('button[type="submit"]');
  
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.waitForTimeout(3000);
  
  // Click map view button
  const mapViewBtn = page.locator('button[title="Map View"]').first();
  await mapViewBtn.click();
  await page.waitForTimeout(1000);
  
  // Take screenshot of just the map area
  const mapCard = page.locator('text=Top Attack Sources').locator('..').locator('..');
  await mapCard.screenshot({ path: 'attack-map-view-detailed.png' });
  
  console.log('✓ Map view screenshot saved');
  console.log('Check attack-map-view-detailed.png to see the world map with attack markers');
});
