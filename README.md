# Xserver Auto Renew (TypeScript)

An automated tool for renewing Xserver's free VPS service to prevent expiration, rewritten in TypeScript.

This project is based on [fa0311/xserver-auto-renew](https://github.com/fa0311/xserver-auto-renew).

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
```

## Usage

### Step 1: Generate Cookies (First Time Setup)

Generate authentication cookies using the automated login

```bash
pnpm run login
```

### Step 2: Run the Renewal Script

Run the renewal script

```bash
pnpm run renew
```

### Full Automation

You can run both steps automatically

```bash
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
- `USERNAME`: Your Xserver account username (required for automatic login)
- `PASSWORD`: Your Xserver account password (required for automatic login)

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

MIT
