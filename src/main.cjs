const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { initDb, getDb } = require('./db.cjs');
const fs = require('fs');
const { protocol } = require('electron');

// Define External Assets Path (Documents is easy for users to find)
const externalAssetsPath = path.join(app.getPath('documents'), 'AestheticAura', 'Assets');
if (!fs.existsSync(externalAssetsPath)) {
    fs.mkdirSync(externalAssetsPath, { recursive: true });
}


const createWindow = () => {
    const iconPath = app.isPackaged
        ? path.join(__dirname, '../dist/resources/logo.jpeg')
        : path.join(__dirname, '../public/resources/logo.jpeg');

    const mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 1024,
        minHeight: 768,
        center: true,
        backgroundColor: '#1a1a1a', // Matching tailwind primary-bg
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false,
        },
        title: 'Aesthetic Aura Clinic',
        autoHideMenuBar: true,
        show: false,
        icon: iconPath
    });

    // Load URL or File
    if (!app.isPackaged) {
        // Development
        mainWindow.loadURL('http://127.0.0.1:56790');
        // mainWindow.webContents.openDevTools();
    } else {
        // Production
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    mainWindow.once('ready-to-show', () => {
        mainWindow.maximize();
        mainWindow.show();
    });

    // Handle external links
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http')) {
            require('electron').shell.openExternal(url);
        }
        return { action: 'deny' };
    });
};

app.whenReady().then(() => {
    // Register custom protocol to serve local files securely
    protocol.registerFileProtocol('asset', (request, callback) => {
        // Strip asset:// and any query parameters
        const urlPath = request.url.replace('asset://', '').split('?')[0];
        try {
            return callback(path.normalize(path.join(externalAssetsPath, decodeURIComponent(urlPath))));
        } catch (error) {
            console.error(error);
        }
    });

    // Initialize Database
    const db = initDb();

    // IPC Handlers
    ipcMain.handle('db:exec', (_, sql, params) => {
        try {
            const stmt = db.prepare(sql);
            if (sql.trim().toUpperCase().startsWith('SELECT')) {
                return stmt.all(params || []);
            } else {
                return stmt.run(params || []);
            }
        } catch (err) {
            console.error('Database Error:', err);
            return { error: err.message };
        }
    });

    // Specific handlers for safer interaction (optional but recommended)
    ipcMain.handle('db:get', (_, sql, params) => {
        try {
            const stmt = db.prepare(sql);
            return stmt.get(params || []);
        } catch (err) { console.error(err); return { error: err.message }; }
    });

    ipcMain.handle('db:all', (_, sql, params) => {
        try {
            const stmt = db.prepare(sql);
            return stmt.all(params || []);
        } catch (err) { console.error(err); return { error: err.message }; }
    });

    ipcMain.handle('db:run', (_, sql, params) => {
        try {
            const stmt = db.prepare(sql);
            return stmt.run(params || []);
        } catch (err) { console.error(err); return { error: err.message }; }
    });


    ipcMain.handle('app:getAssetPath', () => externalAssetsPath);

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
