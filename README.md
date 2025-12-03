# Sorry I Missed This (SIMT)

## What is SIMT?

SIMT is a relationship management application that helps you stay connected with important people in your life through your iMessage conversations. It provides AI-powered conversation prompts to help you reach out to friends and family.

## System Requirements

- **macOS 10.15 or later** (required for iMessage integration)
- At least 2GB of free disk space
- Internet connection
- Active iMessage account

## Quick Setup (Recommended)

### Step 1: Download the Application

Open Terminal (Applications > Utilities > Terminal) and run:

```bash
git clone https://github.com/wasumayan/SorryIMissedThis
cd SorryIMissedThis
```

### Step 2: Run the Setup Script

Simply run our automated setup script:

```bash
./setup.sh
```

This script will:
- Check and install required software (Python 3.9+, Node.js 18+)
- Set up the backend server
- Set up the frontend application
- Set up the iMessage integration
- Create convenient launch scripts

The setup takes about 5-10 minutes depending on your internet connection.

### Step 3: Start the Application

After setup completes, you can start the application by either:

**Option A: Double-click to start (easiest)**
- Find `start-all.command` in the SorryIMissedThis folder
- Double-click it
- This will automatically open 2-3 terminal windows with all services running

**Option B: Start manually**

Open separate terminal windows and run:
```bash
# Terminal 1 - Backend
./start-backend.sh

# Terminal 2 - Frontend
./start-frontend.sh

# Terminal 3 - iMessage Bridge (optional, only if you configured Photon)
./start-photon.sh
```

**Note:** You only need 2 terminals (backend + frontend) to use the app. The photon-server (Terminal 3) is only needed if you want iMessage integration. See "iMessage Integration Setup" section below.

### Step 4: Access the Application

Once all services are running, open your browser to:
```
http://localhost:5173
```

You should see the SIMT welcome page.

## Creating Your Account

1. Enter your Name, then hit "Continue"
2. Hit the "Connect to iMessage" button
3. Select Chats Manually (15) then hit "Continue"
4. Click "Get Started" 
5. Click "Enroll in the Study"
6. Follow the study 


## Using the Application

### Daily Usage

During the study, you will:

1. Use the application to manage your relationships
2. Connect your iMessage to sync conversations
3. Receive AI-generated prompts for reaching out to contacts
4. Complete brief surveys at the end of each study phase
5. The study consists of 3 phases, each lasting 1 day

### What Gets Tracked

- Number of messages you send
- How often you interact with AI prompts
- Whether you accept, edit, or dismiss suggestions
- Your survey responses

### What Does NOT Get Tracked

- The actual content of your messages
- Personal information about your contacts
- Any data outside the SIMT application

## iMessage Integration Setup

To use iMessage features with SIMT:

1. **Sign up for Photon** at [photon.codes](https://photon.codes)
2. Follow their setup instructions to connect your Mac
3. Get your Photon server URL (e.g., `yourname.imsgd.photon.codes`)
4. Edit `photon-server/.env` and add your URL:
   ```
   PHOTON_SERVER_URL=https://yourname.imsgd.photon.codes
   ```
5. Restart the photon server

For detailed iMessage setup instructions, see `photon-server/README.md`

## Troubleshooting

### Setup script fails

If the automated setup fails:
- Make sure you have a stable internet connection
- Try running `./setup.sh` again
- Contact the research team if issues persist

### Application won't start

**Backend won't start:**
- Check that port 5002 is not in use by another application
- Make sure you're in the correct directory
- Try: `cd backend && source venv/bin/activate && python run.py`

**Frontend won't start:**
- Check that port 5173 is not in use
- Make sure Node.js is installed: `node --version`
- Try: `cd FigmaFrontEnd && npm install && npm run dev`

**iMessage integration not working:**
- Make sure you've set up your Photon account
- Check that `photon-server/.env` has your correct Photon URL
- Verify the photon server is running on port 3001
- See `photon-server/README.md` for detailed troubleshooting

### Application won't load in browser

1. Check that both backend and frontend terminals show no errors
2. Try a different browser (Chrome, Firefox, Safari, Edge)
3. Clear your browser cache
4. Try accessing `http://127.0.0.1:5173` instead

### Need to restart everything

1. Press Ctrl+C in all terminal windows to stop services
2. Run `./start-all.command` again
   OR
3. Run each start script manually in separate terminals

## Privacy & Data

### Your Data is Protected

- All data is stored in a secure Azure database
- Only aggregated, anonymized data will be used in research publications
- You can request to delete your data at any time
- The research team uses a password-protected admin interface to view anonymized study metrics

### Admin Dashboard Access

The research team can access study metrics using:
```
http://localhost:5002/api/study/stats/all?password=research2024
```

This shows ONLY anonymized participant IDs and usage statistics, NOT your personal messages or contact information.

## Study Timeline

1. **Day 1:** Phase 1 (Condition A)
2. **Day 2:** Phase 2 (Condition B) + Survey for Phase 1
3. **Day 3:** Phase 3 (Condition C) + Survey for Phase 2
4. **Day 4:** Final Survey for Phase 3

The system will automatically track which phase you're in and prompt you for surveys at the appropriate times.

## Common Questions

**Q: How long should I use the app each day?**
A: Use it naturally as you would any relationship management tool. There's no minimum required time.

**Q: Can I use my real contacts?**
A: Yes, the system is designed for real-world use with your actual relationships.

**Q: What if I need to skip a day?**
A: Contact the research team. We understand that life happens.

**Q: Can I quit the study?**
A: Yes, participation is voluntary. Contact the research team to withdraw.

**Q: Do I need to keep the terminal windows open?**
A: Yes, while using the application. You can minimize them, but don't close them.

## Support

If you encounter any issues during installation or usage:

**Contact the Research Team:**
- Email: jm3230@princeton.edu

## Uninstallation

After the study is complete, you can uninstall by:

1. Closing all terminal windows (Ctrl+C in each)
2. Deleting the `SorryIMissedThis` folder
3. (Optional) Uninstalling Python and Node.js if you don't need them:
   ```bash
   brew uninstall python@3.9 node
   ```

## Manual Setup (Advanced Users Only)

If you prefer to set up manually or if the automatic script doesn't work:

### Install Prerequisites

```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Python and Node.js
brew install python@3.9 node
```

### Backend Setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python run.py
```

### Frontend Setup

```bash
cd FigmaFrontEnd
npm install
npm run dev
```

### Photon Server Setup

```bash
cd photon-server
npm install
# Edit .env with your Photon URL
npm start
```

---

**Thank you for participating in our research!**

We appreciate your time and contribution to understanding how AI can help people maintain meaningful relationships.
