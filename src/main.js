/**
 * Main function of the Hypertext Writing aid application.
 *
 * @file   Main file of the electron application.
 * @author Kevin Taylor
 */

const { app, BrowserWindow, webContents, ipcMain, dialog, Menu } = require('electron');
const fs = require('fs');
const path = require('path');
const Database = require('./database.js');
const prompt = require('electron-multi-prompt');

/**
  * Check to disallow mutliple instances of the app
  */ 
const gotTheLock = app.requestSingleInstanceLock()
if(!gotTheLock) {
  app.quit()
}

const appBasePath = app.getAppPath()
const appUserPath = app.getPath("userData")
const dbFileName = 'mydatabase.sqlite'
const db = new Database(appUserPath,dbFileName)
global.sharedObj = {db: db}

let windowPDFList = []
let documentWindowMap = {} //path to win - win mapping
let idEditorMap = {} //path to win - win mapping
let windowEditorList = []


////////////////////////////create window functions////////////////////////////

/**
 * Creates a window given the file path of HTML file
 * @param  {String} HTMLFilePath Absolute path to a PDF file.
 */
function createHTMLWindow(HTMLFilePath) {
  let win = new BrowserWindow({ 
    width: 800, 
    height: 600 ,
    webPreferences: {
      nodeIntegration:true,
      webSecurity: false
    }
  })
  win.setMenuBarVisibility(false)
  win.loadFile(HTMLFilePath)
  win.on('close', () => {
    // Dereference the window object and remove from list
    win = null
  })
  return win
}

/**
 * Creates and returns a window,
 * loading a given HTML file.
 * @param  {String} HTMLFilePath Absolute path to a PDF file.
 * @param  {String} doc_path Absolute path to load into editor.
 * @return {BrowserWindow} Window with the PDF in a Viewer.
 */
function createEditorWindow(HTMLFilePath, doc_path='') {
  let win = new BrowserWindow({ 
    width: 800, 
    height: 600 ,
    webPreferences: {
      nodeIntegration:true,
      webSecurity: false
    }  
  })
  if(doc_path) win.setTitle("Hypertext Writing Aid - "+path.basename(doc_path))
  win.loadFile(HTMLFilePath)
  //win.webContents.openDevTools()
  win.on('close', () => {
    // Dereference the window object and remove from list
    windowEditorList = windowEditorList.filter(w => w.id !== win.id)
    win = null
  })
  win.webContents.on('did-finish-load', () => {
    console.log("did-finish-load "+doc_path)
    if(doc_path!=''){
      console.log("did-finish-load "+doc_path)
      win.send('loadText', doc_path)
      //if(doc_path) documentWindowMap[path.basename(doc_path)] = null
    }
  })
  windowEditorList.push(win)
  if(doc_path) documentWindowMap[path.basename(doc_path)] = win
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
  win.setTitle("Hypertext Writing Aid - "+path.basename(pdfFilePath))
  //win.setMenuBarVisibility(false)
  win.loadFile('public/template.html')
  let contents = win.webContents
  contents.on('dom-ready', () => {
    contents.send('pdfFile', pdfFilePath, pageNumber, quads, link_id)
  })
  //Uncomment DevTools for debugging
  //contents.openDevTools()
  win.on('close', () => {
    // Dereference the window object and remove from list
    windowPDFList = windowPDFList.filter(w => w.id !== win.id)
    win = null
    documentWindowMap[path.basename(pdfFilePath)] = null
  })
  windowPDFList.push(win)
  documentWindowMap[path.basename(pdfFilePath)] = win
  return win
}

////////////////////////////////////////Application Event Handeling////////////////////////////////////////

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
    createEditorWindow('public/editor.html')
  }
})

