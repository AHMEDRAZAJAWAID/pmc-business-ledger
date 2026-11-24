const { contextBridge, ipcRenderer } = require('electron')

const saveAndOpenPdf = (htmlContent, defaultFileName) => {
  if (typeof htmlContent === 'object' && htmlContent !== null) {
    return ipcRenderer.invoke('save-and-open-pdf', htmlContent)
  }
  return ipcRenderer.invoke('save-and-open-pdf', { htmlContent, defaultFileName })
}

contextBridge.exposeInMainWorld('pmcDesktop', { saveAndOpenPdf })
contextBridge.exposeInMainWorld('electronAPI', { saveAndOpenPdf })