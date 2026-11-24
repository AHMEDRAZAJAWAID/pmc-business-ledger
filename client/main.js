const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron')
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')

let mainWindow = null

function findUsbDrive() {
  try {
    const out = execSync(
      'powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -eq 2 } | Select-Object -ExpandProperty DeviceID"',
      { encoding: 'utf8', timeout: 4000, stdio: ['pipe', 'pipe', 'ignore'] }
    )
    const drives = out.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    for (const drv of drives) {
      const root = drv.endsWith('\\') ? drv : `${drv}\\`
      if (fs.existsSync(root)) return root
    }
  } catch (_) {}

  const letters = 'DEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  for (const letter of letters) {
    const root = `${letter}:\\`
    const markerDir = path.join(root, 'PMC-Business-Data')
    if (fs.existsSync(markerDir)) {
      return root
    }
  }

  return null
}

function setupUsbDatabase() {
  const usbRoot = findUsbDrive()
  if (!usbRoot) {
    dialog.showErrorBox(
      'USB Required',
      'PMC Business chalane ke liye USB drive lagana zaroori hai.\n\nPlease USB attach karein aur software dobara open karein.'
    )
    app.quit()
    return false
  }

  const dataDir = path.join(usbRoot, 'PMC-Business-Data')
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }

  const dbPath = path.join(dataDir, 'pmc-data.db')
  process.env.PMC_DB_PATH = dbPath
  process.env.PMC_DATA_DIR = dataDir
  process.env.PMC_DB_DIR = dataDir
  return true
}

function startBackendServer() {
  try {
    if (app.isPackaged) {
      const unpackedNodeModules = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
      if (fs.existsSync(unpackedNodeModules)) {
        process.env.NODE_PATH = unpackedNodeModules
        require('module').Module._initPaths()
      }
    }

    const serverPath = path.join(__dirname, 'server.js')
    if (fs.existsSync(serverPath)) {
      require(serverPath)
    }
  } catch (err) {
    dialog.showErrorBox(
      'Server Startup Error',
      `Database/Server start nahi ho saka:\n\n${err.message}`
    )
    app.quit()
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 650,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  const buildIndex = path.join(__dirname, 'client', 'build', 'index.html')
  if (app.isPackaged || fs.existsSync(buildIndex)) {
    mainWindow.loadFile(buildIndex)
  } else {
    mainWindow.loadURL('http://localhost:3000')
  }
}

ipcMain.handle('save-and-open-pdf', async (_event, payload) => {
  const htmlContent = typeof payload === 'string' ? payload : payload?.htmlContent
  const defaultFileName = typeof payload === 'object' && payload !== null ? payload?.defaultFileName : 'PMC-Ledger.pdf'

  const pdfWin = new BrowserWindow({
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  try {
    const safeDefault = String(defaultFileName || 'PMC-Ledger.pdf').replace(/[<>:"/\\|?*]+/g, '_')
    const finalDefaultName = safeDefault.endsWith('.pdf') ? safeDefault : `${safeDefault}.pdf`

    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Ledger PDF',
      defaultPath: path.join(app.getPath('documents'), finalDefaultName),
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    })

    if (canceled || !filePath) {
      return { ok: true, canceled: true }
    }

    await pdfWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(htmlContent || ''))
    const pdfBuffer = await pdfWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true
    })

    fs.writeFileSync(filePath, pdfBuffer)
    await shell.openPath(filePath)

    return { ok: true, filePath }
  } catch (err) {
    return { ok: false, error: err.message }
  } finally {
    if (!pdfWin.isDestroyed()) {
      pdfWin.close()
    }
  }
})

app.whenReady().then(() => {
  const ok = setupUsbDatabase()
  if (!ok) return

  startBackendServer()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})