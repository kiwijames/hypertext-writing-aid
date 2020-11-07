const { app, BrowserWindow, webContents, ipcMain, dialog, Menu } = require('electron')
const fs = require('fs')
const pfd = require('path');
const sqlite3 = require('sqlite3').verbose();

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.


const app_path = app.getAppPath()
const dbFileName = 'mydatabase.sqlite'
const db = initDatabase('', dbFileName)
let windowPDFList = []
let idWindowMap = {}
let editorWindow  


////////////////////////////creating functions////////////////////////////////////////


/**
 * Creates and returns a window,
 * loading a given HTML file.
 * @param  {String} HTMLFilePath Absolute path to a PDF file.
 * @return {BrowserWindow} Window with the PDF in a Viewer.
 */
function createHTMLWindow (HTMLFilePath) {
  // Create the browser window.
  let win = new BrowserWindow({ 
  width: 630, 
  minWidth:630,
  maxWidth:630,
	height: 440 ,
	webPreferences: {
	nodeIntegration:true
}})
  win.loadFile(HTMLFilePath)
  // win.webContents.openDevTools()
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
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
  win.setTitle(pfd.basename(pdfFilePath))
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
            if(filePaths) filePaths.forEach( (path) => { createPDFWindow(path); })
          }
      }, 
      {
        label: 'Import Text',
        accelerator: "CmdOrCtrl+i",
        click: function() {
          path = dialog.showOpenDialog({ 
            properties: ['openFile'] ,
            filters: [
              { name: "HTML", extensions: ["html", "htm"] },
              { name: "All Files", extensions: ["*"] }
              ]
            })
          if(path) editorWindow.webContents.send('loadText',path[0])
        }
      }, 
      {
        label: 'Save As',
        accelerator: "CmdOrCtrl+Shift+s",
        click: function() {
          let path = dialog.showSaveDialog()
          if(path) editorWindow.webContents.send('saveTextAsHTML',path)
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
        label: 'View Links',
        click: function() {
          createHTMLWindow('public/linked-list.html')
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
        label: 'Link selection',
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
app.on('ready', () => {

  // If app is opend on windows by opening a file 
  if (process.platform == 'win32' && process.argv.length >= 2) {
    var openFilePath = process.argv[1];
    if (openFilePath == "asdad") {
      try{
        console.log(openFilePath);
        createPDFWindow(openFilePath)}
      catch(e){
        dialog.showErrorBox("opening pdf problem", e + " und datei: "+openFilePath)
      }
    }
  }

    editorWindow = createHTMLWindow('public/editor.html')
})

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if(db) db.close();
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
  
  let db = new sqlite3.Database('mydatabase.sqlite')
  db.run(insertStatement, function(err){
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


////////////////////////////database functions////////////////////////////////////////

//TODO: remove hard coded function call
function openOtherLink(link_id, pdfName){
  let selectStatement = "SELECT * links WHERE link_id="+link_id;
  let db = new sqlite3.Database('mydatabase.sqlite')
  if(!link_id) return;
  db.all("SELECT * FROM links WHERE link_id="+link_id+";", function(err,rows){ //only 1 row, as id unique
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


//TODO: remove hard coded function call
function compareElementsFromLinkId(link_id, callback){
  let selectStatement = "SELECT * from links WHERE link_id="+link_id;
  let db = new sqlite3.Database('mydatabase.sqlite')
  db.all(selectStatement, function(err,rows){
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
  })
}


/**
 * Deletes entry from the 'links' table,
 * based on the given link_id.
 * @param  {Number} link_id Id corresponding to an entry in the 'links' table
 */
function deleteLinkEntryById(link_id) {
  let deleteStatement = "DELETE FROM links WHERE link_id="+link_id;
  let db = new sqlite3.Database('mydatabase.sqlite')
  db.run(deleteStatement, function(err){
    if(err){
      console.error("problem deleting link")
      console.error(err)
    } else console.debug("deleted link with id"+link_id)
  });
}

/**
 * Creates a database with the default schema,
 * based on the given path and name.
 * @param  {String} path Path of the sqlite3 database file
 * @param  {String} databaseName name of the sqlite3 database file
 */
function initDatabase(path, databaseName){
  let fullFilePath = pfd.join(path, databaseName)
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
  
  //TODO: document mapping for name-changes

  fs.access(fullFilePath, fs.F_OK, (err) => {
    if (err) {
      console.log(err)
      console.log("Datbase not found.")
      console.log("Datbase will be initiated found.")
      let db = new sqlite3.Database('mydatabase.sqlite')
      db.run(createLinkTable)
      return db
    }else{
      let db = new sqlite3.Database('mydatabase.sqlite')
      return db
    }
  })
}
