import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import { setTimeout } from 'node:timers/promises';
import { Settings, LoginSettings } from './settings';
import { DiscordWebhook } from './discord';
import { GoogleGenAI } from '@google/genai';

async function solveCaptcha(imageData: string, geminiApiKey: string): Promise<string> {
	const ai = new GoogleGenAI({ apiKey: geminiApiKey });

	// Extract mime type and base64 data from data URL
	const mimeType = imageData.split(',')[0].split(':')[1].split(';')[0];
	const base64Data = imageData.split(',')[1];

	const prompt = `Convert the Japanese characters in the image to numbers and output only the numbers.
The length of the numbers is 6 characters.`;

	const result = await ai.models.generateContent({
		model: 'gemini-2.5-pro',
		contents: [
			prompt,
			{
				inlineData: {
					data: base64Data,
					mimeType: mimeType,
				},
			},
		],
	});

	const text = result.text;

	if (!text) {
		throw new Error('Could not generate text from CAPTCHA');
	}

	const numberMatch = text.match(/\d{6}/);
	if (numberMatch) {
		return numberMatch[0];
	} else {
		throw new Error('Could not extract 6-digit number from CAPTCHA');
	}
}

async function main(): Promise<void> {
	const env = new Settings();
	const loginEnv = new LoginSettings();

	let discord: DiscordWebhook | null = null;
	if (env.discord_webhook_url) {
		discord = new DiscordWebhook(env.discord_webhook_url);
	}

	const args = ['--no-sandbox', '--disable-setuid-sandbox'];

	const browser = await puppeteer.launch({
		headless: 'new',
		defaultViewport: { width: 1080, height: 1024 },
		args,
	});

	try {
		const [page] = await browser.pages();

		let recordingPath: string | null = null;
		if (discord) {
			recordingPath = `recording_${Date.now()}.webm`;
			await page.screencast({ path: recordingPath as `${string}.webm` });
		}

		// Login process
		await page.goto('https://secure.xserver.ne.jp/xapanel/login/xvps/', {
			waitUntil: 'networkidle2',
		});

		await page.locator('#memberid').fill(loginEnv.username);
		await page.locator('#user_password').fill(loginEnv.password);
		await page.locator('text=ログインする').click();
		await page.waitForNavigation({ waitUntil: 'networkidle2' });

		console.log('Login successful!');

		// Navigate to VPS detail page
		await page.locator('a[href^="/xapanel/xvps/server/detail?id="]').click();

		// Start renewal process
		await page.locator('text=更新する').click();
		await page.locator('text=引き続き無料VPSの利用を継続する').click();
		await page.waitForNavigation({ waitUntil: 'networkidle2' });

		// Handle CAPTCHA
		const captchaImg = await page.$eval('img[src^="data:"]', (img: any) => img.src);
		const captchaCode = await solveCaptcha(captchaImg, env.gemini_api_key);

		await page.locator('[placeholder="上の画像の数字を入力"]').fill(captchaCode);
		await page.locator('text=無料VPSの利用を継続する').click();

		// Wait for result
		await setTimeout(3000);
		const pageContent = await page.content();

		if (pageContent.includes('利用期限の更新手続きが完了しました。')) {
			console.log('Done!');
			if (discord) {
				await discord.sendMessage('Xserver VPS renewal completed successfully!');
			}
		} else if (pageContent.includes('利用期限の1日前から更新手続きが可能です。')) {
			console.log('Failed, please try again a day before.');
			if (discord) {
				await discord.sendMessage(
					'Xserver VPS renewal failed: Please try again a day before expiration.'
				);
			}
		} else {
			const error = 'Failed to renew VPS';
			if (discord) {
				await discord.sendMessage(`Xserver VPS renewal failed: ${error}`);
			}
			throw new Error(error);
		}

		if (discord && recordingPath) {
			await discord.sendFile(recordingPath, 'Xserver VPS renewal process completed');
			await fs.unlink(recordingPath);
		}
	} finally {
		await setTimeout(5000);
		await browser.close();
	}
}

if (require.main === module) {
	main().catch(console.error);
}
