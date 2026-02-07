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
