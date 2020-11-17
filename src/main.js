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

/**
  * Command for Mac devices, as this is a prototype, not a certified application
  */ 
app.commandLine.appendSwitch ('ignore-certificate-errors', 'true');

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
  return new Promise((resolve) => {
    let win = new BrowserWindow({ 
      width: 800, 
      height: 600 ,
      backgroundColor: '#eee', 
      show: false, 
      webPreferences: {
        nodeIntegration:true,
        webSecurity: false
      }
    })
    win.setMenuBarVisibility(false)
    //win.webContents.openDevTools()
    win.loadFile(HTMLFilePath)
    win.on('ready-to-show', function() { 
      win.show(); 
      win.focus(); 
    });
    win.on('close', () => {
      // Dereference the window object and remove from list
      win = null
    })
    resolve(win)
  })
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
    backgroundColor: '#eee', 
    show: false, 
    webPreferences: {
      nodeIntegration:true,
      webSecurity: false
    }  
  })
  if(doc_path) win.setTitle("Hypertext Writing Aid - "+path.basename(doc_path))
  win.loadFile(HTMLFilePath)
  win.webContents.openDevTools()
  win.on('close', () => {
    // Dereference the window object and remove from list
    windowEditorList = windowEditorList.filter(w => w.id !== win.id)
    win = null
  })
  win.on('ready-to-show', function() { 
    win.show(); 
    win.focus(); 
  });
  win.webContents.on('did-finish-load', () => {
    if(doc_path!=''){
      win.send('loadText', doc_path)
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
    backgroundColor: '#eee', 
    show: false, 
    webPreferences: {
      nodeIntegration:true,
      webSecurity: false
  }});
  win.setTitle("Hypertext Writing Aid - "+path.basename(pdfFilePath))
  //win.setMenuBarVisibility(false)
  win.loadFile('public/template.html')
  //win.webContents.openDevTools()
  let contents = win.webContents
  win.on('ready-to-show', function() { 
    win.show(); 
    win.focus(); 
  });
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

// Mac Os file open handeling according to documentation: 
// https://github.com/electron/electron/blob/master/docs/api/app.md#event-open-file-macos
app.on('will-finish-launching', () => {
  app.once('open-file', (event, path) => {
    if (path !== "" && path.includes("pdf")) {
      try{
        app.once('ready', () => {createPDFWindow(path) })
      } catch(e){
        dialog.showErrorBox("Problem opening PDF: ", e)
      }
    }
  });
});


app.on('ready', () => {

  if(process.platform == "darwin") {
    const menu = menuMac
    Menu.setApplicationMenu(menu);
  } else {
    const menu = menuNonMac
    Menu.setApplicationMenu(menu);
  }
  
  // If app is opend on windows by opening a file 
  if (process.platform == 'win32' && process.argv.length >= 2) {
    let openFilePath = process.argv[1];
    let fileExtension = path.extname(openFilePath)
    if (openFilePath !== "" && openFilePath.includes("pdf")) {
      try{
        createPDFWindow(openFilePath)}
      catch(e){
        dialog.showErrorBox("Problem opening PDF: ", e)
      }
    }
  }

  app.on('open-file', (event, path) => {
    if (path !== "" && path.includes("pdf")) {
      try{
        createPDFWindow(path)
      } catch(e){
        dialog.showErrorBox("Problem opening PDF: ", e)
      }
    }
  });

  if(process.platform == 'win32' && windowPDFList.length == 0) createEditorWindow('public/editor.html')


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

    }).catch((err) => {console.log(err)});
  })

// Quit when all windows are closed.
app.on('window-all-closed', () => {    
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    db.deleteTemporaryLinks()
    db.closeDatabase()
    global.sharedObj.database = null
    app.quit()
  }
})

////////////////////////////////////////Message Handeling////////////////////////////////////////