app.on('ready', () => {
  // Set menu for all windows, since mac doesnt allow individual window menus
  Menu.setApplicationMenu(menu);
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

  if(windowPDFList.length == 0) createEditorWindow('public/editor.html')


    //Check if files moved or modified
    db.getAllAnchors().then( (rows) => {
      let fullFilePathList = []
      let fullLastModifiedList = []
      rows.forEach( (row) => {
        fullFilePath = path.join(row.doc_path,row.doc_name)
        if(row.last_modified) fullLastModifiedList.push({file_path: fullFilePath, last_modified: row.last_modified})
        if(!fullFilePathList.includes(fullFilePath)) fullFilePathList.push(fullFilePath)
      })

      let missingDocs = []
      let modifiedDocs = []
      fullFilePathList.forEach( (filePath) => {
        if(!fs.existsSync(filePath)) missingDocs.push(filePath)
      })
      fullLastModifiedList.forEach( obj => {
        if(!obj.file_path.includes("tbd") && fs.statSync(obj.file_path).mtime.toString() != obj.last_modified) modifiedDocs.push(obj.file_path)
      })
      console.log("missingDocs: "+JSON.stringify(missingDocs))
      console.log("modifiedDocs: "+JSON.stringify(modifiedDocs))

      missingDocs.forEach( (filePath) => {
        let dialogOptions = {
          type: 'info',
          buttons: ['Set new file path', 'Remove links'],
          defaultId: 1,
          title: 'File not found',
          message: 'A file with links has been moved, deleted or renamed.',
          detail: filePath+' has not been found. Please set the new path to the file, otherwise the links will be removed.',
        };
        dialog.showMessageBox(null, dialogOptions, (response) => {
          if(response == 0) {
            newFilePath = dialog.showOpenDialog({ 
              properties: ['openFile'],
              filters: [
                { name: "All Files", extensions: ["*"] }
              ]
            })
            if(newFilePath) {
              newFilePath = newFilePath[0]
              db.updateFilePathForAllAnchors(path.basename(newFilePath),path.dirname(newFilePath))
            }
            else db.deleteLinksWithFilePath(path.basename(filePath))
          }else {
            db.deleteLinksWithFilePath(path.basename(filePath))
          }
        });
      })

      modifiedDocs.forEach( (filePath) => {
        let dialogOptions = {
          type: 'info',
          buttons: ['Update all document anchors', 'Remove links'],
          defaultId: 1,
          title: 'File has been modified',
          message: 'A file with links has been modified.',
          detail: filePath+' has been modified. Please decide to keep or delete the links.',
        };
        dialog.showMessageBox(null, dialogOptions, (response) => {
          if(response == 0) {
            db.updateFilePathForAllAnchors(path.basename(filePath),path.dirname(filePath),fs.statSync(filePath).mtime.toString())
          }else {
            db.deleteLinksWithFilePath(path.basename(filePath))
          }
        });
      })

    })
  })

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    db.deleteTemporaryLinks()
    db.closeDatabase()
    db=null
    global.sharedObj.database = null

    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

////////////////////////////////////////Message Handeling////////////////////////////////////////

ipcMain.on('open-other-link', (event, data) => {
  db.getOtherAnchorData(data.link_id, data.anchor_id).then( (data) => {
    if(documentWindowMap[data.doc_name]) documentWindowMap[data.doc_name].focus()
    else{
      if(data.file_type == "pdf") createPDFWindow(path.join(data.doc_path,data.doc_name),data.pdf_page)
      else createEditorWindow("public/editor.html", path.join(data.doc_path,data.doc_name))
    }
  })
});

ipcMain.on('saveTextAsHTML-step2',(event, data) => {
  //data = file path and internalLinkIdList
  data.filePath = path.dirname(data.filePathFull)
  data.fileName = path.basename(data.filePathFull)
  console.log("need to put links with this data "+JSON.stringify(data))
  data.linkList.forEach(link => {
    db.updateTemporaryAnchors(link.link_id,link.anchor_id,data.fileName,data.filePath,data.last_modified)
  })
  //update links in pdf-viewers
});

