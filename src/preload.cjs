const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    db: {
        exec: (sql, params) => ipcRenderer.invoke('db:exec', sql, params),
        get: (sql, params) => ipcRenderer.invoke('db:get', sql, params),
        all: (sql, params) => ipcRenderer.invoke('db:all', sql, params),
        run: (sql, params) => ipcRenderer.invoke('db:run', sql, params),
    },
    getAssetPath: () => ipcRenderer.invoke('app:getAssetPath')
});
