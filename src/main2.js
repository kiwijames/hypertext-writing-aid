const { app, BrowserWindow, webContents, ipcMain, dialog, Menu } = require('electron')
const fs = require('fs')
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const Database = require('./database.js')

// one instance only
const gotTheLock = app.requestSingleInstanceLock()
if(!gotTheLock) {
  app.quit()
}

const appBasePath = app.getAppPath()
const appUserPath = app.getPath("userData")
const dbFileName = 'mydatabase.sqlite'
const fullDbPath = path.join(appUserPath,dbFileName)
var db = new Database(appUserPath,dbFileName)
global.sharedObj = {db: db}
//todo db loading with promises and global sharing

let windowPDFList = []
let documentWindowMap = {} //path to win - win mapping
let idEditorMap = {} //path to win - win mapping
let windowEditorList = []
let editorWindow  


////////////////////////////creating functions////////////////////////////////////////


/**
 * Creates and returns a window,
 * loading a given HTML file.
 * @param  {String} HTMLFilePath Absolute path to a PDF file.
 * @return {BrowserWindow} Window with the PDF in a Viewer.
 */
function createHTMLWindow(HTMLFilePath, doc_path='') {
  // Create the browser window.
  let win = new BrowserWindow({ 
    width: 630, 
    //minWidth:630,
    //maxWidth:630,
    height: 440 ,
    webPreferences: {
      nodeIntegration:true,
      webSecurity: false
    }
  })
  win.loadFile(HTMLFilePath)
  win.webContents.openDevTools()
  win.on('close', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    windowEditorList = windowEditorList.filter(w => w.id !== win.id)
    win = null
  })
  win.webContents.on('did-finish-load', () => {
    console.log("did-finish-load "+doc_path)
    if(doc_path!=''){
      console.log("did-finish-load "+doc_path)
      win.send('loadText', doc_path)
      documentWindowMap[HTMLFilePath] = null
    }
  })
  documentWindowMap[HTMLFilePath] = win
  windowEditorList.push(win)
  return win
}

/**
 * Creates and returns a window,
 * loading a given PDF into a template.
 * @param  {String} pdfFilePath Absolute path to a PDF file.
 * @param  {Number} pageNumber On which page to open the file.
 * @return {BrowserWindow} Window with the PDF in a Viewer.
 */
function createPDFWindow(pdfFilePath, pageNumber=1, quads, link_id) {

  let win = new BrowserWindow({ 
    width: 800, 
    height: 600 ,
    webPreferences: {
      nodeIntegration:true,
      webSecurity: false
  }});
  win.setTitle(path.basename(pdfFilePath))
  win.setMenu(menuPDF)
  //win.setMenuBarVisibility(false)
  win.loadFile('public/template.html')
  let contents = win.webContents
  contents.on('dom-ready', () => {
    contents.send('pdfFile', pdfFilePath, pageNumber, quads, link_id)
  })
  // Uncomment DevTools for debugging
  contents.openDevTools()
  win.on('close', () => {
    // Dereference the window object from list
    windowPDFList = windowPDFList.filter(w => w.id !== win.id)
    win = null
    documentWindowMap[pdfFilePath] = null
  })
  windowPDFList.push(win)
  documentWindowMap[pdfFilePath] = win
  return win
}

