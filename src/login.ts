import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import { LoginSettings, Settings } from './settings';
import { DiscordWebhook } from './discord';
import type { Cookie } from './types';

async function main(): Promise<void> {
	const env = new LoginSettings();
	const settings = new Settings();

	let discord: DiscordWebhook | null = null;
	if (settings.discord_webhook_url) {
		discord = new DiscordWebhook(settings.discord_webhook_url);
	}

	const browser = await puppeteer.launch({
		headless: false,
		defaultViewport: null,
		args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
	});

	try {
		const page = await browser.newPage();

		let recordingPath: string | null = null;
		if (discord) {
			recordingPath = `recording_${Date.now()}.webm`;
			await page.screencast({ path: recordingPath as `${string}.webm` });
		}

		await page.goto('https://secure.xserver.ne.jp/xapanel/login/xvps/');

		await page.waitForSelector('#memberid');
		await page.type('#memberid', env.username);

		await page.waitForSelector('#user_password');
		await page.type('#user_password', env.password);

		await page.evaluate(() => {
			(globalThis as any).loginFunc();
		});

		while (page.url() !== 'https://secure.xserver.ne.jp/xapanel/xvps/index') {
			await new Promise((resolve) => setTimeout(resolve, 1000));
		}

		const cookies = await page.cookies();
		const cookieData: Cookie[] = cookies.map((cookie) => ({
			name: cookie.name,
			value: cookie.value,
			domain: cookie.domain,
			path: cookie.path,
			secure: cookie.secure,
		}));

		await fs.writeFile('cookies.json', JSON.stringify(cookieData, null, 4), 'utf-8');
		console.log('Cookies saved to cookies.json');

		if (discord && recordingPath) {
			await discord.sendFile(recordingPath, 'Xserver login process completed');
			await fs.unlink(recordingPath);
		}
	} finally {
		await browser.close();
	}
}

if (require.main === module) {
	main().catch(console.error);
}
