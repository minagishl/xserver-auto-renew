import { config } from 'dotenv';
import { z } from 'zod';

config();

const SettingsSchema = z.object({
  id_vps: z.string().min(1, 'ID_VPS is required'),
  discord_webhook_url: z.string().url().optional(),
});

const LoginSettingsSchema = z.object({
  username: z.string().min(1, 'USERNAME is required'),
  password: z.string().min(1, 'PASSWORD is required'),
});

export class Settings {
  public readonly id_vps: string;
  public readonly discord_webhook_url?: string;

  constructor() {
    const env = {
      id_vps: process.env.ID_VPS,
      discord_webhook_url: process.env.DISCORD_WEBHOOK_URL,
    };

    const validated = SettingsSchema.parse(env);
    this.id_vps = validated.id_vps;
    this.discord_webhook_url = validated.discord_webhook_url;
  }
}

export class LoginSettings {
  public readonly username: string;
  public readonly password: string;

  constructor() {
    const env = {
      username: process.env.USERNAME,
      password: process.env.PASSWORD,
    };

    const validated = LoginSettingsSchema.parse(env);
    this.username = validated.username;
    this.password = validated.password;
  }
}