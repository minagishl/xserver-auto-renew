import axios from 'axios';
import fs from 'fs/promises';
import FormData from 'form-data';

export class DiscordWebhook {
	private webhookUrl: string;

	constructor(webhookUrl: string) {
		this.webhookUrl = webhookUrl;
	}

	async sendMessage(content: string): Promise<void> {
		await axios.post(this.webhookUrl, {
			content: content,
		});
	}

	async sendFile(filePath: string, message?: string): Promise<void> {
		const form = new FormData();
		const file = await fs.readFile(filePath);

		form.append('file', file, {
			filename: filePath.split('/').pop() || 'video.webm',
			contentType: 'video/webm',
		});

		if (message) {
			form.append('content', message);
		}

		await axios.post(this.webhookUrl, form, {
			headers: form.getHeaders(),
		});
	}
}
