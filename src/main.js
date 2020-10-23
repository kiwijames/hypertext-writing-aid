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
function createPDFWindow(pdfFilePath, pageNumber=1, quads) {

  let win = new BrowserWindow({ 
    width: 800, 
    height: 600 ,
    webPreferences: {
      nodeIntegration:true,
      webSecurity: false
  }});
  win.setMenu(menuPDF)
  //win.setMenuBarVisibility(false)
  win.loadFile('public/template.html')
  let contents = win.webContents
  contents.on('dom-ready', () => {
    contents.send('pdfFile', pdfFilePath, pageNumber, quads)
  })
  // Uncomment DevTools for debugging
  contents.openDevTools()
  win.on('close', () => {
    // Dereference the window object from list
    windowPDFList = windowPDFList.filter(w => w.id !== win.id)
    win = null
  })
  windowPDFList.push(win)
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
 */
function linklink(pdfPath1,pdfPath2,pageNumber1=1,pageNumber2=1,quads1,quads2){
  const {screen} = require('electron')
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  let win1 = createPDFWindow(pdfPath1,pageNumber1,quads1)
  let win2 = createPDFWindow(pdfPath2,pageNumber2,quads2)
  win1.setSize(width/2,height)
  win2.setSize(width/2,height)
  win1.setPosition(0,0)
  win2.setPosition(width/2,0)
}

////////////////////////////app event handeling////////////////////////////////////////

// Create main window when ready
app.on('ready', () => {
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
    console.log("arg.pdfname: "+arg.pdfName)
    linkData.pageNumber1 = arg.pageNumber
    console.log("quadString2: "+arg.pageNumber)
    console.log("quadString2: "+arg.pageNumber)
    quadString = JSON.stringify(arg.quads) //.reduce((accumulator, quad) =>{accumulator + quad})
    console.log("quadString: "+quadString)
    linkData.pageSelection1 = quadString
    data = { toast: true }
    event.sender.send('firstLinkReceived', data)
    linkingCounter++
  }else if (linkingCounter==1) {
    linkData.docName2 = arg.pdfName
    console.log("quadString2: "+arg.pdfName)
    linkData.pageNumber2 = arg.pageNumber
    console.log("quadString2: "+arg.pageNumber)
    quadString = JSON.stringify(arg.quads) //.reduce((accumulator, quad) =>{accumulator + quad})
    console.log("quadString2: "+quadString)
    linkData.pageSelection2 = quadString
    data = { toast: true }
    event.sender.send('secondLinkReceived', data)
    linkingCounter++
  }
  if (linkingCounter==2) {
    linkingCounter=0
  }
  // Return some data to the renderer process with the mainprocess-response ID
  //event.sender.send('mainprocess-response', "Hello World!");
});

ipcMain.on('save-link', (event, data) => {
  linkData.linkName = data.linkName
  console.log("save-link called")
  let insertStatement = "INSERT INTO links(link_name,document_name_1,\
                          document_data_1,document_quads_1,document_name_2,document_data_2,document_quads_2) \
                          VALUES('"+linkData.linkName+"','"+linkData.docName1+"','"+linkData.pageNumber1+"','"+linkData.pageSelection1+"','"+linkData.docName2+"','"+linkData.pageNumber2+"','"+linkData.pageSelection2+"')"
  
  let db = new sqlite3.Database('mydatabase.sqlite')
  console.log("db: "+db)
  db.run(insertStatement)
  /*
  console.log('A row has been inserted');
  db.all("SELECT * FROM links", function(err,rows){
    let rowText ="link_id | link_name | name1 | data1 | name2 | data2\n"
    rows.forEach((row) => {
      rowText = rowText+row.link_id+"|"+row.link_name+"|"+row.document_name_1+"|"+row.document_data_1+"|"+row.document_name_2+"|"+row.document_data_2+"\n"
    });
    editorWindow.webContents.send('table-data',rowText)
  })*/
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
  console.log(arg)
  let {path1, path2} = getPathsFromLinkId(arg)
  console.log(path1)
  console.log(path2)
  //linklink(path1,path2)
});


////////////////////////////database functions////////////////////////////////////////
function getPathsFromLinkId(link_id, callback){
  let selectStatement = "SELECT * links WHERE link_id="+link_id;
  let db = new sqlite3.Database('mydatabase.sqlite')
  var path1
  var path2
  db.all("SELECT * FROM links WHERE link_id="+link_id+";", function(err,rows){//WHERE link_id="+link_id
    //let rowText ="link_id | link_name | name1 | data1 | name2 | data2\n"
    rows.forEach((row) => {
      path1 = rows[0].document_name_1
      path2 = rows[0].document_name_2
      pageNumber1 = rows[0].document_data_1
      pageNumber2 = rows[0].document_data_2
      quadsString1 = rows[0].document_quads_1
      quadsString2 = rows[0].document_quads_2
      console.log(quadsString1)
      console.log(quadsString2)
      quads1 = JSON.parse(quadsString1)
      quads2 = JSON.parse(quadsString2)
      linklink(path1,path2,pageNumber1,pageNumber2,quads1,quads2)
    })
  })
  return {path1,path2}
}



function deleteLinkEntryById(link_id) {
  let deleteStatement = "DELETE FROM links WHERE link_id="+link_id;
  let db = new sqlite3.Database('mydatabase.sqlite')
  db.run(deleteStatement, function(err){
    if(err){
      console.error("problem when deleting link")
      console.error(err)
    } else console.log("deleted link with id"+link_id)
  });
}

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