ipcMain.on('open-other-link', (event, data) => {
  db.getOtherAnchorData(data.link_id, data.anchor_id).then( (data) => {
    if(documentWindowMap[data.doc_name]) {
      documentWindowMap[data.doc_name].webContents.send("focus-page", data.pdf_page)
      documentWindowMap[data.doc_name].focus()
    }
    else{
      if(data.file_type == "pdf") createPDFWindow(path.join(data.doc_path,data.doc_name),data.pdf_page)
      else createEditorWindow("public/editor.html", path.join(data.doc_path,data.doc_name))
    }
  }).catch((err) => {console.log(err)});
});

ipcMain.on('saveTextAsHTML-step2',(event, data) => {
  data.file_name = path.basename(data.full_file_path)
  data.file_path = path.dirname(data.full_file_path)
  data.link_list.forEach(link => {
    db.updateTemporaryAnchors(link.anchor_id,data.file_name,data.file_path,data.last_modified)
  })
});

ipcMain.on('send-anchor', (event, data) => {
  if(data.cancel) {
    menu.getMenuItemById('start-link').enabled = true
    menu.getMenuItemById('finish-link').enabled = false
    menu.getMenuItemById('cancel-link').enabled = false
    event.sender.webContents.send("alert","Linking was canceled.")
    data = {}
    return
  }
  if(data.anchor_2){
    if(data.anchor_2.$file_type == "text" && data.anchor_1.$file_type == "text"){ // currently soent support links between text editors
      data.anchor_2 = null
      data.windowId_2 = null
      event.sender.webContents.send("alert","Linking between two documents is currently not supported.")
      ipcMain.once('forward-anchor', (event) => {
        event.sender.webContents.send("get-anchor",data)
      })
      return
    }
    menu.getMenuItemById('start-link').enabled = true
    menu.getMenuItemById('finish-link').enabled = false
    menu.getMenuItemById('cancel-link').enabled = false
    prompt(linkSavingPromptOptions, BrowserWindow.fromId(data.windowId_2)).then((result) => {
      if(!result) {
        data = {}
        event.sender.webContents.send("alert", "Linking canceled")
        return
      }
      db.createLinkWithAnchors(result["link_name"],result["link_description"],data.anchor_1,data.anchor_2).then( (link_ids) => {
        data.link_id = link_ids.link_id
        data.anchor_id_1 = link_ids.anchor_id_1
        data.anchor_id_2 = link_ids.anchor_id_2
        BrowserWindow.fromId(data.windowId_1).webContents.send('put-link', data)
        if(data.windowId_1 != data.windowId_2) BrowserWindow.fromId(data.windowId_2).webContents.send('put-link', data)
        data = {}
      })
    }).catch((err) => {console.log(err)});
  } else {
    menu.getMenuItemById('start-link').enabled = false
    menu.getMenuItemById('finish-link').enabled = true
    menu.getMenuItemById('cancel-link').enabled = true
    ipcMain.once('forward-anchor', (event, new_data) => {
      if(new_data && new_data.cancel) return
      event.sender.webContents.send("get-anchor",data)
    })
  }
})

ipcMain.on('delete-link', (event, data) => {
  let link_id = data
  db.getFullLinkData(link_id).then( (data) => {
    db.deleteLinkById(link_id) //maybe promise necessary

    if(documentWindowMap[data.doc_name_1]){
      documentWindowMap[data.doc_name_1].webContents.send("remove-link", link_id)
    }
    if(documentWindowMap[data.doc_name_2]){
      documentWindowMap[data.doc_name_2].webContents.send("remove-link", link_id)
    }
  })
})

////////////////////////////////////////////// const //////////////////////////////////////////////

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

