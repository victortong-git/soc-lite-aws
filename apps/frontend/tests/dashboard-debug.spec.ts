import { test, expect } from '@playwright/test';

test('Dashboard - Debug console errors', async ({ page }) => {
  const consoleMessages: string[] = [];
  const errors: string[] = [];

  // Capture console messages
  page.on('console', msg => {
    const text = msg.text();
    consoleMessages.push(`[${msg.type()}] ${text}`);
    if (msg.type() === 'error') {
      errors.push(text);
    }
  });

  // Capture page errors
  page.on('pageerror', error => {
    errors.push(`Page Error: ${error.message}`);
  });

  // Navigate to the application
  await page.goto('https://aws1.c6web.com');

  // Login
  await page.fill('input[type="text"]', 'admin');
  await page.fill('input[type="password"]', 'socDemo2025!');
  await page.click('button[type="submit"]');

  // Wait for navigation after login
  await page.waitForURL('**/dashboard', { timeout: 10000 });
  
  // Wait for content to load
  await page.waitForTimeout(3000);

  // Check what's actually rendered
  const pageContent = await page.content();
  
  // Look for our components
  console.log('\n=== Component Check ===');
  console.log('Has SeverityChart:', pageContent.includes('Severity Distribution'));
  console.log('Has AttackSourceMap:', pageContent.includes('Top Attack Sources'));
  console.log('Has Card components:', pageContent.includes('class="'));
  
  // Check for specific elements
  console.log('\n=== Element Check ===');
  const cards = await page.locator('[class*="card"]').count();
  console.log('Card elements found:', cards);
  
  const buttons = await page.locator('button').count();
  console.log('Total buttons found:', buttons);
  
  // Try to find toggle buttons by different selectors
  const barChartBtn = await page.locator('button:has-text("Bar Chart")').count();
  const pieChartBtn = await page.locator('button:has-text("Pie Chart")').count();
  const listViewBtn = await page.locator('button:has-text("List View")').count();
  const mapViewBtn = await page.locator('button:has-text("Map View")').count();
  
  console.log('Bar Chart button:', barChartBtn);
  console.log('Pie Chart button:', pieChartBtn);
  console.log('List View button:', listViewBtn);
  console.log('Map View button:', mapViewBtn);

  // Check for SVG elements (charts and map)
  const svgElements = await page.locator('svg').count();
  console.log('SVG elements found:', svgElements);

  // Print all console messages
  console.log('\n=== Console Messages ===');
  consoleMessages.forEach(msg => console.log(msg));

  // Print errors
  if (errors.length > 0) {
    console.log('\n=== ERRORS FOUND ===');
    errors.forEach(err => console.log(err));
  } else {
    console.log('\n=== No errors found ===');
  }

  // Take full page screenshot
  await page.screenshot({ path: 'dashboard-debug.png', fullPage: true });
  
  // Get the HTML of the main content area
  const mainContent = await page.locator('main, [role="main"], .space-y-6').first().innerHTML();
  console.log('\n=== Main Content HTML (first 1000 chars) ===');
  console.log(mainContent.substring(0, 1000));
});
