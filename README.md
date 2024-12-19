# Jelly Tasks

A Chrome/Edge browser extension that provides quick access to Google Tasks, allowing you to view, create, and manage your tasks directly from the browser toolbar.

## Features

- View all your Google Tasks lists
- Create new tasks with titles and optional notes
- Mark tasks as complete/incomplete
- Clean, modern interface
- Secure Google OAuth2 authentication

## Branch Structure

The repository has two main branches:

### master (Development)
- Used for development and testing
- Contains the manifest key for consistent extension ID during testing
- All new features and changes should be made here first
- Current extension ID: `aganahgeappngacbjcolbfhinhhjmgpn`

### production
- Matches what's submitted to the store
- No manifest key (store assigns its own ID)
- Store extension ID: `enlnahggfholgnfjndgmkabbpiaocna`
- Merge from master when ready for store submission

## Development Workflow

1. **Making Changes**
   - Work in the `master` branch
   - Test thoroughly with the development extension ID
   - Commit and push changes to `master`

2. **Store Submission**
   - Merge changes from `master` to `production`
   - Remove the manifest key if present
   - Create a new build in `builds/v1.0/`
   - Submit the new build to the store

3. **Common Git Commands**
   ```bash
   # Switch to master for development
   git checkout master

   # Create a new feature branch (optional)
   git checkout -b feature-name

   # Commit changes
   git add .
   git commit -m "Description of changes"
   git push

   # Prepare for store submission
   git checkout production
   git merge master
   # Remove key from manifest.json
   git add manifest.json
   git commit -m "Update for store submission"
   git push
   ```

## Setup Instructions

### 1. Create a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Tasks API:
   - Go to "APIs & Services" > "Library"
   - Search for "Tasks API"
   - Click "Enable"

### 2. Configure OAuth Consent Screen

1. In the Google Cloud Console, go to "APIs & Services" > "OAuth consent screen"
2. Select "External" as the user type (unless you're using Google Workspace)
3. Fill in the required information:
   - App name: "Google Tasks Extension" (or your preferred name)
   - User support email: Your email address
   - Developer contact information: Your email address
4. Click "Save and Continue"
5. On the "Scopes" page:
   - Click "Add or Remove Scopes"
   - Search for and select these scopes:
     - `https://www.googleapis.com/auth/tasks`
     - `https://www.googleapis.com/auth/tasks.readonly`
   - Click "Update"
6. Click "Save and Continue"
7. On the "Test users" page:
   - Click "Add Users"
   - Add your Google email address
   - Click "Save and Continue"
8. Review your settings and click "Back to Dashboard"

### 3. Configure OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Chrome Extension" as the application type
4. Add your extension ID to the authorized origins
   - To get your extension ID:
     1. Open Chrome/Edge
     2. Go to the extensions page (chrome://extensions or edge://extensions)
     3. Enable "Developer mode"
     4. Load your extension unpacked
     5. Copy the generated extension ID
5. Click "Create"
6. Copy the generated Client ID

### 4. Configure the Extension

1. Open `manifest.json`
2. Update the `oauth2.client_id` field with your OAuth client ID
3. If you're developing for both Chrome and Edge:
   - Create separate OAuth clients for each browser
   - Update both client IDs in `popup.js`
   - The extension will automatically use the correct ID based on the browser

### 5. Install the Extension

#### Chrome
1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the directory containing your extension files

#### Edge
1. Open Edge and go to `edge://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the directory containing your extension files

## Usage

1. Click the extension icon in your browser toolbar
2. Sign in with your Google account when prompted
   - Note: Since this is a development version, you'll see an "Unverified app" warning
   - Click "Continue" to proceed (only your added test users can do this)
3. View your tasks and task lists
4. Create new tasks using the "+ New Task" button
5. Mark tasks as complete by clicking the checkbox

## Development

The extension is built using:
- HTML5
- CSS3
- JavaScript (ES6+)
- Google Tasks API

## Files Structure

```
├── manifest.json      # Extension manifest
├── popup.html        # Main popup interface
├── popup.js         # JavaScript functionality
├── styles.css       # Styling
└── icons/           # Extension icons
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Security

- Uses OAuth 2.0 for secure authentication
- Requires minimal permissions
- No sensitive data is stored locally

## Publishing

Note: If you plan to publish this extension to the Chrome Web Store or Edge Add-ons store, you'll need to:
1. Verify your domain ownership
2. Submit your application for OAuth verification
3. Provide additional documentation and undergo security assessment 