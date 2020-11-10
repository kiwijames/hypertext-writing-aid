const { app, BrowserWindow, webContents, ipcMain, dialog, Menu } = require('electron')
const fs = require('fs')
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// one instance only
const gotTheLock = app.requestSingleInstanceLock()
if(!gotTheLock) {
  app.quit()
}

const appBasePath = app.getAppPath()
const appUserPath = app.getPath("userData")
const dbFileName = 'mydatabase.sqlite'
const fullDbPath = path.join(appUserPath,dbFileName)
var db = initDatabase(fullDbPath)
//todo db loading with promises and global sharing

let windowPDFList = []
let idWindowMap = {} //path to win - win mapping
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
    minWidth:630,
    maxWidth:630,
    height: 440 ,
    webPreferences: {
      nodeIntegration:true
    }
  })
  win.loadFile(HTMLFilePath)
  //win.webContents.openDevTools()
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
      idEditorMap[HTMLFilePath] = null
    }
  })
  idWindowMap[HTMLFilePath] = win
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
  //contents.openDevTools()
  win.on('close', () => {
    // Dereference the window object from list
    windowPDFList = windowPDFList.filter(w => w.id !== win.id)
    win = null
    idWindowMap[pdfFilePath] = null
  })
  windowPDFList.push(win)
  idWindowMap[pdfFilePath] = win
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
          windowPDFList.map(window => {
            if(window.id!=currentWindow.id)
              window.webContents.send('linking-message') //start linking next marked texts
          })
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


////////////////////////////link linking handeling////////////////////////////////////////

/**
 * Creates 2 windows of pdf documents next to each other.
 * @param  {String} pdfPath1 Absolute path to a PDF file.
 * @param  {String} pdfPath2 Absolute path to a PDF file.
 * @param  {Number} pageNumber1 On which page to open the file.
 * @param  {Number} pageNumber2 On which page to open the file.
 * @param  {Object} quads1 PDFtron values of linked elements.
 * @param  {Object} quads1 PDFtron values of linked elements.
 * @param  {Number} link_id The link id for using the links.
 */
function linklink(pdfPath1,pdfPath2,pageNumber1=1,pageNumber2=1,quads1,quads2, link_id){
  const {screen} = require('electron')
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  console.log(link_id)
  let win1 = createPDFWindow(pdfPath1,pageNumber1,quads1,link_id)
  let win2 = createPDFWindow(pdfPath2,pageNumber2,quads2,link_id)
  win1.setSize(width/2,height)
  win2.setSize(width/2,height)
  win1.setPosition(0,0)
  win2.setPosition(width/2,0)
}

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
    deleteUnsavedInternalLinks()

  if(global.sharedObj.database) global.sharedObj.database.close();
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

////////////////////////////message handeling////////////////////////////////////////

let linkingCounter = 0
let linkData = {
  linkName: "default",
  docName1: "",
  docName2: "",
  pageNumber1: 0,
  pageNumber2: 0,
  pageSelection1: "",
  pageSelection2: ""
}

