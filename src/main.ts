import fs from 'fs/promises';
import puppeteer from 'puppeteer';
import { setTimeout } from 'node:timers/promises';
import { Settings, LoginSettings } from './settings';
import { DiscordWebhook } from './discord';
import { GoogleGenAI } from '@google/genai';
import Jimp from 'jimp';
import sharp from 'sharp';
import * as speakeasy from 'speakeasy';

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
	geminiApiKey: string,
	discord: any
): Promise<string> {
	const ai = new GoogleGenAI({ apiKey: geminiApiKey });

	// Share original image to Discord
	if (discord) {
		try {
			const base64Data = imageData.split(',')[1];
			const imageBuffer = Buffer.from(base64Data, 'base64');
			const timestamp = Date.now();
			const originalPath = `captcha_original_${timestamp}.png`;
			await fs.writeFile(originalPath, imageBuffer);
			await discord.sendFile(originalPath, 'Original CAPTCHA image');
			await fs.unlink(originalPath);
		} catch (uploadError) {
			console.error('Failed to upload CAPTCHA image to Discord:', uploadError);
		}
	}

	// Extract base64 data from data URL
	const base64Data = imageData.split(',')[1];
	const imageBuffer = Buffer.from(base64Data, 'base64');

	// Try multiple preprocessing approaches
	const preprocessingMethods = [
		{
			name: 'original',
			process: async (buffer: Buffer) => {
				return buffer;
			},
		},
		{
			name: 'jimp-white-background',
			process: async (buffer: Buffer) => {
				const image = await Jimp.read(buffer);
				const width = image.bitmap.width;
				const height = image.bitmap.height;

				// Make everything white background
				image.scan(0, 0, width, height, function (_x: any, _y: any, idx: any) {
					const red = (this as any).bitmap.data[idx + 0];
					const green = (this as any).bitmap.data[idx + 1];
					const blue = (this as any).bitmap.data[idx + 2];

					const brightness = (red + green + blue) / 3;

					if (brightness < 150) {
						// Darker pixels (text and lines) -> black
						(this as any).bitmap.data[idx + 0] = 0;
						(this as any).bitmap.data[idx + 1] = 0;
						(this as any).bitmap.data[idx + 2] = 0;
					} else {
						// Light pixels (background) -> white
						(this as any).bitmap.data[idx + 0] = 255;
						(this as any).bitmap.data[idx + 1] = 255;
						(this as any).bitmap.data[idx + 2] = 255;
					}
				});

				return image
					.resize(300, 90)
					.contrast(0.3)
					.greyscale()
					.normalize()
					.getBufferAsync(Jimp.MIME_PNG);
			},
		},
		{
			name: 'jimp-black-background',
			process: async (buffer: Buffer) => {
				const image = await Jimp.read(buffer);
				const width = image.bitmap.width;
				const height = image.bitmap.height;

				// First process like white background
				image.scan(0, 0, width, height, function (_x: any, _y: any, idx: any) {
					const red = (this as any).bitmap.data[idx + 0];
					const green = (this as any).bitmap.data[idx + 1];
					const blue = (this as any).bitmap.data[idx + 2];

					const brightness = (red + green + blue) / 3;

					if (brightness < 150) {
						// Darker pixels (text and lines) -> black
						(this as any).bitmap.data[idx + 0] = 0;
						(this as any).bitmap.data[idx + 1] = 0;
						(this as any).bitmap.data[idx + 2] = 0;
					} else {
						// Light pixels (background) -> white
						(this as any).bitmap.data[idx + 0] = 255;
						(this as any).bitmap.data[idx + 1] = 255;
						(this as any).bitmap.data[idx + 2] = 255;
					}
				});

				// Apply processing
				const processedImage = image.resize(300, 90).contrast(0.3).greyscale().normalize();

				// Invert colors (white <-> black)
				return processedImage.invert().getBufferAsync(Jimp.MIME_PNG);
			},
		},
		{
			name: 'sharp-high-contrast',
			process: async (buffer: Buffer) => {
				return sharp(buffer).resize(300, 90).normalize().threshold(150).png().toBuffer();
			},
		},
		{
			name: 'edge-detection',
			process: async (buffer: Buffer) => {
				return sharp(buffer)
					.resize(300, 90)
					.convolve({
						width: 3,
						height: 3,
						kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1],
					})
					.negate()
					.threshold(200)
					.png()
					.toBuffer();
			},
		},
	];

	let bestResult = null;
	let maxConfidence = 0;
	let bestMethod = '';

	for (const method of preprocessingMethods) {
		try {
			const processedBuffer = await method.process(imageBuffer);
			const processedBase64 = processedBuffer.toString('base64');

			// Share processed image to Discord
			if (discord) {
				try {
					const timestamp = Date.now();
					const processedPath = `captcha_${method.name}_${timestamp}.png`;
					await fs.writeFile(processedPath, processedBuffer);
					await discord.sendFile(processedPath, `Processed CAPTCHA image (${method.name})`);
					await fs.unlink(processedPath);
				} catch (uploadError) {
					console.error(`Failed to upload processed image (${method.name}):`, uploadError);
				}
			}

			const prompt = `Convert the Japanese characters in this CAPTCHA image to numbers.
Output ONLY the 6-digit number, nothing else.
If you see multiple possible interpretations, choose the most likely one.
The image has been processed to remove interfering lines, focus on the clear numbers.`;

			const result = await ai.models.generateContent({
				model: 'gemini-2.5-flash',
				contents: [
					prompt,
					{
						inlineData: {
							data: processedBase64,
							mimeType: 'image/png',
						},
					},
				],
			});

			const text = result.text;

			if (!text) {
				console.log(`Method ${method.name} failed: No text response`);
				continue;
			}

			const numberMatch = text.trim().match(/\d{6}/);

			if (numberMatch) {
				// Simple confidence check based on response clarity
				const confidence = text.trim() === numberMatch[0] ? 1 : 0.8;
				console.log(`Method ${method.name} result: ${numberMatch[0]} (confidence: ${confidence})`);

				if (confidence > maxConfidence) {
					maxConfidence = confidence;
					bestResult = numberMatch[0];
					bestMethod = method.name;
				}
			} else {
				console.log(`Method ${method.name} failed: Could not extract 6-digit number from: ${text}`);
			}
		} catch (error) {
			console.error(`Method ${method.name} failed:`, error);
		}
	}

	if (bestResult) {
		console.log(`Best result: ${bestResult} (method: ${bestMethod}, confidence: ${maxConfidence})`);
		return bestResult;
	} else {
		throw new Error('Could not extract 6-digit number from CAPTCHA with any method');
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

	if (discord) {
		recordingPath = `recording_${Date.now()}.webm`;
		await page.screencast({ path: recordingPath as `${string}.webm` });
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
		const captchaCode = await solveCaptchaWithMultipleMethods(
			captchaImg,
			env.gemini_api_key,
			discord
		);

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
		if (discord && recordingPath) {
			try {
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
