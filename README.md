<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1F7QirFFBRRGsoNgauaGnOMs1cAav_F4t

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create a `.env` file in the root directory (copy from `.env.example`):
   ```bash
   cp .env.example .env
   ```
3. Set the required environment variables in `.env`:
   - `VITE_SUPABASE_URL` - Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` - Your Supabase anonymous key
   - `VITE_ADMIN_PASSWORD` - Password for admin panel access (default: jmgd68f4)
   - `VITE_SETTINGS_PASSWORD` - Password for settings access (default: adwcbkk25)
   - `GEMINI_API_KEY` - (Optional) Gemini API key for AI features
4. Run the app:
   `npm run dev`

## Security Notes

- **Never commit `.env` file to version control** - it contains sensitive passwords
- Change default passwords in production environments
- The `.env` file is already in `.gitignore` to prevent accidental commits
