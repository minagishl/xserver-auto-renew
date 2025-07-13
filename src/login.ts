import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import { LoginSettings } from './settings';
import type { Cookie } from './types';

async function main(): Promise<void> {
  const env = new LoginSettings();

  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
  });

  try {
    const page = await browser.newPage();

    await page.goto('https://secure.xserver.ne.jp/xapanel/login/xvps/');

    await page.waitForSelector('#memberid');
    await page.type('#memberid', env.username);
    
    await page.waitForSelector('#user_password');
    await page.type('#user_password', env.password);

    await page.evaluate(() => {
      (globalThis as any).loginFunc();
    });

    while (page.url() !== 'https://secure.xserver.ne.jp/xapanel/xvps/index') {
      await page.waitForTimeout(1000);
    }

    const cookies = await page.cookies();
    const cookieData: Cookie[] = cookies.map(cookie => ({
      name: cookie.name,
      value: cookie.value,
      domain: cookie.domain,
      path: cookie.path,
      secure: cookie.secure,
    }));

    await fs.writeFile('cookies.json', JSON.stringify(cookieData, null, 4), 'utf-8');
    console.log('Cookies saved to cookies.json');
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}