ipcMain.on('send-anchor', (event, data) => {
  console.log("send-anchor with data: "+JSON.stringify(data))
  if(data.anchor_2){
    menu.getMenuItemById('start-link').enabled = true
    menu.getMenuItemById('finish-link').enabled = false
    prompt(linkSavingPromptOptions, BrowserWindow.fromId(data.windowId_2)).then((result) => {
      db.createLinkWithAnchors(result["link_name"],result["link_description"],data.anchor_1,data.anchor_2).then( (link_ids) => {
        data.link_id = link_ids.link_id
        data.anchor_id_1 = link_ids.anchor_id_1
        data.anchor_id_2 = link_ids.anchor_id_2
        BrowserWindow.fromId(data.windowId_1).webContents.send('put-link', data)
        if(data.windowId_1 != data.windowId_2) BrowserWindow.fromId(data.windowId_2).webContents.send('put-link', data)
      })
    }).catch((err) => {console.log(err)})  
  } else {
    menu.getMenuItemById('start-link').enabled = false
    menu.getMenuItemById('finish-link').enabled = true
    ipcMain.on('forward-anchor', (event) => {event.sender.webContents.send("get-anchor",data)})
  }
})

//////////////////////////////////// const ////////////////////////////////////

const linkSavingPromptOptions = {
  title: 'Save Link',    
  label: 'Please input the values to describe the link.',
  alwaysOnTop: true, //allow the prompt window to stay over the main Window,
  type: 'multi-input',
  width: 580, // window width
  height: 300, // window height
  resizable: true,
  buttonsStyle: {
    texts: {
      ok_text: 'Save', //text for ok button
      cancel_text: 'Throw away' //text for cancel button
    }
  },   
  // input multi-input options **NEEDED ONLY IF TYPE IS MULTI-INPUT**

  inputArray: [
    {
      key: 'link_name',
      label: 'Link Name',
      value: '',
      attributes: { // Optionals attributes for input
        placeholder: 'some link name',
        required: false, // If there is a missing required input the result will be null, the required input will be recognized from '*'
        type: 'text',
      }
    },{
      key: 'link_description',
      label: 'Link Description',
      value: '',
      attributes: { // Optionals attributes for input
        placeholder: 'a description',
        required: false, // If there is a missing required input the result will be null, the required input will be recognized from '*'
        type: 'text',
      }
    }
  ]

}

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
          if(filePaths) filePaths.forEach( (path) => { createPDFWindow(path); })
        }
    },
    {
      label: 'Import Text',
      id: 'import-text',
      click: function(menuItem, currentWindow) {
        if(!windowEditorList.includes(currentWindow)) return

        filePath = dialog.showOpenDialog({ 
          properties: ['openFile'] ,
          filters: [
            { name: "HTML", extensions: ["html", "htm"] },
            { name: "All Files", extensions: ["*"] }
          ]
        })
        if(filePath) {
          Object.entries(documentWindowMap).forEach((filename, win) => {
            if(win==currentWindow) documentWindowMap[filename]=null
          })
          documentWindowMap[path.basename(filePath[0])] = currentWindow
          currentWindow.setTitle("Hypertext Writing Aid - "+path.basename(filePath[0]))
          currentWindow.send('loadText',filePath[0])
        }
      }
    },
    {
      label: 'Save As',
      accelerator: "CmdOrCtrl+Shift+s",
      id: 'save-text',
      click: function(menuItem, currentWindow) {
        if(!windowEditorList.includes(currentWindow)) return
        let filePath = dialog.showSaveDialog()
        if(filePath) currentWindow.send('saveTextAsHTML',filePath)
      }
    },
    {
      label: 'New Text Edtior',
      accelerator: "CmdOrCtrl+n",
      click: function() {
        createEditorWindow('public/editor.html')          
      }
    },
    {
      label: 'Close All',
      accelerator: "CmdOrCtrl+q",
      click: function() {
        app.quit()
      }
    }
  ]},{
    label: 'View',
    submenu: [
      {
        label: 'View All Links',
        click: function() {
          createHTMLWindow('public/linked-list.html') 
        }
      }
    ]
  }, {
    label: 'Link',
    submenu: [
      {
        label: 'Start Link',
        accelerator: "CmdOrCtrl+l",
        id: 'start-link',
        click: function(menuItem, currentWindow) {
          currentWindow.webContents.send('get-anchor')
        }
      },{
        label: 'Finish Link',
        accelerator: "CmdOrCtrl+l",
        enabled: false,
        id: 'finish-link',
        click: function(menuItem, currentWindow) {
          currentWindow.webContents.send('forward-anchor') //cannot sent message directly to main
        }
      }
    ]
  }
]);
