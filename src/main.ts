import fs from 'fs/promises';
import axios, { AxiosRequestConfig } from 'axios';
import { Settings } from './settings';
import { DiscordWebhook } from './discord';
import type { Cookie, UserAgentHeaders, ChromeHeaders } from './types';

async function getUserAgent(): Promise<UserAgentHeaders> {
	const response = await axios.get<ChromeHeaders>(
		'https://raw.githubusercontent.com/fa0311/latest-user-agent/main/header.json'
	);

	const headers = { ...response.data.chrome };

	return {
		...headers,
		host: null,
		connection: null,
		'accept-encoding': null,
		'accept-language': 'ja',
	};
}

async function setCookies(cookies: Cookie[]): Promise<string> {
	return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
}

async function main(): Promise<void> {
	const env = new Settings();

	let discord: DiscordWebhook | null = null;
	if (env.discord_webhook_url) {
		discord = new DiscordWebhook(env.discord_webhook_url);
	}

	const userAgent = await getUserAgent();

	let cookiesData: string;
	try {
		cookiesData = await fs.readFile('cookies.json', 'utf-8');
	} catch {
		throw new Error('cookies.json not found. Please run "pnpm run login" first.');
	}

	const cookies: Cookie[] = JSON.parse(cookiesData);
	const cookieString = await setCookies(cookies);

	const axiosConfig: AxiosRequestConfig = {
		headers: {
			...userAgent,
			Cookie: cookieString,
		},
	};

	const response1 = await axios.get(
		'https://secure.xserver.ne.jp/xapanel/xvps/server/freevps/extend/index',
		{
			...axiosConfig,
			params: {
				id_vps: env.id_vps,
			},
		}
	);

	const uniqidPattern = /<input type="hidden" name="uniqid" value="([^"]+)" \/>/;
	const match = response1.data.match(uniqidPattern);

	if (!match) {
		throw new Error('Could not find uniqid in response');
	}

	const uniqid = match[1];

	const formData = new URLSearchParams();
	formData.append('uniqid', uniqid);
	formData.append('ethna_csrf', '');
	formData.append('id_vps', env.id_vps);

	const response2 = await axios.post(
		'https://secure.xserver.ne.jp/xapanel/xvps/server/freevps/extend/do',
		formData,
		{
			...axiosConfig,
			headers: {
				...axiosConfig.headers,
				'Content-Type': 'application/x-www-form-urlencoded',
			},
		}
	);

	if (response2.data.includes('利用期限の更新手続きが完了しました。')) {
		console.log('Done!');
		if (discord) {
			await discord.sendMessage('Xserver VPS renewal completed successfully!');
		}
	} else if (response2.data.includes('利用期限の1日前から更新手続きが可能です。')) {
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
}

if (require.main === module) {
	main().catch(console.error);
}
