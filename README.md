# Xserver Auto Renew (TypeScript)

> **Note:** This repository has been archived due to the introduction of Cloudflare Turnstile, which has made automation significantly more difficult. We welcome anyone to fork this repository and continue development. If you succeed, we would appreciate hearing about it!

An automated tool for renewing Xserver's free VPS service to prevent expiration, rewritten in TypeScript.

This project is based on [fa0311/xserver-auto-renew](https://github.com/fa0311/xserver-auto-renew) and [GitHub30/extend-vps-exp](https://github.com/GitHub30/extend-vps-exp).

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

There are three main ways to use this tool:

### 1. Fork Repository + GitHub Actions (Recommended)

This is the easiest way to get started. GitHub Actions will automatically run the renewal process.

1. **Fork this repository** to your GitHub account
2. **Enable GitHub Actions** in your forked repository:
   - Go to the "Actions" tab in your repository
   - Click "I understand my workflows, go ahead and enable them"
3. **Configure secrets** in your repository:
   - Go to Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `ID_VPS`: Your VPS ID from Xserver
     - `USERNAME`: Your Xserver account username
     - `PASSWORD`: Your Xserver account password
     - `GEMINI_API_KEY`: Your Google Gemini API key
     - `DISCORD_WEBHOOK_URL`: (Optional) Discord webhook URL for notifications
4. **Automatic execution**: The workflow will run daily at 9:00 AM JST
5. **Manual execution**: You can also trigger it manually from the Actions tab

### 2. Docker Self-Hosting

Run the application on your own server using Docker with automated scheduling.

#### Using Docker Compose (Recommended)

1. **Clone the repository**:

   ```bash
   git clone https://github.com/minagishl/xserver-auto-renew.git
   cd xserver-auto-renew
   ```

2. **Create environment file**:

   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

#### Manual Docker Setup

1. **Build the Docker image**:

   ```bash
   docker build -t xserver-auto-renew .
   ```

2. **Run the container**:
   ```bash
   docker run --rm \
     -e ID_VPS="your_vps_id" \
     -e USERNAME="your_username" \
     -e PASSWORD="your_password" \
     -e GEMINI_API_KEY="your_gemini_api_key" \
     -e DISCORD_WEBHOOK_URL="your_discord_webhook_url" \
     xserver-auto-renew
   ```

#### Setting up Cron for Automated Execution

Add a cron job to run the Docker container daily:

```bash
# Edit crontab
crontab -e

# Add this line to run daily at 9:00 AM JST (adjust timezone as needed)
0 9 * * * docker run --rm -e ID_VPS="your_vps_id" -e USERNAME="your_username" -e PASSWORD="your_password" -e GEMINI_API_KEY="your_gemini_api_key" -e DISCORD_WEBHOOK_URL="your_discord_webhook_url" xserver-auto-renew
```

### 3. Local Development

Run the renewal script locally for testing and development:

```bash
# Install dependencies
pnpm install

# Create .env file with your credentials
cp .env.example .env

# Run the script
pnpm start
```

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
