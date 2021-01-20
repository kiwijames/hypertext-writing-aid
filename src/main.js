/**
 * Main function of the Hypertext Writing aid application.
 *
 * @file   Main file of the electron application.
 * @author Kevin Taylor
 */

const { app, BrowserWindow, webContents, ipcMain, dialog, Menu } = require('electron');
const fs = require('fs');
const os = require('os');  
const path = require('path');
const archiver = require('archiver');
const AdmZip = require('adm-zip');
const Database = require('./database.js');
const prompt = require('electron-multi-prompt');
const simplePrompt = require('prompt');
const del = require('del');

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
const tmpDir = os.tmpdir()
var dbFileName = ''
//const db = new Database(appUserPath,dbFileName)
var db
//global.sharedObj = {db: db}

let menu
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
    //Uncomment DevTools for debugging
    win.webContents.openDevTools()
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
  else win.setTitle("Hypertext Writing Aid - Note Editor")
  win.loadFile(HTMLFilePath)
  //Uncomment DevTools for debugging
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
  let contents = win.webContents
  win.on('ready-to-show', function() { 
    win.show(); 
    win.focus(); 
  });
  contents.on('dom-ready', () => {
    contents.send('pdfFile', pdfFilePath, pageNumber, quads, link_id)
  })
  //Uncomment DevTools for debugging
  contents.openDevTools()
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

  let dbFileList = fs.readdirSync(appUserPath).filter(file => file.includes(".sqlite"))
  let enqList = {}
  dbFileList.forEach(file => {
    enqList[path.basename(file).split(".")[0]] = path.basename(file).split(".")[0]
  })

  enquiryListPrompt.selectOptions = Object.assign({}, enqList)

  // ask for which enq.
  prompt(enquiryListPrompt).then( (result) => {
  if(!result) {
    prompt(enquiryNewPrompt).then( (result) => {
      if(!result) app.quit()    
      dbFileName = result+'.sqlite'
      db = new Database(appUserPath,dbFileName)
      global.sharedObj = {db: db}






        // DUPLICATED ! TODO: EXCLUDE IN FUNCTIONS OR USE SYNCHRONOUS PROMPTS

  if(process.platform == "darwin") {
    menu = menuMac
    Menu.setApplicationMenu(menu);
  } else {
    menu = menuNonMac
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

  if( (process.platform == 'win32' || process.platform == 'linux') && windowPDFList.length == 0) createEditorWindow('public/editor.html')

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
  } else {
    dbFileName = result+'.sqlite'
    db = new Database(appUserPath,dbFileName)
    global.sharedObj = {db: db}
  

  // DUPLICATED ! TODO: EXCLUDE IN FUNCTIONS OR USE SYNCHRONOUS PROMPTS

  if(process.platform == "darwin") {
    menu = menuMac
    Menu.setApplicationMenu(menu);
  } else {
    menu = menuNonMac
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

  if( (process.platform == 'win32' || process.platform == 'linux') && windowPDFList.length == 0) createEditorWindow('public/editor.html')

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
  }
  }

  )
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

ipcMain.on('open-anchor', (event, data) => {
  anchor_id = data
  db.getAnchorData(anchor_id).then( (data) => {
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

ipcMain.on('copy-link',(eventCopy, dataCopy) => {
  menu.getMenuItemById('copy-link').enabled = false
  menu.getMenuItemById('paste-link').enabled = true
  ipcMain.once('paste-link', (event, data) => {
    menu.getMenuItemById('copy-link').enabled = true
    menu.getMenuItemById('paste-link').enabled = false
    data.anchor_2.$anchor_text = dataCopy.anchor_1.$anchor_text
    data.anchor_1 = dataCopy.anchor_1

    db.createLinkWithAnchors("citation","",data.anchor_1,data.anchor_2).then( (link_ids) => {
      data.link_id = link_ids.link_id
      data.anchor_id_1 = link_ids.anchor_id_1
      data.anchor_id_2 = link_ids.anchor_id_2

      // send ids to pages for link updates
      event.sender.webContents.send("paste-link",data)
      eventCopy.sender.webContents.send("copy-link",data)
    })
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
    if( (data.anchor_2.$file_type == "text" && data.anchor_1.$file_type == "text") && data.windowId_1 == data.windowId_2){ // currently soent support links between text editors
      data.anchor_2 = null
      data.windowId_2 = null
      event.sender.webContents.send("alert","Linking in the same notes is currently not supported.")
      ipcMain.once('forward-anchor', (event) => {
        event.sender.webContents.send("get-anchor",data)
      })
      return
    }
    menu.getMenuItemById('start-link').enabled = true
    menu.getMenuItemById('finish-link').enabled = false
    menu.getMenuItemById('cancel-link').enabled = false

    db.getAllLinkTags().then((result) => {
      let options = ""
      result.forEach(tag => {
        options += "<option>"+tag["link_tag"]+"</option>"
      })
    let tmpLabel = linkSavingPromptOptions["inputArray"][0]["label"]
    linkSavingPromptOptions["inputArray"][0]["label"] = tmpLabel.split("<select>")[0]+ "<select>" + options + "</select>" + tmpLabel.split("</select>")[1]
    
      prompt(linkSavingPromptOptions, BrowserWindow.fromId(data.windowId_2)).then((result) => {
        if(!result) {
          data = {}
          event.sender.webContents.send("alert", "Linking canceled")
          return
        }
        db.createLinkWithAnchors(result["link_tag"],result["link_description"],data.anchor_1,data.anchor_2).then( (link_ids) => {
          data.link_id = link_ids.link_id
          data.anchor_id_1 = link_ids.anchor_id_1
          data.anchor_id_2 = link_ids.anchor_id_2
          BrowserWindow.fromId(data.windowId_1).webContents.send('put-link', data)
          if(data.windowId_1 != data.windowId_2) BrowserWindow.fromId(data.windowId_2).webContents.send('put-link', data)
          data = {}
        })
      }).catch((err) => {console.log(err)});
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

    if(documentWindowMap[data.doc_tag_1]){
      documentWindowMap[data.doc_tag_1].webContents.send("remove-link", link_id)
    }
    if(documentWindowMap[data.doc_tag_2]){
      documentWindowMap[data.doc_tag_2].webContents.send("remove-link", link_id)
    }
  })
})

////////////////////////////////////////////// const //////////////////////////////////////////////

let enquiryNewPrompt = {
  title: 'Create new enquiry',    
  label: 'Enquiry name:',
  alwaysOnTop: true, //allow the prompt window to stay over the main Window,
  type: 'input',
  width: 580, // window width
  height: 300, // window height
  resizable: true,
  buttonsStyle: {
    texts: {
      ok_text: 'Select', //text for ok button
      cancel_text: 'Create new Enquiry' //text for cancel button
    }
  },
  selectOptions: { 
    // to be filled
  }
}

let enquiryListPrompt = {
  title: 'Select Enquiry',    
  label: 'Please select an enquiry.',
  alwaysOnTop: true, //allow the prompt window to stay over the main Window,
  type: 'select',
  width: 580, // window width
  height: 300, // window height
  resizable: true,
  buttonsStyle: {
    texts: {
      ok_text: 'Create', //text for ok button
      cancel_text: 'Close application' //text for cancel button
    }
  },
  inputArray: [
    {
      key: 'enquiry_name',
      label: 'Enquiry Name:',
      value: '',
      useHtmlLabel: true,
      attributes: { // Optionals attributes for input
        placeholder: 'A enquiry name',
        required: true, // If there is a missing required input the result will be null, the required input will be recognized from '*'
        type: 'text',
      }
    }]
}

let linkSavingPromptOptions = {
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
      key: 'link_tag',
      label: 'Link Tag* <h6 style="display:inline;">(Currently used: <select><option>tbd</option><option>example</option></select>)</h6>:',
      value: '',
      useHtmlLabel: true,
      attributes: { // Optionals attributes for input
        placeholder: 'A link tag',
        required: true, // If there is a missing required input the result will be null, the required input will be recognized from '*'
        type: 'text',
      }
    },{
      key: 'link_description',
      label: 'Link Description:',
      value: '',
      attributes: { // Optionals attributes for input
        placeholder: 'A link description',
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
      label: 'Open Note',
      click: function(menuItem, currentWindow) {
        //if(!currentWindow) return
        //if(!windowEditorList.includes(currentWindow)) {
        //  currentWindow.webContents.send('alert', "This works only with the text editor focused.")
        //  return
        //}
        filePath = dialog.showOpenDialog({ 
          properties: ['openFile'] ,
          filters: [
            { name: "HTML", extensions: ["html", "htm"] },
            { name: "All Files", extensions: ["*"] }
          ]
        })
        if(filePath) {
          win = createEditorWindow('public/editor.html')
          if(filePath[0]!="/") filePath = filePath[0]
          win.send('loadText',filePath)  
          win.setTitle("Hypertext Writing Aid - "+path.basename(filePath[0]))

          //Object.entries(documentWindowMap).forEach((filename, win) => {
          //  if(win==currentWindow) documentWindowMap[filename]=null
          //})
          //documentWindowMap[path.basename(filePath[0])] = currentWindow
          //currentWindow.setTitle("Hypertext Writing Aid - "+path.basename(filePath[0]))
          //currentWindow.send('loadText',filePath[0])
        }
      }
    },
    {
      label: 'New Note Editor',
      accelerator: "CmdOrCtrl+n",
      click: function() {
        createEditorWindow('public/editor.html')          
      }
    },
    {
      label: 'Save Note As',
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
    // {
    //   label: 'Save PDF (without links)',
    //   enabled: true,
    //   id: 'save-pdf',
    //   click: function(menuItem, currentWindow) {
    //     //if(!currentWindow) return
    //     currentWindow.webContents.send("save-pdf")
    //   }
    // },
    {
      label: 'Export Enquiry',
      enabled: true,
      id: 'export-enq',
      click: function(menuItem, currentWindow) {

        // Create tmp path for consoldating files
        tmpFolder = path.join(appUserPath,'tmp-enq-export')
        fs.mkdirSync(tmpFolder)
        
        // Get all files of an enq and copy into temp folder
        db.getAllEnquiryDocs().then( (entries) => {
          console.log(entries)
          entries.forEach(entry => {
            doc = path.join(entry.doc_path,entry.doc_name)
            doc_copy = path.join(tmpFolder,entry.doc_name)
            //console.log(entry,doc,doc_copy)
            if(fs.existsSync(doc)) {
              console.log(doc+" exist")
              fs.copyFileSync(doc,doc_copy)
            }
          });

          // Archive all documents
          outputTarget = path.join(appUserPath,dbFileName+".zip")
          let output = fs.createWriteStream(outputTarget);
          console.log(outputTarget)
          let archive = archiver('zip');
          output.on('close', () => { console.log(archive.pointer() + ' total bytes; archiver has been finalized and the output file descriptor has closed.'); });
          archive.on('error', (err) => {console.log(err)});
          archive.pipe(output);
          archive.directory(tmpFolder, false);
          archive.append(fs.createReadStream(path.join(app.getPath("userData"), dbFileName )), { name: dbFileName });
          archive.finalize();

          // Ask user where to save
          dialog.showSaveDialog({defaultPath: '~/'+path.basename(dbFileName, '.sqlite')+'.zip'}, (newArchivePath, err) => {
            if (err || !newArchivePath) {
              // Clean up and remove temporary folder
              del([path.join(tmpFolder+'/*')],{force:true})
              del([path.join(tmpFolder,'/')],{force:true})
              dialog.showMessageBox({buttons: ["OK"],message: "Export aborted."});
            } else{
              // Moves file to user specified path
              fs.rename(outputTarget, newArchivePath, function (err) {
                if (err) {
                  // Clean up and remove temporary folder
                  del([path.join(tmpFolder+'/*')],{force:true})
                  del([path.join(tmpFolder,'/')],{force:true})
                  dialog.showMessageBox({buttons: ["OK"],message: "Export failed."});
                } else {
                  // Clean up and remove temporary folder
                  del([path.join(tmpFolder+'/*')],{force:true})
                  del([path.join(tmpFolder,'/')],{force:true})

                  dialog.showMessageBox({buttons: ["OK"],message: "Export finished."});
                }
              })
            }
          })
        }).catch((err) => {console.log(err)});
      }
    },
    {
      label: 'Import Enquiry',
      enabled: true,
      id: 'import-enq',
      click: function(menuItem, currentWindow) {
        // Get archive to import from user
        archivePath = dialog.showOpenDialog({ 
            properties: ['openFile'],
            filters: [
              { name: "ZIP", extensions: ["zip"] }
            ]
          })
        if(!archivePath) {
          dialog.showMessageBox({buttons: ["OK"],message: "Import aborted."});
          return
        }
        // Create tmp path for unpacking files
        tmpFolder = path.join(appUserPath,'tmp-enq-import')
        fs.mkdirSync(tmpFolder)

        archivePath = archivePath[0]
        console.log("extracting ",archivePath," to ",tmpFolder)
        let zip = new AdmZip(archivePath)
        zip.extractAllTo(tmpFolder+"/", true);

        archivePathReal = tmpFolder
        //path.join(tmpFolder,path.parse(archivePath).name+"/");
        
        //get sqlite path
        let files = fs.readdirSync(archivePathReal);

          sqliteFileName = files.filter( function(file){
            return file.includes("sqlite")
          })[0]
          console.log(sqliteFileName)
          let dbFile = path.join(archivePathReal,sqliteFileName)
         
          // Moves database to appUserPath
          let newDbPath = path.join(appUserPath, path.parse(archivePath).name+".sqlite")
          fs.rename(dbFile, newDbPath, function (err) {
            if (err) console.log(err)
              del([dbFile],{force:true})
          })
          extractPath = dialog.showOpenDialog({ properties: ['openDirectory'] });
          if(!extractPath) {
            // Clean up and remove temporary folder
            del([path.join(archivePathReal,'/*')],{force:true})
            del([path.join(tmpFolder+'/*/')],{force:true})
            del([path.join(tmpFolder,'/')],{force:true})
            dialog.showMessageBox({buttons: ["OK"],message: "Import aborted."});
            return
          }
          console.log("extractPath: "+ extractPath)
          files = fs.readdirSync(archivePathReal);
          console.log("files: "+ files)
          files.forEach( file => {
            console.log("file in foreach: "+file)
            fs.rename(path.join(archivePathReal,file), path.join(""+extractPath,file), function (err) {
              if (err) { console.log(err) }
              else {
                db.updatePathsAfterImport(""+extractPath,newDbPath) 
              }
            })
          })

          // Clean up and remove temporary folder
          del([path.join(archivePathReal,'/*')],{force:true})
          del([path.join(tmpFolder+'/*/')],{force:true})
          del([path.join(tmpFolder,'/')],{force:true})

          dialog.showMessageBox({buttons: ["OK"],message: "Import finished."});
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
        label: 'View Enquiry Links',
        click: function() {
          createHTMLWindow('public/link-list.html') 
        }
      },{
        label: 'View Document Links',
        click: function(menuItem, currentWindow) {
          if(!currentWindow) return
          let doc_name
          Object.keys(documentWindowMap).forEach( (key) => {
            if(documentWindowMap[key]==currentWindow) doc_name = key
          })
          createHTMLWindow('public/link-list.html').then( (win) => {
            win.webContents.once('dom-ready', () => {
              win.webContents.send('send-doc-name', doc_name)
           })
          }).catch((err) => {console.log(err)});
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
          if(!currentWindow) return
          currentWindow.webContents.send('get-anchor')
        }
      },{
        label: 'Finish Link',
        accelerator: "CmdOrCtrl+l",
        enabled: false,
        id: 'finish-link',
        click: function(menuItem, currentWindow) {
          if(!currentWindow) return
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
      },{
        label: 'Copy with Link',
        accelerator: "CmdOrCtrl+Shift+c",
        enabled: true,
        id: 'copy-link',
        click: function(menuItem, currentWindow) {
          if(!currentWindow) return
          currentWindow.webContents.send('copy-link')
        }
      },{
        label: 'Paste with Link',
        accelerator: "CmdOrCtrl+Shift+p",
        enabled: false,
        id: 'paste-link',
        click: function(menuItem, currentWindow) {
          if(!currentWindow) return
          currentWindow.webContents.send('paste-link')
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
      label: 'Open Text',
      click: function(menuItem, currentWindow) {
        //if(!currentWindow) return
        //if(!windowEditorList.includes(currentWindow)) {
        //  currentWindow.webContents.send('alert', "This works only with the text editor focused.")
        //  return
        //}
        filePath = dialog.showOpenDialog({ 
          properties: ['openFile'] ,
          filters: [
            { name: "HTML", extensions: ["html", "htm"] },
            { name: "All Files", extensions: ["*"] }
          ]
        })
        if(filePath) {
          win = createEditorWindow('public/editor.html')
          if(filePath[0]!="/") filePath = filePath[0]
          win.send('loadText',filePath)  
          win.setTitle("Hypertext Writing Aid - "+path.basename(filePath[0]))

          //Object.entries(documentWindowMap).forEach((filename, win) => {
          //  if(win==currentWindow) documentWindowMap[filename]=null
          //})
          //documentWindowMap[path.basename(filePath[0])] = currentWindow
          //currentWindow.setTitle("Hypertext Writing Aid - "+path.basename(filePath[0]))
          //currentWindow.send('loadText',filePath[0])
        }
      }
    },
    {
      label: 'New Note Editor',
      accelerator: "CmdOrCtrl+n",
      click: function() {
        createEditorWindow('public/editor.html')          
      }
    },
    {
      label: 'Save Note As',
      accelerator: "CmdOrCtrl+Shift+s",
      id: 'save-text',
      click: function(menuItem, currentWindow) {
        if(!currentWindow) return
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
    // {
    //   label: 'Save PDF (without links)',
    //   enabled: false,
    //   id: 'save-pdf',
    //   click: function(menuItem, currentWindow) {
    //     if(!currentWindow) return
    //     currentWindow.webContents.send("alert","Not yet implemented")
    //   }
    // },
    {
      label: 'Export PDF (with links)',
      enabled: false,
      id: 'export-pdf',
      click: function(menuItem, currentWindow) {
        if(!currentWindow) return
        currentWindow.webContents.send("alert","Not yet implemented")
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
        label: 'View Enquiry Links',
        click: function() {
          createHTMLWindow('public/link-list.html') 
        }
      },{
        label: 'View Document Links',
        click: function(menuItem, currentWindow) {
          if(!currentWindow) return
          let doc_name
          Object.keys(documentWindowMap).forEach( (key) => {
            if(documentWindowMap[key]==currentWindow) doc_name = key
          })
          createHTMLWindow('public/link-list.html').then( (win) => {
            win.webContents.once('dom-ready', () => {
              win.webContents.send('send-doc-name', doc_name)
           })
          }).catch((err) => {console.log(err)});
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
          if(!currentWindow) return
          currentWindow.webContents.send('get-anchor')
        }
      },{
        label: 'Finish Link',
        accelerator: "CmdOrCtrl+l",
        enabled: false,
        id: 'finish-link',
        click: function(menuItem, currentWindow) {
          if(!currentWindow) return
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
      },{
        label: 'Copy with Link',
        accelerator: "CmdOrCtrl+Shift+c",
        enabled: true,
        id: 'copy-link',
        click: function(menuItem, currentWindow) {
          if(!currentWindow) return
          currentWindow.webContents.send('copy-link')
        }
      },{
        label: 'Paste with Link',
        accelerator: "CmdOrCtrl+Shift+p",
        enabled: false,
        id: 'paste-link',
        click: function(menuItem, currentWindow) {
          if(!currentWindow) return
          currentWindow.webContents.send('paste-link')
        }
      }
    ]
  }
]);

