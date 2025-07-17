import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import { setTimeout } from 'node:timers/promises';
import { Settings, LoginSettings } from './settings';
import { DiscordWebhook } from './discord';
import { GoogleGenAI } from '@google/genai';
import * as speakeasy from 'speakeasy';
import { PuppeteerScreenRecorder } from 'puppeteer-screen-recorder';
import {
	processImageReplaceBlackAndThicken,
	processImageWithJimpWhiteBackground,
	processImageWithJimpBlackBackground,
} from './image';
import Jimp from 'jimp';

function generateTOTPCode(secret: string): string {
	return speakeasy.totp({
		secret: secret,
		encoding: 'base32',
		algorithm: 'sha1',
		digits: 6,
	});
}

async function solveCaptchaWithMultipleMethods(
	imageData: string,
	geminiApiKey: string
): Promise<string> {
	const ai = new GoogleGenAI({ apiKey: geminiApiKey });

	// Extract base64 data from data URL
	const base64Data = imageData.split(',')[1];
	const imageBuffer = Buffer.from(base64Data, 'base64');

	const replaceBlackThicken = await processImageReplaceBlackAndThicken(imageBuffer);

	// Try multiple preprocessing approaches
	const images = [
		{
			name: 'original',
			image: imageBuffer,
		},
		{
			name: 'jimp-white-background',
			image: await processImageWithJimpWhiteBackground(replaceBlackThicken),
		},
		{
			name: 'jimp-black-background',
			image: await processImageWithJimpBlackBackground(replaceBlackThicken),
		},
	];

	// Vertically concatenate original and processed images and send to Discord
	const jimpImages = await Promise.all(images.map(({ image }) => Jimp.read(image)));
	const width = Math.max(...jimpImages.map((img) => img.getWidth()));
	const totalHeight = jimpImages.reduce((sum, img) => sum + img.getHeight(), 0);
	const combinedImage = new Jimp(width, totalHeight, 0xffffffff);
	let yOffset = 0;
	for (const jimg of jimpImages) {
		combinedImage.composite(jimg, 0, yOffset);
		yOffset += jimg.getHeight();
	}
	const combinedBuffer = await combinedImage.getBufferAsync(Jimp.MIME_PNG);
	const debugPath = `debug_captcha_${Date.now()}.png`;
	await fs.writeFile(debugPath, combinedBuffer);
	const settings = new Settings();
	if (settings.discord_webhook_url) {
		const debugDiscord = new DiscordWebhook(settings.discord_webhook_url);
		await debugDiscord.sendFile(debugPath, 'Concatenated CAPTCHA debug image');
		await fs.unlink(debugPath);
	}

	// Send all processed images to Gemini simultaneously
	const contents = [
		{
			role: 'user',
			parts: [
				{
					text: `Convert the Japanese characters in these CAPTCHA images to numbers.
These are the same CAPTCHA image processed with different methods.
Output ONLY the 6-digit number, nothing else.
If you see multiple possible interpretations, choose the most likely one.
The images have been processed to remove interfering lines, focus on the clear numbers.`,
				},
				...images.map((img) => ({
					inlineData: {
						data: img.image.toString('base64'),
						mimeType: 'image/png',
					},
				})),
			],
		},
	];

	const result = await ai.models.generateContent({
		model: 'gemini-2.5-pro',
		contents,
	});

	const text = result.text;
	console.log('Gemini response:', text);

	if (!text) {
		throw new Error('No response from Gemini');
	}

	const numberMatch = text.trim().match(/\d{6}/);

	if (numberMatch) {
		console.log(`CAPTCHA solved: ${numberMatch[0]}`);
		return numberMatch[0];
	} else {
		throw new Error(`Could not extract 6-digit number from: ${text}`);
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

	const [page] = await browser.pages();
	let recordingPath: string | null = null;
	let recorder: PuppeteerScreenRecorder | null = null;

	if (discord) {
		recordingPath = `recording_${Date.now()}.mp4`;
		recorder = new PuppeteerScreenRecorder(page);
		await recorder.start(recordingPath);
	}

	try {
		// Login process
		await page.goto('https://secure.xserver.ne.jp/xapanel/login/xvps/', {
			waitUntil: 'networkidle2',
		});

		await page.locator('#memberid').fill(loginEnv.username);
		await page.locator('#user_password').fill(loginEnv.password);
		await page.locator('text=ログインする').click();
		await page.waitForNavigation({ waitUntil: 'networkidle2' });

		// Check if redirected to 2FA page
		const currentUrl = page.url();
		if (currentUrl.includes('https://secure.xserver.ne.jp/xapanel/myaccount/twostepauth/index')) {
			console.log('Two-factor authentication required');

			if (!loginEnv.totp_secret) {
				throw new Error('Two-factor authentication is required but TOTP_SECRET is not configured');
			}

			const totpCode = generateTOTPCode(loginEnv.totp_secret);

			await page.locator('input[name="auth_code"]').fill(totpCode);
			await page.locator('input[value="ログイン"]').click();
			await page.waitForNavigation({ waitUntil: 'networkidle2' });
		}

		console.log('Login successful!');

		// Navigate to VPS detail page
		await page.locator('a[href^="/xapanel/xvps/server/detail?id="]').click();

		// Start renewal process
		await page.locator('text=更新する').click();
		await page.locator('text=引き続き無料VPSの利用を継続する').click();
		await page.waitForNavigation({ waitUntil: 'networkidle2' });

		// Handle CAPTCHA
		const captchaImg = await page.$eval('img[src^="data:"]', (img: any) => img.src);
		const captchaCode = await solveCaptchaWithMultipleMethods(captchaImg, env.gemini_api_key);

		await page.locator('[placeholder="上の画像の数字を入力"]').fill(captchaCode);
		await page.locator('text=無料VPSの利用を継続する').click();

		// Wait for navigation and result page to fully render
		await page.waitForNavigation({ waitUntil: 'networkidle2' });

		// Wait for the result message to appear and page to fully render
		try {
			await page.waitForSelector('body', { timeout: 10000 });
			await setTimeout(2000); // Additional wait for complete rendering
		} catch {
			console.log('Timeout waiting for result page, proceeding with content check');
		}

		const pageContent = await page.content();

		if (pageContent.includes('利用期限の更新手続きが完了しました。')) {
			console.log('Done!');
			// Wait additional time to ensure completion message is fully displayed
			await setTimeout(3000);
			if (discord) {
				await discord.sendMessage('Xserver VPS renewal completed successfully!');
			}
		} else if (pageContent.includes('利用期限の1日前から更新手続きが可能です。')) {
			console.log('Failed, please try again a day before.');
			await setTimeout(2000); // Wait for message to be fully displayed
			if (discord) {
				await discord.sendMessage(
					'Xserver VPS renewal failed: Please try again a day before expiration.'
				);
			}
		} else {
			const error = 'Failed to renew VPS';
			await setTimeout(2000); // Wait for any error message to be displayed
			if (discord) {
				await discord.sendMessage(`Xserver VPS renewal failed: ${error}`);
			}
			throw new Error(error);
		}
	} catch (error) {
		console.error('Error:', error);
		if (discord) {
			await discord.sendMessage(`Xserver VPS renewal encountered an error: ${error}`);
		}
		throw error;
	} finally {
		await setTimeout(5000);

		// Stop recording and send file regardless of success/failure
		if (recorder && discord && recordingPath) {
			try {
				await recorder.stop();
				await discord.sendFile(recordingPath, 'Xserver VPS renewal process recording');
				await fs.unlink(recordingPath);
			} catch (uploadError) {
				console.error('Failed to upload recording:', uploadError);
			}
		}

		await browser.close();
	}
}

if (require.main === module) {
	main().catch(console.error);
}
