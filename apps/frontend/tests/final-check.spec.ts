import { test, expect } from '@playwright/test';

test('Dashboard - Final check with fresh session', async ({ context, page }) => {
  // Clear all cookies and cache
  await context.clearCookies();
  
  // Navigate with cache bypass
  await page.goto('https://aws1.c6web.com', {
    waitUntil: 'networkidle'
  });

  // Login
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'socDemo2025!');
  await page.click('button[type="submit"]');

  // Wait for navigation
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: 'dashboard-final.png', fullPage: true });

  // Check for new components
  console.log('\n=== Checking for New Components ===');
  
  const severityChart = await page.locator('text=Severity Distribution').count();
  console.log('Severity Distribution found:', severityChart);
  
  const attackSources = await page.locator('text=Top Attack Sources').count();
  console.log('Top Attack Sources found:', attackSources);

  // Check for toggle buttons with SVG icons
  const barChartIcon = await page.locator('svg.lucide-bar-chart-3').count();
  const pieChartIcon = await page.locator('svg.lucide-pie-chart').count();
  const listIcon = await page.locator('svg.lucide-list').count();
  const mapIcon = await page.locator('svg.lucide-map').count();
  
  console.log('Bar Chart icon:', barChartIcon);
  console.log('Pie Chart icon:', pieChartIcon);
  console.log('List icon:', listIcon);
  console.log('Map icon:', mapIcon);

  // Check for recharts SVG elements
  const rechartsSvg = await page.locator('svg.recharts-surface').count();
  console.log('Recharts SVG elements:', rechartsSvg);

  // Check for old badge elements (should NOT exist)
  const oldBadges = await page.locator('.badge-safe, .badge-critical').count();
  console.log('Old badge elements (should be 0):', oldBadges);

  // Get page HTML and check for specific strings
  const html = await page.content();
  console.log('\nHTML contains "recharts":', html.includes('recharts'));
  console.log('HTML contains "lucide-bar-chart":', html.includes('lucide-bar-chart'));
  console.log('HTML contains "badge-safe" (old):', html.includes('badge-safe'));

  // Print a section of the severity chart area
  try {
    const severitySection = await page.locator('text=Severity Distribution').locator('..').locator('..').innerHTML();
    console.log('\n=== Severity Section HTML (first 800 chars) ===');
    console.log(severitySection.substring(0, 800));
  } catch (e) {
    console.log('Could not get severity section HTML');
  }
});