// Menu template for the main window
const menu = Menu.buildFromTemplate([
  {
      label: 'File',
      submenu: [
      {
          label: 'Open PDF(s)',
          accelerator: "CmdOrCtrl+o",
          click: function() {
            filePaths = dialog.showOpenDialog({ 
              properties: ['openFile', 'multiSelections'],
              filters: [
                { name: "PDF", extensions: ["pdf"] },
                { name: "All Files", extensions: ["*"] }
              ]
            })
            if(filePaths) filePaths.forEach( (filePath) => { createPDFWindow(filePath); })
          }
      }, 
      {
        label: 'New Text Edtior',
        accelerator: "CmdOrCtrl+n",
        click: function() {
          createHTMLWindow('public/editor.html')          
        }
      }, 
      {
        label: 'Import Text',
        click: function(menuItem, currentWindow) {
          filePath = dialog.showOpenDialog({ 
            properties: ['openFile'] ,
            filters: [
              { name: "HTML", extensions: ["html", "htm"] },
              { name: "All Files", extensions: ["*"] }
              ]
            })
          if(filePath) currentWindow.send('loadText',filePath[0])
        }
      },
      {
        label: 'Save As',
        accelerator: "CmdOrCtrl+Shift+s",
        click: function(menuItem, currentWindow) {
          let filePath = dialog.showSaveDialog()
          if(filePath) currentWindow.send('saveTextAsHTML',filePath)
          // save in database the file location for now
        }
      },
      {
        label: 'Close All',
        click: function() {
          app.quit()
        }
      }
      ]
  },{
    label: 'View',
    submenu: [
      {
        label: 'View All Links',
        click: function() {
          createHTMLWindow('public/linked-list.html') 
        }
      }
    ]
  },{
    label: 'Link',
    submenu: [
      {
        label: 'Put internal link',
        accelerator: "CmdOrCtrl+i",
        enabled: false,
        id: 'putPdfLink',
        click: function(menuItem, currentWindow) {
          currentWindow.webContents.send('internal-link-step4')
          windowEditorList.filter(w => w.id == currentWindow.id).forEach(w => w.send('internal-link-step4',true)) //arg given indicate to stop other events
          menuItem.enabled = false
        }
      }
    ]
  }
]);
// pdf menu
const menuPDF = Menu.buildFromTemplate([
  {
    label: 'File',
    submenu: [
    {
        label: 'Open PDF(s)',
        accelerator: "CmdOrCtrl+o",
        click: function() {
          filePaths = dialog.showOpenDialog({ 
            properties: ['openFile', 'multiSelections'],
            filters: [
              { name: "PDF", extensions: ["pdf"] },
              { name: "All Files", extensions: ["*"] }
            ]
          })
          if(filePaths) filePaths.forEach( (path) => { createPDFWindow(path); })
        }
    }, 
    {
      label: 'New Text Edtior',
      accelerator: "CmdOrCtrl+n",
      click: function() {
        createHTMLWindow('public/editor.html')          
      }
    },
    {
      label: 'Close All',
      click: function() {
        app.quit()
      }
    }
  ]},{
    label: 'View',
    submenu: [
      {
        label: 'View PDF Links',
        click: function() {
          createHTMLWindow('public/linked-list.html')
        }
      },
      {
        label: 'View Internal Links',
        click: function() {
          createHTMLWindow('public/internal-linked-list.html') 
        }
      }
    ]
  }, {
    label: 'Link',
    submenu: [
      {
        label: 'Link selection between PDF\'s',
        accelerator: "CmdOrCtrl+l",
        click: function(menuItem, currentWindow) {
          data = {
            toast: true
          }
          currentWindow.webContents.send('linking-message',data)
          currentWindow.webContents.send('pdf-link-step1',data)
          windowPDFList.map(window => {
            if(window.id!=currentWindow.id)
              window.webContents.send('linking-message') //start linking next marked texts
          })
        }
      },{
        label: 'Finish link between PDF\'s',
        enabled: false,
        id: 'finishPdfLink',
        click: function(menuItem, currentWindow) {
            currentWindow.webContents.send('pdf-link-step4')
            windowEditorList.filter(w => w.id == currentWindow.id).forEach(w => w.send('pdf-link-step4',true)) //arg given indicate to stop other events
        }
      },{
        label: 'Internal link to editor',
        accelerator: "CmdOrCtrl+i",
        click: function(menuItem, currentWindow) {
          currentWindow.webContents.send('internal-link-step1')
        }
      }
    ]
  }
]);

//Set Menu for all windows, since mac doesnt allow individual window menus
Menu.setApplicationMenu(menu);

////////////////////////////app event handeling////////////////////////////////////////

// Create main window when ready
app.on('second-instance', (event, commandLine, workingDirectory) => {
  if (process.platform == 'win32' && commandLine.length >= 2) {
    let openFilePath = commandLine[1];
    let fileExtension = path.extname(openFilePath)
    if (openFilePath !== "" && openFilePath.includes("pdf")) {
      try{
        console.log(openFilePath);
        createPDFWindow(openFilePath)}
      catch(e){
        dialog.showErrorBox("opening pdf problem", e + " und datei: "+openFilePath)
      }
    }
  }else {
    createHTMLWindow('public/editor.html')
  }
})