ipcMain.on('linking-answer', (event, arg) => {
  //arg looks like this:
  // data = {
  //   text : docViewer.getSelectedText(),
  //   windowId : remote.getCurrentWindow().id,
  //   pdfName : pdfFileName,
  //   pageNumber: docViewer.getCurrentPage(),
  //   quads: allQuads
  // }
  console.log("link counter: "+linkingCounter)
  if(linkingCounter==0){
    linkData.docName1 = arg.pdfName
    linkData.pageNumber1 = arg.pageNumber
    quadString = JSON.stringify(arg.quads)
    linkData.pageSelection1 = quadString
    data = { toast: true }
    event.sender.send('firstLinkReceived', data)
    linkingCounter++
  }else if (linkingCounter==1) {
    linkData.docName2 = arg.pdfName
    linkData.pageNumber2 = arg.pageNumber
    quadString = JSON.stringify(arg.quads)
    linkData.pageSelection2 = quadString
    data = { toast: true }
    event.sender.send('secondLinkReceived', data)
    linkingCounter++
  }
  if (linkingCounter==2) {
    linkingCounter=0;
  }
  // Return some data to the renderer process with the mainprocess-response ID
  //event.sender.send('mainprocess-response', "Hello World!");
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

ipcMain.on('deleteLink', (event, arg) => {
  console.log(arg)
  deleteLinkEntryById(arg)
});
ipcMain.on('deleteInternalLink', (event, arg) => {
  console.log(arg)
  deleteInternalLinkEntryById(arg)
});


ipcMain.on('call-linked-links', (event, arg) => {
  //arg = link_id
  compareElementsFromLinkId(arg)
});

ipcMain.on('openOtherLink', (event, data) => {
  //data = {
  //  linkId : linkId,
  //  pdfName : pdfFileName
  //}
  openOtherLink(data.linkId, data.pdfName)
});

ipcMain.on('internal-link-step2', (event, data) => {
  tmpMenu = menu
  tmpMenu.getMenuItemById('putPdfLink').enabled = true
  origSenderId=event.sender.getOwnerBrowserWindow().id
  data.origSenderId = origSenderId
  console.log("origsenderid "+data.origSenderId)
  console.log("origsenderid data "+data)
  windowEditorList.forEach(w => w.send('internal-link-step3', data)) //But how to stop broadcast
});

ipcMain.on('internal-link-step5', (event, data) => {
  origSenderId = data.origSenderId
  editorWindowId = data.editorWindowId
  //dataToPutInDb = {
  //  link_name: 'tbd', 
  //  doc_name: 'tbd',
  //  doc_text: 'tbd', 
  //  doc_range: 'tbd', 
  //  pdf_name: pdfLinkData.pdfName, 
  //  pdf_data: pdfLinkData.pageNumber, 
  //  pdf_quads: pdfLinkData.quads, 
  //}
  quads_string = JSON.stringify(data.pdf_quads)
  let insertStatement = "INSERT INTO internallinks(link_name,doc_name,\
                          doc_text,doc_range,pdf_name,pdf_data,pdf_quads) \
                          VALUES('"+data.link_name+"','"+data.doc_name+"','"+data.doc_text+"','"+
                          data.doc_range+"','"+data.pdf_name+"','"+data.pdf_data+"','"+
                          quads_string+"')"
  
  global.sharedObj.database.run(insertStatement, function(err){
    if(err){
      console.log(err)
    } else{
      lastLinkId = this.lastID
      console.log("last_insert_rowid row: "+lastLinkId)
      event.sender.webContents.send('internal-link-step6', lastLinkId)
      data = {
        quads: data.pdf_quads,
        internalLinkId: lastLinkId,
        editorWindowId: editorWindowId,
      }
      BrowserWindow.fromId(origSenderId).webContents.send('internal-link-step7', data)
    }
  });
});

ipcMain.on('call-pdf-link', (event, data) => {
  //data = linkID
  
  openPdfLink(data)
});

ipcMain.on('openInternalLink', (event, data) => {
  //data = linkID
  console.log("need to open editor with text with id "+data)
  //todo, open editor with saved text
  doc_path = getInternalLinkDocPath(data)
  console.log("docPath: "+doc_path)
  //todo with await and promises
  //createHTMLWindow('public/editor.html',doc_path)
});

ipcMain.on('openEditorLink', (event, data) => {
  //data = windowID
  console.log("window id that gets focus:"+data)
  //BrowserWindow.fromId(data).focus() //not working!
  windowEditorList.filter(w => w.id !== data).pop().focus()
});

ipcMain.on('saveTextAsHTML-step2',(event, data) => {
  //data = file path and internalLinkIdList
  console.log("internallink id list? "+data.internalLinkIdList)
  putPathForInternalIds(data.internalLinkIdList, data.filepath)
  //update links in pdf-viewers
});

////////////////////////////database functions////////////////////////////////////////
function getInternalLinkDocPath(link_id) {
  let selectStatement = "Select doc_name from internallinks WHERE link_id="+link_id;
  global.sharedObj.database.all(selectStatement, function(err,rows){
    if(err){
      console.log(err)
    }else{
      rows.forEach((row) => {
        doc_path = rows[0].doc_name
        console.log("returning do path "+doc_path)
        if(idEditorMap[doc_path]) idEditorMap[doc_path].focus()
        else createHTMLWindow('public/editor.html',doc_path)
        return doc_path
      })
    }
  })

}

function deleteUnsavedInternalLinks() {
  let deleteStatement = "DELETE FROM internallinks WHERE doc_name='tbd'";
  global.sharedObj.database.run(deleteStatement, function(err){
    if(err){
      console.error("problem deleting internallink")
      console.error(err)
    } else console.debug("deleted internallinks with doc_name tbd")
  });
}



function putPathForInternalIds(internalLinkIdList, filePath){
  console.log("internallink id list? "+internalLinkIdList)
  internalLinkIdList.forEach(id=>putPathForInternalId(id,filePath))
}

function putPathForInternalId(internalLinkId, filePath){
  let insertStatement = "UPDATE internallinks SET doc_name='"+filePath+"' WHERE link_id="+internalLinkId

  global.sharedObj.database.run(insertStatement, function(err){
    if(err){
      console.log(err)
      console.log("PROBLEM internal link with id "+internalLinkId)
      return false
    }else{
      console.log("inserted internal link with id "+internalLinkId)
      return true
    }
  });
}

function openPdfLink(link_id){
  let selectStatement = "SELECT * from internallinks WHERE link_id="+link_id;
  global.sharedObj.database.all(selectStatement, function(err,rows){
    if(err){
      console.log(err)
    }else{
      rows.forEach((row) => {
        pdf_name = rows[0].pdf_name
        data = rows[0].pdf_data //page
        quads = JSON.parse(rows[0].pdf_quads)

        
        if(windowPDFList[pdf_name]) windowPDFList[pdf_name].focus() //only works with promise, as sqlite3 async
        else createPDFWindow(pdf_name,data,quads)
      })
    }
  })
}

//TODO: remove hard coded function call, do with callback
function openOtherLink(link_id, pdfName){
  let selectStatement = "SELECT * from links WHERE link_id="+link_id;
  //let db = new sqlite3.Database('mydatabase.sqlite')
  if(!link_id) return;
  global.sharedObj.database.all("SELECT * FROM links WHERE link_id="+link_id+";", function(err,rows){ //only 1 row, as id unique
    if(err){
      console.error("problem getting link")
      console.error(err)
    }else{
      let row = rows[0]
      console.log(pdfName+" == "+row.document_name_1)
      if(pdfName == row.document_name_1){
        doc = row.document_name_2
        if(idWindowMap[doc]){
          let win = idWindowMap[doc]
          console.log("focus on "+doc)
          win.focus()
          win.webContents.send('focusText',row.document_data_2)
        }else createPDFWindow(doc, row.document_data_2, JSON.parse(row.document_quads_2), link_id)
      }else{
        doc = row.document_name_1
        if(idWindowMap[doc]){
          let win = idWindowMap[doc]
          console.log("focus on "+doc)
          win.focus()
          win.webContents.send('focusText',row.document_data_1)
        }else createPDFWindow(doc, row.document_data_1, JSON.parse(row.document_quads_1), link_id)
      }
    }
  })
}


//TODO: remove hard coded function call, do with callback
function compareElementsFromLinkId(link_id, callback){
  let selectStatement = "SELECT * from links WHERE link_id="+link_id;
  //let db = new sqlite3.Database('mydatabase.sqlite')
  db.all(selectStatement, function(err,rows){
    if(err){
      console.log(err)
    }else{
      rows.forEach((row) => {
        path1 = rows[0].document_name_1
        path2 = rows[0].document_name_2
        pageNumber1 = rows[0].document_data_1
        pageNumber2 = rows[0].document_data_2
        quadsString1 = rows[0].document_quads_1
        quadsString2 = rows[0].document_quads_2
        quads1 = JSON.parse(quadsString1)
        quads2 = JSON.parse(quadsString2)
        linklink(path1,path2,pageNumber1,pageNumber2,quads1,quads2,link_id)
      })
    }
  })
}


/**
 * Deletes entry from the 'links' table,
 * based on the given link_id.
 * @param  {Number} link_id Id corresponding to an entry in the 'links' table
 */
function deleteLinkEntryById(link_id) {
  let deleteStatement = "DELETE FROM links WHERE link_id="+link_id;
  //let db = new sqlite3.Database(fullDbPath)
  global.sharedObj.database.run(deleteStatement, function(err){
    if(err){
      console.error("problem deleting link")
      console.error(err)
    } else console.debug("deleted link with id"+link_id)
  });
}

function deleteInternalLinkEntryById(link_id) {
  let deleteStatement = "DELETE FROM internallinks WHERE link_id="+link_id;
  //let db = new sqlite3.Database(fullDbPath)
  global.sharedObj.database.run(deleteStatement, function(err){
    if(err){
      console.error("problem deleting link")
      console.error(err)
    } else console.debug("deleted link with id"+link_id)
  });
}



/**
 * Creates a database with the default schema,
 * based on the given path and name.
 * @param  {String} fullDbPath Complete path of the sqlite3 database file
 */
async function initDatabase(fullDbPath){
  let fullFilePath = fullDbPath
  //Creating a table automatically includes ROWID
  //document_name_X is the name of the document in which the link was set
  //document_data includes the text, as well as the quads and page_number
  createLinkTable = 'CREATE TABLE links (\
    link_id INTEGER PRIMARY KEY AUTOINCREMENT,\
    link_name TEXT,\
    document_name_1 TEXT NOT NULL,\
    document_data_1 TEXT NOT NULL,\
    document_quads_1 TEXT NOT NULL,\
    document_name_2 TEXT NOT NULL,\
    document_data_2 TEXT NOT NULL,\
    document_quads_2 TEXT NOT NULL,\
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\
    );'
  
    createInternalLinkTable = 'CREATE TABLE internallinks (\
      link_id INTEGER PRIMARY KEY AUTOINCREMENT,\
      link_name TEXT,\
      doc_name TEXT NOT NULL,\
      doc_text TEXT NOT NULL,\
      doc_range TEXT NOT NULL,\
      pdf_name TEXT NOT NULL,\
      pdf_data TEXT NOT NULL,\
      pdf_quads TEXT NOT NULL,\
      creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\
      );'

  //TODO: document mapping for name-changes

  fs.access(fullFilePath, fs.F_OK, (err) => {
    if (err) {
      console.log(err)
      console.log("Datbase not found.")
      console.log("Datbase will be initiated found.")
      let db = new sqlite3.Database(fullFilePath)
      global.sharedObj = {database: db}
      db.run(createLinkTable)
      db.run(createInternalLinkTable)
      return db
    }else{
      let db = new sqlite3.Database(fullFilePath)
      global.sharedObj = {database: db}
      console.log("db exists under : "+fullFilePath)
      console.log("db exists: "+db)
      return db
    }
  })
}
