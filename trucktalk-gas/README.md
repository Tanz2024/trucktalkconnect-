# TruckTalk Connect - Google Apps Script Add-on

A Google Sheets add-on for logistics data management with AI-powered analysis and validation.

## 🎥 Demo Video

Watch TruckTalk Connect in action - AI-powered logistics data analysis with Google Sheets:

### 📹 **Live Demo Video**

<div align="center">

[![TruckTalk Connect Demo](https://github.com/Tanz2024/trucktalkconnect-/raw/master/trucktalk-gas/assets/video-thumbnail.jpg)](https://github.com/Tanz2024/trucktalkconnect-/raw/master/trucktalk-gas/assets/demo-video.mp4)

**🎬 Click the screenshot above to watch the full demo video**  
*See TruckTalk Connect in action - AI data analysis and auto-fix features*

[![Watch Video](https://img.shields.io/badge/📹_WATCH_DEMO_VIDEO-Click_to_Stream-red?style=for-the-badge&logo=youtube&logoColor=white&labelColor=red&color=black)](https://github.com/Tanz2024/trucktalkconnect-/raw/master/trucktalk-gas/assets/demo-video.mp4) [![Download Video](https://img.shields.io/badge/📥_Download_Video-MP4_124MB-blue?style=for-the-badge&logo=download)](https://github.com/Tanz2024/trucktalkconnect-/raw/master/trucktalk-gas/assets/demo-video.mp4)

</div>

---

**🎬 Video Highlights:**
- 📊 **Data Upload & Analysis** - See real spreadsheet data being processed
- 🤖 **AI Auto-Fix in Action** - Watch automatic error correction
- ✅ **Validation & Quality Check** - Complete data validation process  
- 📤 **JSON Export Process** - Ready-to-use structured output

---

## � **Project Assets & Media**

### 🎥 **Video Files**
- `assets/demo-video.mp4` - Complete demonstration (118MB)
- `assets/demo.gif` - Quick preview animation *(coming soon)*
- `assets/thumbnail.png` - Video thumbnail image *(coming soon)*

### 📸 **Screenshots** *(coming soon)*
- `assets/screenshot-analysis.png` - Analysis results view
- `assets/screenshot-ui.png` - Main interface overview
- `assets/screenshot-ai-fix.png` - AI auto-fix in action

### 📐 **Video Specifications**
- **Format:** MP4 (H.264 codec)
- **Resolution:** 1920x1080 (1080p)
- **Duration:** ~2 minutes
- **Content:** Complete workflow demonstration

### 🔗 **Alternative Video Access**
If the video doesn't play directly in GitHub:
1. **Download locally:** Click the video link above
2. **YouTube version:** *Upload pending*
3. **GIF preview:** *Coming soon for quick viewing*

> 💡 **Note:** GitHub has limitations with large video files. For best viewing experience, download the video locally or we can create a shorter GIF version.

> 🎯 **What you'll see:**
> - Real-time data analysis and validation
> - AI-powered error detection and auto-fixing
> - Smart column mapping and data transformation
> - JSON export ready for logistics systems
> - Complete workflow from raw data to structured output

### 🚀 **Key Features Demonstrated:**
- ⚡ **Instant Analysis** - Upload data and get immediate validation
- 🤖 **AI Auto-Fix** - Automatically corrects common data issues
- 📊 **Smart Mapping** - Intelligent column header recognition
- ✅ **Quality Assurance** - Comprehensive error detection
- 📤 **Export Ready** - Clean JSON output for integration

*Video shows the complete workflow from raw spreadsheet data to production-ready structured output.*

## Setup

### Prerequisites
- Google account
- Google Sheets access
- Node.js and npm (for development)

### Installation
1. Install Google Apps Script CLI
```bash
npm install -g @google/clasp
```

2. Login to Google
```bash
clasp login
```

3. Clone or create new Apps Script project
```bash
clasp create --type sheets --title "TruckTalk Connect"
```

4. Copy the project files to your Apps Script project
5. Push to Google Apps Script
```bash
clasp push
```


## Required Scopes

The add-on needs these permissions:
- `https://www.googleapis.com/auth/spreadsheets.currentonly` - Access current spreadsheet
- `https://www.googleapis.com/auth/script.external_request` - Make external API calls

These are configured in `appsscript.json` and will be requested during first use.

## How to Run

### Basic Usage
1. Open any Google Sheets document with your logistics data
2. Go to Extensions > TruckTalk Connect > Open TruckTalk Connect
3. Click "Analyze current tab" to validate your data
4. Review results in the Results tab
5. Apply suggested fixes or corrections
6. Copy the standardized JSON output

### Data Format
Your spreadsheet should contain logistics data with headers like:
- Load ID
- Pickup address and date
- Delivery address and date  
- Driver name and contact
- Status information

The system will automatically map your headers to standard fields.

## 📹 How to Add Your Demo Video

### Step 1: Record Your Video
1. Open your TruckTalk Connect add-on in Google Sheets
2. Use screen recording software (OBS, Camtasia, or built-in tools)
3. Record a 1-3 minute demo showing:
   - Opening the add-on
   - Analyzing sample data
   - Viewing results
   - Using AI fix features
   - Copying JSON output

### Step 2: Prepare Your Video File
1. **Format**: Save as MP4 (H.264 codec) for best compatibility
2. **Resolution**: 1280x720 or 1920x1080
3. **File Size**: Keep under 25MB for GitHub, or use external hosting
4. **Optional**: Create a GIF version for quick preview

### Step 3: Add to Repository
1. Save your video file in the `assets` folder:
   ```
   trucktalk-gas/
   └── assets/
       ├── demo-video.mp4     ← Your main video
       ├── demo-preview.gif   ← Optional GIF preview
       └── thumbnail.png      ← Optional thumbnail
   ```

2. Update the video section above with your actual filename

### Step 4: Alternative Hosting Options

#### Option A: YouTube (Recommended for longer videos)
1. Upload your video to YouTube
2. Get the video ID from the URL
3. Add thumbnail image to `assets/youtube-thumbnail.png`
4. Update README with:
   ```markdown
   [![TruckTalk Connect Demo](./assets/youtube-thumbnail.png)](https://www.youtube.com/watch?v=YOUR_VIDEO_ID)
   ```

#### Option B: Direct File Embed (For shorter videos)
1. Place MP4 file in `assets` folder
2. Update README with:
   ```markdown
   ![TruckTalk Connect Demo](./assets/your-video-name.mp4)
   ```

#### Option C: GIF Preview (For quick demos)
1. Convert your video to GIF (use tools like GIPHY, EZGIF, or FFMPEG)
2. Keep GIF under 10MB for best loading
3. Add to README with:
   ```markdown
   ![TruckTalk Connect Demo](./assets/demo.gif)
   ```

## Limitations

### Technical Limitations
- Requires internet connection for AI features
- Processing limited to current spreadsheet tab
- Maximum recommended dataset size is 1000 rows
- Response time depends on data complexity and API availability

### Data Limitations  
- Works best with tabular logistics data
- Complex nested structures not supported
- Some data types may require manual formatting
- AI suggestions need human review before applying

### Browser Support
- Optimized for Chrome and Edge browsers
- Limited functionality in Safari and Firefox
- Basic mobile browser support only

## File Structure

- `Code.gs` - Main backend functions and Google Apps Script integration
- `ui.html` - User interface structure and layout
- `ui_js.html` - Frontend JavaScript and interaction logic  
- `ui_css.html` - Styling and visual design
- `appsscript.json` - Project configuration and required permissions
- `.clasp.json` - CLASP deployment configuration

## Development

### Local Development
Use CLASP to sync changes between local files and Google Apps Script:
```bash
clasp pull  # Download latest from Apps Script
clasp push  # Upload local changes to Apps Script
```

### Testing
Test with sample data before using production datasets. The add-on includes validation to prevent data corruption.

## License

MIT License
