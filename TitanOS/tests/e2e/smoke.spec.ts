import { test, expect } from '@playwright/test';

test.describe('Smoke Tests', () => {
  test('should load the main page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/TitanOS/);
    await expect(page.locator('h1')).toHaveText('Welcome to TitanOS');
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Login');
    await expect(page).toHaveURL(/login/);
    await expect(page.locator('h2')).toHaveText('Login');
  });

  test('should register a new user', async ({ page }) => {
    await page.goto('/register');
    await page.fill('input[name="email"]', 'testuser@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page.locator('h1')).toHaveText('Registration Successful');
  });

  test('should log in with valid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'testuser@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page.locator('h1')).toHaveText('Dashboard');
  });

  test('should log out successfully', async ({ page }) => {
    await page.goto('/dashboard');
    await page.click('text=Logout');
    await expect(page).toHaveURL(/login/);
    await expect(page.locator('h2')).toHaveText('Login');
  });
});