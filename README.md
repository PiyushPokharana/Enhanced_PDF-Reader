# Enhanced PDF Reader - Next.js Version

A modern, feature-rich PDF reader built with Next.js and React. Includes AI-powered document analysis, highlighting, notes, table of contents, and fullscreen viewing.

## Features

✨ **Core Features**
- 📄 Load and read PDF documents
- 🔍 Zoom in/out with fit-to-width and fit-to-height options
- ⬅️➡️ Navigate between pages (single and double-page modes)
- 🗂️ Automatic table of contents extraction
- 🖼️ Fullscreen reading mode with auto-hiding controls

✨ **Enhanced Features**
- 📝 **Highlighting**: Highlight text with multiple colors and review all highlights
- 📓 **Notes**: Rich text editor for taking notes with Quill
- 🤖 **AI Assistant**: Ask questions about your PDF using OpenAI API (requires API key)
- 🎨 **Dark Theme**: Beautiful dark mode interface optimized for reading

## Tech Stack

- **Framework**: [Next.js 15.1.0](https://nextjs.org/) - React framework with App Router
- **UI Framework**: [React 18.3.1](https://react.dev/) - UI library with hooks
- **PDF Rendering**: [PDF.js 4.4.168](https://mozilla.github.io/pdf.js/) - PDF document rendering
- **Text Editor**: [Quill 1.3.7](https://quilljs.com/) - Rich text editor
- **Styling**: CSS custom properties with dark mode support
- **Language**: TypeScript with TSX components

## Installation

### Prerequisites
- Node.js 18+ and npm/yarn

### Setup

```bash
# Navigate to the Next directory
cd Next

# Install dependencies
npm install

# or with yarn
yarn install
```

## Development

```bash
# Start development server
npm run dev

# or with yarn
yarn dev
```

The application will be available at `http://localhost:3000`

## Building for Production

```bash
# Create optimized build
npm run build

# Start production server
npm start

# or with yarn
yarn build
yarn start
```

## Usage

### Loading a PDF

1. **Click the upload button** or **drag and drop** a PDF file onto the upload area
2. The PDF will be processed and displayed in the reader
3. The table of contents will be automatically extracted (if available)

### Navigation

- **Previous/Next Buttons**: Navigate between pages
- **Arrow Keys**: Left arrow (previous), Right arrow (next)
- **Home/End Keys**: Jump to first/last page
- **Page Input**: Type a page number directly in the page info display

### Viewing Modes

- **Single Page**: Default view showing one page at a time
- **Double Page**: Side-by-side view for spreads (automatically handles odd pages)
- **Fullscreen**: Press F11 or click fullscreen button for immersive reading
  - Move mouse to show/hide controls
  - Press F11 again to exit

### Zooming

- **Zoom In**: Increase zoom level by 20%
- **Zoom Out**: Decrease zoom level by 20%
- **Fit Width**: Scale PDF to fit window width
- **Custom Zoom**: Type a zoom percentage (10% - 500%) directly
- **Scroll**: Use mouse wheel to scroll zoomed content

### Highlighting Text

1. **Select text** in the PDF by clicking and dragging
2. **Right-click** to open the highlight menu
3. **Choose a color** (yellow, green, blue, red) to highlight
4. View all highlights in the **Highlights** panel
5. Click a highlight to jump to that page

### Table of Contents

- **Left Panel**: Browse the PDF's table of contents
- **Click Items**: Click any TOC item to jump to that section
- **Status**: Shows how many items were found in the TOC

### Notes

- **Notes Panel**: Open the Notes tab to write notes
- **Rich Editing**: Use the toolbar for formatting (bold, italic, colors, lists, etc.)
- **Auto-Save**: Notes are saved to browser storage automatically
- Click the **Save Notes** button to explicitly save

### AI Assistant

#### Setup

1. **Get OpenAI API Key**
   - Visit [openai.com/api](https://openai.com/api) and sign up
   - Create an API key from your account settings
   - Ensure your account has credits or a paid plan

2. **Enter API Key**
   - Click the **AI** tab in the right panel
   - Paste your API key in the input field
   - Click **Save API Key**
   - The key is stored locally in your browser (never sent to external servers)

#### Using the AI Assistant

1. **Ask Questions**: Type questions about the PDF content
2. **Context**: The AI automatically uses nearby pages for context
3. **Multiple Queries**: Ask follow-up questions naturally
4. **Clear Chat**: Use the Clear Chat button to start a new conversation

#### Limitations & Notes

- Requires valid OpenAI API key with available credits
- Uses GPT-3.5-turbo model for fast responses
- Context limited to 3 pages around current view
- API costs apply based on OpenAI usage rates

### Data Storage

All data is stored locally in your browser:

- **Highlights**: Saved in `localStorage` as `pdf-reader-highlights`
- **Notes**: Saved in `localStorage` as `pdf-reader-notes`
- **API Key**: Saved in `localStorage` as `pdf-reader-api-key`

**Privacy Note**: API keys are stored only in your browser. Clear browser storage or disable localStorage to remove saved data.

## Project Structure

```
Next/
├── app/
│   ├── components/
│   │   └── PDFReaderApp.tsx      # Main PDF reader component
│   ├── globals.css                # Global styles (dark theme)
│   ├── layout.tsx                 # Root layout with metadata
│   └── page.tsx                   # Home page entry point
├── public/
│   └── app.js                     # Core PDF reader logic and event handlers
├── next.config.js                 # Next.js configuration
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── .gitignore                     # Git ignore rules
└── README.md                      # This file
```

### Key Files

- **PDFReaderApp.tsx**: Main React component wrapping the PDF reader UI
  - Client-side component with `'use client'` directive
  - Contains all HTML structure and JSX
  - Loads app.js dynamically for initialization

- **app.js**: Original PDF reader class-based JavaScript
  - `FixedEnhancedPDFReader` class with all logic
  - Event listeners and handlers
  - PDF rendering and manipulation
  - TOC extraction and AI integration

- **globals.css**: All application styles
  - CSS custom properties for theming
  - Dark mode color scheme
  - Component styles and animations
  - Responsive design

## Customization

### Changing Colors

Edit CSS custom properties in `app/globals.css`:

```css
:root {
  --color-bg: #0a0a0b;
  --color-fg: #ffffff;
  --color-accent: #22d3ee;
  --color-secondary: #a78bfa;
  --color-accent-dark: #164e63;
  /* ... more colors ... */
}
```

### Adjusting Layout

Modify layout variables in `app/globals.css`:

```css
:root {
  --sidebar-width: 320px;
  --right-panel-width: 380px;
  --header-height: 56px;
  --border-radius: 8px;
  /* ... more variables ... */
}
```

### Changing Fonts

Update font imports in `app/layout.tsx`:

```typescript
const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
});
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ← | Previous page |
| → | Next page |
| Home | First page |
| End | Last page |
| F11 | Toggle fullscreen |
| Shift + Enter | New line in AI input or notes |
| Enter | Send AI message (in chat mode) |

## Troubleshooting

### PDF Won't Load
- Ensure file is a valid PDF
- Check browser console for error messages
- Try a different PDF file

### AI Assistant Not Working
- Verify API key is correct (starts with `sk-`)
- Check that account has available credits
- Ensure document is loaded before asking questions
- Check network connection

### Highlights or Notes Not Saving
- Ensure localStorage is enabled in browser
- Check available storage space
- Try clearing browser cache and reloading

### Fullscreen Not Working
- Press F11 instead of clicking button (more reliable)
- Some browsers may have fullscreen restrictions
- Check browser security settings

### Performance Issues
- Try reducing zoom level
- Close unnecessary browser tabs
- Clear browser cache
- Try a different browser

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Opera 76+

## API Reference

### FixedEnhancedPDFReader Class

The main class in `app.js` provides:

**Navigation**
- `goToPage(pageNumber)` - Jump to specific page
- `nextPage()` / `previousPage()` - Navigate pages
- `toggleViewMode()` - Toggle single/double page view

**Zoom**
- `zoomIn()` / `zoomOut()` - Adjust zoom level
- `toggleFitWidth()` - Fit to window width
- `fitToHeight()` / `fitToHeight()` - Scale to height

**PDF Operations**
- `handleFileUpload(file)` - Load PDF file
- `extractTOC()` - Extract table of contents
- `renderCurrentPage()` - Re-render current page(s)

**Highlighting**
- `highlightSelectedText(color)` - Add highlight
- `updateHighlightsList()` - Refresh highlights display
- `clearAllHighlights()` - Remove all highlights

**AI Features**
- `saveApiKey()` - Store OpenAI API key
- `sendAIMessage()` - Send query to AI
- `callOpenAI(message, context)` - Direct API call
- `getDocumentContext()` - Extract document text

**UI Management**
- `switchToTab(tabName)` - Change panel tabs
- `toggleFullscreen()` - Enter/exit fullscreen
- `updateUIState()` - Refresh UI state

## Performance Notes

- Large PDFs (100+ pages) may have slower rendering
- First page takes slightly longer to render
- Zoom operations are cached for better performance
- AI requests depend on network and OpenAI API speed

## Known Limitations

- Double-page mode starts on odd pages for consistency
- TOC extraction depends on PDF having embedded bookmarks
- Text selection may not work on all PDFs (depends on PDF encoding)
- Fullscreen auto-hide works best with mouse movement

## Contributing

This is a demonstration project. Feel free to extend it with:
- Different PDF libraries
- Additional note-taking features
- More AI capabilities
- Annotation tools
- Bookmark management

## License

This project is provided as-is for educational and commercial use.

## Support

For issues, feature requests, or improvements:
1. Check the troubleshooting section above
2. Review the keyboard shortcuts and features
3. Ensure all dependencies are correctly installed
4. Clear browser cache and localStorage if issues persist

## Changelog

### Version 1.0.0
- Initial Next.js migration from vanilla HTML/CSS/JS
- Preserved all original functionality
- Added TypeScript support
- Improved styling and dark theme
- Fixed tab system and fullscreen controls
- Enhanced AI integration with error handling
- Automatic TOC extraction with page navigation

---

# Legacy Implementation Guide (Previous Version)

This section preserves the original implementation guide from the previous version of the project.

# Enhanced PDF E-book Reader - Implementation Guide

## Overview

This enhanced version of the PDF E-book Reader includes all the requested improvements and new features:

1. **New Right-Side Panel** - Mirrors the left sidebar functionality with AI assistant, highlights, and notes
2. **AI Agent Integration** - OpenAI API integration for document analysis and Q&A
3. **Text Highlighting & Storage** - Select and highlight text with color options, stored locally
4. **Rich Text Notes Editor** - Full-featured Quill.js editor with formatting options
5. **Quick Access Icons** - Floating icons for easy feature access
6. **Fixed Zoom Functionality** - Proper fit width/height toggle and manual zoom input
7. **Manual Zoom Input** - Type specific percentages directly

## Files Structure

```
├── index.html     
├── style.css        
└── app.js             
```

## New Features Implementation

### 1. Right-Side Panel

The right panel contains three main sections:

#### AI Assistant Section
- **API Key Setup**: Secure input for OpenAI API key
- **Chat Interface**: Conversational AI that analyzes document content
- **Clear Chat**: Reset conversation history

#### Highlights Section
- **Highlight List**: Shows all highlighted text snippets
- **Page Navigation**: Click highlights to jump to their location
- **Clear All**: Remove all highlights

#### Notes Section
- **Rich Text Editor**: Quill.js editor with full formatting
- **Auto-save**: Notes are saved to localStorage
- **Toolbar**: Bold, italic, underline, colors, headings, lists

### 2. AI Agent Integration

#### Setup Process:
1. User enters OpenAI API key in the secure input field
2. Key is validated and stored (in production, use proper encryption)
3. Chat interface becomes available

#### Functionality:
- **Document Context**: AI receives relevant text from current and nearby pages
- **Question Answering**: Ask questions about document content
- **Analysis**: Get summaries, explanations, and insights
- **Memory**: Maintains conversation context

#### API Integration:
```javascript
async callOpenAI(message, context) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.aiApiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful AI assistant analyzing a PDF document. Here's the context: ${context}`
                },
                {
                    role: 'user',
                    content: message
                }
            ]
        })
    });
    // Handle response...
}
```

### 3. Text Highlighting System

#### Selection Process:
1. User selects text in the PDF viewer
2. Right-click shows context menu with color options
3. Highlight is created and stored with metadata

#### Storage Format:
```javascript
const highlight = {
    id: Date.now(),
    text: selectedText,
    color: 'yellow', // yellow, green, blue, red
    page: currentPage,
    timestamp: new Date().toISOString()
};
```

#### Features:
- **Multiple Colors**: Yellow, green, blue, red highlighting
- **Persistence**: Highlights saved to localStorage
- **Navigation**: Click highlights to jump to their page
- **Management**: Clear individual or all highlights

### 4. Rich Text Notes Editor

#### Quill.js Integration:
```javascript
this.notesEditor = new Quill('#notesEditor', {
    theme: 'snow',
    modules: {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['clean']
        ]
    }
});
```

#### Features:
- **Headings**: H1, H2, H3 formatting
- **Text Formatting**: Bold, italic, underline
- **Colors**: Text and background color options
- **Lists**: Ordered and unordered lists
- **Auto-save**: Content saved to localStorage
- **Clean Formatting**: Remove formatting option

### 5. Enhanced Zoom Functionality

#### Fixed Fit Width Implementation:
```javascript
toggleFitWidth() {
    if (this.isFitWidthMode) {
        // Switch to fit height mode
        this.isFitWidthMode = false;
        this.fitToHeight();
        document.getElementById('fitWidth').textContent = 'Fit Height';
    } else {
        // Switch to fit width mode
        this.isFitWidthMode = true;
        this.fitToWidth();
        document.getElementById('fitWidth').textContent = 'Fit Width';
    }
}
```

#### Manual Zoom Input:
- Click zoom percentage to edit
- Type specific value (10% - 500%)
- Press Enter to apply
- Input validation with error handling

### 6. Quick Access Icons

#### Implementation:
```css
.quick-access-icons {
    position: absolute;
    bottom: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.quick-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background-color: var(--color-primary);
    /* Floating action button style */
}
```

#### Features:
- **AI Icon (🤖)**: Scrolls to and focuses AI chat input
- **Highlights Icon (✨)**: Scrolls to highlights section
- **Notes Icon (📝)**: Scrolls to and focuses notes editor
- **Hover Effects**: Scale animation on hover
- **Responsive**: Adjusts position on mobile

## Usage Instructions

### Getting Started

1. **Open the Application**: Load `enhanced-index.html` in a web browser
2. **Upload PDF**: Use the upload button or drag & drop a PDF file
3. **Set Up AI (Optional)**: Enter your OpenAI API key in the right panel

### Using AI Assistant

1. **API Key Setup**:
   - Click on the AI section in the right panel
   - Enter your OpenAI API key
   - Click "Save Key"

2. **Asking Questions**:
   - Type questions about the document
   - Press Enter or click Send
   - AI provides context-aware answers

3. **Example Questions**:
   - "What is the main topic of this document?"
   - "Summarize page 5"
   - "What are the key findings?"

### Highlighting Text

1. **Select Text**: Click and drag to select text in the PDF
2. **Right-Click**: Context menu appears with color options
3. **Choose Color**: Click yellow, green, blue, or red
4. **View Highlights**: Check the highlights section in right panel
5. **Navigate**: Click any highlight to jump to its page

### Taking Notes

1. **Access Notes**: Use the notes section in right panel or quick access icon
2. **Format Text**: Use the toolbar for formatting options
3. **Add Content**: Type notes, add headings, lists, colors
4. **Save**: Click "Save" button or notes auto-save periodically

### Zoom Controls

1. **Manual Zoom**:
   - Click on the percentage display (e.g., "100%")
   - Type desired percentage (10-500)
   - Press Enter to apply

2. **Fit Width/Height**:
   - Click "Fit Width" to fit document width to screen
   - Click again to switch to "Fit Height" mode
   - Click again to return to "Fit Width"

3. **Plus/Minus Buttons**: Traditional zoom in/out controls

## Browser Compatibility

- **Chrome**: Full support
- **Firefox**: Full support
- **Safari**: Full support (iOS 12+)
- **Edge**: Full support

## Dependencies

- **PDF.js**: v3.11.174 (CDN)
- **Quill.js**: v1.3.7 (CDN)
- **OpenAI API**: Requires valid API key

## Storage

- **Highlights**: Stored in localStorage as JSON
- **Notes**: Stored in localStorage as Quill Delta format
- **API Key**: Stored in localStorage (encrypt in production)
- **Settings**: Auto-saved user preferences

## Security Considerations

⚠️ **Important**: The current implementation stores the API key in localStorage for convenience. In a production environment:

1. **Never store API keys in localStorage**
2. **Use server-side proxy for API calls**
3. **Implement proper authentication**
4. **Encrypt sensitive data**
5. **Use HTTPS for all communications**

## Mobile Responsiveness

The application is fully responsive:

- **Panels**: Convert to overlay mode on mobile
- **Touch**: Full touch support for PDF navigation
- **Gestures**: Pinch-to-zoom support
- **Layout**: Optimized for mobile screens

## Performance Optimization

- **Lazy Loading**: PDF pages loaded on demand
- **Text Layer**: Efficient text rendering for selection
- **Memory Management**: Proper cleanup of PDF.js resources
- **Caching**: Browser caching for repeated access

## Troubleshooting

### Common Issues:

1. **PDF Not Loading**:
   - Check file is valid PDF
   - Try smaller file size
   - Check browser console for errors

2. **AI Not Working**:
   - Verify API key is correct
   - Check internet connection
   - Ensure OpenAI API quota available

3. **Highlights Not Saving**:
   - Check localStorage quota
   - Verify browser supports localStorage
   - Try clearing browser cache

4. **Text Selection Issues**:
   - Some PDFs have text as images (not selectable)
   - Try different PDF files
   - Check if PDF has text layer

## Future Enhancements

Potential improvements for future versions:

1. **Cloud Storage**: Sync highlights and notes across devices
2. **Collaboration**: Share highlights and notes with others
3. **Search**: Full-text search within documents
4. **Annotations**: Drawing and annotation tools
5. **Export**: Export highlights and notes to various formats
6. **Themes**: Dark mode and custom themes
7. **Bookmarks**: Save favorite pages and sections

## API Reference

### Main Class: EnhancedPDFReader

#### Key Methods:

```javascript
// Navigation
goToPage(pageNumber)
previousPage()
nextPage()

// Zoom
zoomIn()
zoomOut()
setZoomFromInput()
toggleFitWidth()

// Highlighting
highlightSelectedText(color)
clearAllHighlights()

// AI
sendAIMessage()
saveApiKey()

// Notes
saveNotes()
loadNotes()

// Panels
toggleSidebar()
toggleRightPanel()
```

This enhanced PDF reader provides a comprehensive document viewing and analysis experience with modern features that enhance productivity and user engagement.