app.on('ready', () => {
  
    // If app is opend on windows by opening a file 
    if (process.platform == 'win32' && process.argv.length >= 2) {
      let openFilePath = process.argv[1];
      let fileExtension = path.extname(openFilePath)
      if (openFilePath !== "" && openFilePath.includes("pdf")) {
        try{
          console.log(openFilePath);
          createPDFWindow(openFilePath)}
        catch(e){
          dialog.showErrorBox("opening pdf problem", e + " und datei: "+openFilePath)
        }
      }
    }
    
    if(windowPDFList.length == 0) editorWindow = createHTMLWindow('public/editor.html')
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    // check table if dead internal links exist
    db.deleteTemporaryLinks()
    db.closeDatabase()
    //if(global.sharedObj.database) global.sharedObj.database.close();


    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

////////////////////////////message handeling////////////////////////////////////////

ipcMain.on('pdf-link-step2', (event, data) => {
    console.log("pdf-link-step2 " + JSON.stringify(data))
    menuPDF.getMenuItemById('finishPdfLink').enabled = true
    windowPDFList.forEach(w => w.send('pdf-link-step3', data))
    //event.sender.webContents.send('pdf-link-step3',data) when sending the menu message, exclude the other
});

ipcMain.on('pdf-link-step5', (event, data) => {
  menuPDF.getMenuItemById('finishPdfLink').enabled = false
  console.log("\n\nsaving pdf links"+JSON.stringify(data))
    db.createLinkWithAnchors("default", "default", data.anchor_1, data.anchor_2).then( (link_ids) => {
      data.link_id = link_ids.link_id
      data.anchor_id_1 = link_ids.anchor_id_1
      data.anchor_id_2 = link_ids.anchor_id_2
      BrowserWindow.fromId(data.windowId_1).webContents.send('pdf-link-step6', data)
      BrowserWindow.fromId(data.windowId_2).webContents.send('pdf-link-step7', data)
    })
    
});

ipcMain.on('openOtherLink', (event, data) => {
  console.log("openOtherLink clicked: "+JSON.stringify(data))
  db.getOtherAnchorData(data.link_id, data.anchor_id).then( (data) => {
    console.log("db returned data" + JSON.stringify(data))
    if(documentWindowMap[data.doc_name]) documentWindowMap[data.doc_name].focus()
    else{
      //to change path.join(data.doc_path,data.doc_name)
      createPDFWindow(data.doc_name)
    }
  })
});

ipcMain.on('internal-link-step2', (event, data) => {
  menu.getMenuItemById('putPdfLink').enabled = true
  console.log("origsenderid "+data.windowId_1)
  console.log("origsenderid anchor "+data.anchor_1)
  windowEditorList.forEach(w => w.send('internal-link-step3', data))
});

ipcMain.on('internal-link-step5', (event, data) => {
  console.log("internal-link-step5" + JSON.stringify(data))
  BrowserWindow.fromId(data.windowId_1).webContents.send('internal-link-step7', data)
});

ipcMain.on('save-link', (event, data) => {
  linkData.linkName = data.linkName
  let insertStatement = "INSERT INTO links(link_name,document_name_1,\
                          document_data_1,document_quads_1,document_name_2,document_data_2,document_quads_2) \
                          VALUES('"+linkData.linkName+"','"+linkData.docName1+"','"+linkData.pageNumber1+"','"+linkData.pageSelection1+"','"+linkData.docName2+"','"+linkData.pageNumber2+"','"+linkData.pageSelection2+"')"
  
  //let db = new sqlite3.Database('mydatabase.sqlite')
  global.sharedObj.database.run(insertStatement, function(err){
    if(err){
      console.log(err)
    }else{
      lastLinkId = this.lastID
      console.log("last_insert_rowid row: "+lastLinkId)
      windowPDFList.map(window => {
        window.webContents.send('updateTempLinks', lastLinkId)
      });
    }
  });
});

ipcMain.on('requireLinkId', (event, arg) => {
  let windowThatWantsLink = event.sender
  console.log("start requireLinkId")
  tmpLinkListMenu = createHTMLWindow('public/linked-list.html')
  tmpLinkListMenu.webContents.once('dom-ready', () => {
    tmpLinkListMenu.webContents.send('requireLinkId')
  });
  ipcMain.on('returnLinkId', (event, arg) => {
    console.log("start returnLinkId")
    windowThatWantsLink.webContents.send('returnLinkId',arg)
  });
});

ipcMain.on('deleteLink', (event, link_id) => {
  console.log("deleted link with id "+link_id)
  db.deleteLinkById(link_id)
});

ipcMain.on('saveTextAsHTML-step2',(event, data) => {
  //data = file path and internalLinkIdList
  console.log("need to put links with this data "+JSON.stringify(data))
  data.filePath
  data.linkList.forEach(link => {
    db.updateTemporaryAnchors(link.link_id, link.anchor_id,data.filePath,data.filePath,"","")
  })
  //update links in pdf-viewers
});

