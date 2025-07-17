import { config } from 'dotenv';
import { z } from 'zod';

config();

const SettingsSchema = z.object({
  id_vps: z.string().min(1, 'ID_VPS is required'),
  discord_webhook_url: z.string().url().optional(),
  gemini_api_key: z.string().min(1, 'GEMINI_API_KEY is required'),
});

const LoginSettingsSchema = z.object({
  username: z.string().min(1, 'USERNAME is required'),
  password: z.string().min(1, 'PASSWORD is required'),
  totp_secret: z.string().optional(),
});

export class Settings {
  public readonly id_vps: string;
  public readonly discord_webhook_url?: string;
  public readonly gemini_api_key: string;

  constructor() {
    const env = {
      id_vps: process.env.ID_VPS,
      discord_webhook_url: process.env.DISCORD_WEBHOOK_URL,
      gemini_api_key: process.env.GEMINI_API_KEY,
    };

    const validated = SettingsSchema.parse(env);
    this.id_vps = validated.id_vps;
    this.discord_webhook_url = validated.discord_webhook_url;
    this.gemini_api_key = validated.gemini_api_key;
  }
}

export class LoginSettings {
  public readonly username: string;
  public readonly password: string;
  public readonly totp_secret?: string;

  constructor() {
    const env = {
      username: process.env.USERNAME,
      password: process.env.PASSWORD,
      totp_secret: process.env.TOTP_SECRET,
    };

    const validated = LoginSettingsSchema.parse(env);
    this.username = validated.username;
    this.password = validated.password;
    this.totp_secret = validated.totp_secret;
  }
}