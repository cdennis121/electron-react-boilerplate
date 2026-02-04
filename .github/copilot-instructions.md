# User Management CS1 - AI Coding Instructions

## Project Overview
This is an **Electron React Boilerplate-based desktop application** for VoIP user management, built with TypeScript, React, and Electron. The app provides a UI for managing users, hunt groups, call queues, call history, flows, and audio files through a custom REST API with header-based authentication.

## Architecture

### Process Separation (Electron IPC Pattern)
- **Main Process** ([src/main/main.ts](../src/main/main.ts)): Electron app lifecycle, window management, IPC handlers for API calls
- **Renderer Process** ([src/renderer/](../src/renderer/)): React UI running in BrowserWindow
- **Preload Script** ([src/main/preload.ts](../src/main/preload.ts)): Secure bridge using `contextBridge` to expose API methods to renderer via `window.electron`

### API Communication Pattern
The app uses a **dual API client** architecture:
- **Main Process API Client** ([src/main/apiClient.ts](../src/main/apiClient.ts)): Singleton axios instance with interceptors for auth headers
- **Renderer API Client** ([src/renderer/utils/apiClient.ts](../src/renderer/utils/apiClient.ts)): React hook (`useApiClient`) that calls main process via IPC

**Critical**: API calls MUST flow: `React Component` → `window.electron.api.*` (preload) → `IpcMain handler` ([main.ts](../src/main/main.ts)) → `apiClient` (main) → External API

### Custom Authentication
API uses **four custom headers** instead of standard auth:
```typescript
'X-Auth-For', 'X-Auth-Reseller', 'X-Auth-Password', 'X-Auth-User'
```
Settings stored in `localStorage` via [storage.ts](../src/renderer/utils/storage.ts) and synced to main process on app start.

## Development Workflows

### Build & Run
```bash
npm start          # Start dev mode (preloads, main, renderer with hot reload)
npm run package    # Build production installer
npm test           # Run Jest tests (React Testing Library)
npm run lint:fix   # Auto-fix ESLint issues
```

**Important**: `npm start` runs THREE webpack processes sequentially:
1. Preload compilation (`.erb/dll/preload.js`)
2. Main process watch mode
3. Renderer dev server (webpack serve)

### Debugging
- **Main Process**: VSCode debugger attaches to Electron main (via `electronmon`)
- **Renderer**: Open DevTools automatically in development (see [main.ts](../src/main/main.ts) `installExtensions`)
- **API Calls**: Check interceptor logs in main process console for request/response details

## Project-Specific Patterns

### Component Structure
All feature components ([Users.tsx](../src/renderer/components/Users.tsx), etc.) follow this pattern:
1. Initialize API client with `initializeApiClient()` before first call
2. Check for error: "API settings not configured. Please configure in Settings."
3. Use `window.electron.api` methods (get/post/put/delete/patch)
4. Handle response shape: `{ status_code, status_message, result }`
5. Implement auto-refresh intervals (typically 60s) for real-time data

### API Response Patterns
All API responses follow this structure:
```typescript
{ status_code: number, status_message: string, result: T }
```

**Common patterns:**
- **GET requests**: Check `status_code === 200` and `result` exists before using
  ```typescript
  if (response.status_code === 200 && response.result) {
    setData(response.result);
  }
  ```
- **Mutations (POST/PUT/PATCH)**: Accept `200` or `201` for success
  ```typescript
  if (response.status_code === 200 || response.status_code === 201) {
    // Success handling
  }
  ```
- **Nested results**: Some endpoints return nested result objects
  ```typescript
  // Example: /voip/call/{uuid}/audio
  response.result.recording  // URL string
  response.result.available  // Boolean
  ```
- **Error messages**: Always check `status_message` for error details
  ```typescript
  setError(`Failed: ${response.status_message || 'Unknown error'}`);
  ```

### Feature Flags & Conditional Features
Feature flags stored in `localStorage` via [storage.ts](../src/renderer/utils/storage.ts):
- `enableCallRecordingDownload`: Controls download button visibility in [CallHistory.tsx](../src/renderer/components/CallHistory.tsx)
- Load with `getAppFeatures()` in component initialization
- Toggle in [Settings.tsx](../src/renderer/components/Settings.tsx) (requires admin code `1234`)
- Features affect UI rendering, not API access

### State Management
**No Redux/Zustand** - uses React hooks (`useState`, `useEffect`) with component-local state. Settings persist via `localStorage`.

### Routing
Uses **React Router v7** with `MemoryRouter` (no URL bar in Electron). Routes defined in [Layout.tsx](../src/renderer/components/Layout.tsx).

### TypeScript Configuration
- Module: `node16` (ESM interop enabled)
- Target: `ES2022`
- Strict mode ON
- Output: `.erb/dll/` (not `dist/` or `build/`)

## Key Files to Reference

- [src/main/main.ts](../src/main/main.ts) - IPC handlers for all API operations (`api-get`, `api-post`, etc.)
- [src/main/apiClient.ts](../src/main/apiClient.ts) - Axios setup with auth interceptors
- [src/main/preload.ts](../src/main/preload.ts) - Type-safe API bridge (`ElectronHandler` type)
- [src/renderer/components/Layout.tsx](../src/renderer/components/Layout.tsx) - Navigation structure
- [src/renderer/utils/storage.ts](../src/renderer/utils/storage.ts) - Persistence layer
- [package.json](../package.json) - Scripts and webpack config references (`.erb/configs/`)

## Common Tasks

### Adding a New API Endpoint
1. Add IPC handler in [main.ts](../src/main/main.ts): `ipcMain.handle('new-endpoint', ...)`
2. Add method to preload API in [preload.ts](../src/main/preload.ts): `window.electron.api.newMethod()`
3. Call from React component: `await window.electron.api.newMethod(params)`

### Adding a New Page
1. Create component in [src/renderer/components/](../src/renderer/components/)
2. Add route in [Layout.tsx](../src/renderer/components/Layout.tsx) `<Routes>` and sidebar link
3. Initialize API with `initializeApiClient()` before fetching data

### Modifying Auth Headers
Update both:
- [src/main/apiClient.ts](../src/main/apiClient.ts) interceptor
- [src/renderer/utils/storage.ts](../src/renderer/utils/storage.ts) `ApiAuthSettings` interface

### File Uploads Pattern
See [Audio.tsx](../src/renderer/components/Audio.tsx) for base64 file upload example:
```typescript
const content = await fileToBase64(file);
await window.electron.api.post('/voip/sound', { 
  name, file_name: file.name, tag, audio_type, content 
});
```

### File Downloads Pattern
Use Electron's download API (see [CallHistory.tsx](../src/renderer/components/CallHistory.tsx)):
```typescript
const response = await window.electron.api.get(`/endpoint/${id}/audio`);
await window.electron.api.downloadFile(response.result.recording, 'filename.mp3');
```

## Dependencies of Note
- `electron-updater`: Auto-update support (configured in [main.ts](../src/main/main.ts) `AppUpdater`)
- `axios`: HTTP client (v1.13.4+)
- `react-router-dom`: v7 (newer API)
- `ts-node`: Used for webpack configs in `.erb/configs/`
