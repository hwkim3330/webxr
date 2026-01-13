const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let serverProcess = null;
const SERVER_PORT = 3000;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    icon: path.join(__dirname, 'assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true
    },
    backgroundColor: '#0f0f0f',
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'default'
  });

  mainWindow.loadFile('renderer.html');

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Start WebSocket server
function startServer() {
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, 'server', 'server.js');

    console.log('[SERVER] Starting WebSocket server...');
    console.log('[SERVER] Path:', serverPath);

    serverProcess = spawn('node', [serverPath], {
      cwd: path.join(__dirname, 'server'),
      env: { ...process.env, PORT: SERVER_PORT }
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`[SERVER] ${data.toString().trim()}`);
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`[SERVER ERROR] ${data.toString().trim()}`);
    });

    serverProcess.on('close', (code) => {
      console.log(`[SERVER] Process exited with code ${code}`);
      serverProcess = null;
    });

    // Wait for server to be ready
    setTimeout(() => {
      checkServerReady()
        .then(() => {
          console.log('[SERVER] Ready!');
          resolve();
        })
        .catch(reject);
    }, 2000);
  });
}

// Check if server is responding
function checkServerReady() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${SERVER_PORT}`, (res) => {
      resolve();
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Server start timeout'));
    });
  });
}

// Stop server
function stopServer() {
  if (serverProcess) {
    console.log('[SERVER] Stopping...');
    serverProcess.kill();
    serverProcess = null;
  }
}

app.whenReady().then(async () => {
  try {
    // Start server first
    await startServer();

    // Then create window
    createWindow();
  } catch (err) {
    console.error('[ERROR] Failed to start server:', err);
    dialog.showErrorBox(
      'Server Start Failed',
      `Failed to start WebSocket server: ${err.message}\n\nThe application will now exit.`
    );
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  stopServer();
});

// IPC handlers
ipcMain.handle('get-version', () => {
  return app.getVersion();
});

ipcMain.handle('select-server', async () => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Server Configuration',
    message: 'Enter WebSocket server address',
    detail: 'Default: ws://localhost:3000',
    buttons: ['OK', 'Cancel'],
    defaultId: 0,
    cancelId: 1
  });

  return result.response === 0;
});
