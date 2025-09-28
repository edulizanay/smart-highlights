# Smart Highlights

An intelligent browser extension that uses AI to automatically highlight the most important phrases on web pages.

## Features

- **AI-Powered Highlighting**: Uses Grok-4-Fast via OpenRouter to intelligently select important phrases
- **Real-time Processing**: Extracts content and gets AI suggestions with one click
- **Smart Parsing**: Advanced response parsing with thinking tags for reliable AI output
- **Visual Feedback**: Clean highlighting with success/error indicators

## Architecture

- **Browser Extension** (`content.js`, `manifest.json`): Extracts page content and applies highlights
- **Backend Server** (`server.js`): Processes content through OpenRouter LLM API
- **AI Integration**: Uses structured prompts with thinking/response tags for reliable parsing

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file with your OpenRouter API key:
   ```
   OPENROUTERAI_API_KEY=your_api_key_here
   ```

3. Start the backend server:
   ```bash
   npm start
   ```

4. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select this directory

## Usage

1. Navigate to any webpage with multiple paragraphs
2. Click the 📝 floating button (appears on pages with >4 paragraphs)
3. Wait for AI processing
4. See intelligent highlights applied to important phrases

## Technology Stack

- **Backend**: Node.js, Express, OpenRouter API
- **AI Model**: x-ai/grok-4-fast
- **Frontend**: Vanilla JavaScript browser extension
- **Parsing**: Custom response tag extraction for reliable AI output