const menuMac = Menu.buildFromTemplate([
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
      click: function(menuItem, currentWindow) {
        if(!windowEditorList.includes(currentWindow)) {
          currentWindow.webContents.send('alert', "This works only with the text editor focused.")
          return
        }
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
        let filePath = dialog.showSaveDialog() //on Windows returns a List of strings
        if(filePath[0]!="/") filePath = filePath[0]
        filePath = path.join(path.dirname(filePath),path.basename(filePath).split(".")[0])
        if(filePath) {
          currentWindow.send('saveTextAsHTML',filePath)
          documentWindowMap[path.basename(filePath)] = currentWindow
        }
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
        db.deleteTemporaryLinks()
        db.closeDatabase()
        global.sharedObj.database = null
        app.quit()
      }
    }
  ]},{ 
    label: 'Edit', 
    submenu: [{ 
      label: 'Undo', 
      accelerator: 'CmdOrCtrl+Z', 
      selector: 'undo:' 
    }, { 
      label: 'Redo', 
      accelerator: 'Shift+CmdOrCtrl+Z', 
      selector: 'redo:' 
    }, { 
      type: 'separator'
    }, { 
      label: 'Cut', 
      accelerator: 'CmdOrCtrl+X', 
      selector: 'cut:' 
    }, { 
      label: 'Copy', 
      accelerator: 'CmdOrCtrl+C', 
      selector: 'copy:'
    }, { 
      label: 'Paste', 
      accelerator: 'CmdOrCtrl+V', 
      selector: 'paste:' 
    }, { 
      label: 'Select All', 
      accelerator: 'CmdOrCtrl+A', 
      selector: 'selectAll:' 
    }]
  }, {
    label: 'View',
    submenu: [
      {
        label: 'View All Links',
        click: function() {
          createHTMLWindow('public/link-list.html') 
        }
      },{
        label: 'View Document\'s Links',
        click: function(menuItem, currentWindow) {
          let doc_name
          Object.keys(documentWindowMap).forEach( (key) => {
            if(documentWindowMap[key]==currentWindow) doc_name = key
          })
          createHTMLWindow('public/link-list.html').then( (win) => {
            win.webContents.once('dom-ready', () => {
              win.webContents.send('send-doc-name', doc_name)
           }).catch((err) => {console.log(err)});
          })
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
      },{
        label: 'Cancel Link',
        enabled: false,
        id: 'cancel-link',
        click: function(menuItem, currentWindow) {
          let data = {cancel : true}
          currentWindow.webContents.send('cancel-anchor', data) //cannot sent message directly to main
          currentWindow.webContents.send('forward-anchor', data)
        }
      }
    ]
  }
]);

const menuNonMac = Menu.buildFromTemplate([
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
      click: function(menuItem, currentWindow) {
        if(!windowEditorList.includes(currentWindow)) {
          currentWindow.webContents.send('alert', "This works only with the text editor focused.")
          return
        }
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
        let filePath = dialog.showSaveDialog() //on Windows returns a List of strings
        if(filePath[0]!="/") filePath = filePath[0]
        filePath = path.join(path.dirname(filePath),path.basename(filePath).split(".")[0])
        if(filePath) {
          currentWindow.send('saveTextAsHTML',filePath)
          documentWindowMap[path.basename(filePath)] = currentWindow
        }
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
        db.deleteTemporaryLinks()
        db.closeDatabase()
        global.sharedObj.database = null
        app.quit()
      }
    }
  ]}, {
    label: 'View',
    submenu: [
      {
        label: 'View All Links',
        click: function() {
          createHTMLWindow('public/link-list.html') 
        }
      },{
        label: 'View Document\'s Links',
        click: function(menuItem, currentWindow) {
          let doc_name
          Object.keys(documentWindowMap).forEach( (key) => {
            if(documentWindowMap[key]==currentWindow) doc_name = key
          })
          createHTMLWindow('public/link-list.html').then( (win) => {
            win.webContents.once('dom-ready', () => {
              win.webContents.send('send-doc-name', doc_name)
           }).catch((err) => {console.log(err)});
          })
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
      },{
        label: 'Cancel Link',
        enabled: false,
        id: 'cancel-link',
        click: function(menuItem, currentWindow) {
          let data = {cancel : true}
          currentWindow.webContents.send('cancel-anchor', data) //cannot sent message directly to main
          currentWindow.webContents.send('forward-anchor', data)
        }
      }
    ]
  }
]);

