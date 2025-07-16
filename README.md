# Xserver Auto Renew (TypeScript)

An automated tool for renewing Xserver's free VPS service to prevent expiration, rewritten in TypeScript.

This project is based on [fa0311/xserver-auto-renew](https://github.com/fa0311/xserver-auto-renew) and [GitHub30/extend-vps-exp](https://github.com/GitHub30/extend-vps-exp).

> **Note:** We attempted to test the functionality, but new registrations have ended and we could not verify the operation. Please create an Issue if you encounter any problems.

## Overview

This TypeScript application automatically renews your Xserver free VPS service by simulating the manual renewal process through web scraping. It uses browser cookies to authenticate and perform the renewal operation, helping you maintain your free VPS without manual intervention.

## Features

- **Automated Renewal**: Automatically renews your Xserver free VPS service
- **Session Management**: Uses browser cookies for authentication
- **Error Handling**: Validates renewal success and provides clear error messages
- **Environment Configuration**: Secure configuration through environment variables
- **User Agent Spoofing**: Uses realistic browser headers to avoid detection
- **TypeScript**: Full type safety and modern JavaScript features

## Installation

1. Clone the repository

```bash
git clone https://github.com/your-username/xserver-auto-renew.git
cd xserver-auto-renew
```

2. Install dependencies

```bash
pnpm install
```

3. Set up environment variables:
   Create a `.env` file in the root directory

```env
ID_VPS=YOUR_VPS_ID_HERE
USERNAME=YOUR_USERNAME_OR_EMAIL_HERE
PASSWORD=YOUR_PASSWORD_HERE
GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
DISCORD_WEBHOOK_URL=YOUR_DISCORD_WEBHOOK_URL_HERE  # Optional
```

## Usage

### Local Development

Run the renewal script locally:

```bash
pnpm start
```

### GitHub Actions (Recommended)

This project includes GitHub Actions for automated execution:

1. **Automatic Daily Renewal**: Runs every day at 9:00 AM JST
2. **Manual Execution**: Can be triggered manually via GitHub Actions UI

#### Setup GitHub Actions

1. Go to your repository's Settings → Secrets and variables → Actions
2. Add the following secrets:
   - `ID_VPS`: Your VPS ID from Xserver
   - `USERNAME`: Your Xserver account username
   - `PASSWORD`: Your Xserver account password
   - `GEMINI_API_KEY`: Your Google Gemini API key
   - `DISCORD_WEBHOOK_URL`: (Optional) Discord webhook URL for notifications

3. The workflow will automatically run daily, or you can trigger it manually:
   - Go to Actions tab in your repository
   - Select "Auto Renew Xserver VPS" workflow
   - Click "Run workflow"

## Available Scripts

- `pnpm run build` - Compile TypeScript to JavaScript
- `pnpm run login` - Generate authentication cookies
- `pnpm run renew` - Execute VPS renewal
- `pnpm start` - Run full automation (login + renew)
- `pnpm run dev` - Run renewal script in development mode
- `pnpm run dev:login` - Run login script in development mode

## Configuration

### Environment Variables

Create a `.env` file with the following variables

- `ID_VPS`: Your VPS ID from Xserver (required)
- `USERNAME`: Your Xserver account username (required)
- `PASSWORD`: Your Xserver account password (required)
- `GEMINI_API_KEY`: Your Google Gemini API key (required)
- `DISCORD_WEBHOOK_URL`: Discord webhook URL for notifications (optional)

### File Structure

```
xserver-auto-renew/
├── src/
│   ├── types.ts       # Type definitions
│   ├── settings.ts    # Environment configuration
│   ├── login.ts       # Automated login with Puppeteer
│   └── main.ts        # Main renewal logic
├── dist/              # Compiled JavaScript (generated)
├── .env               # Environment variables
├── cookies.json       # Browser cookies (generated)
├── package.json
├── tsconfig.json
└── README.md
```

## Requirements

- Node.js 20+
- Chrome/Chromium browser (for Puppeteer)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
