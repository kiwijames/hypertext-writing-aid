const { app, BrowserWindow, webContents, ipcMain, dialog, Menu } = require('electron')
const fs = require('fs')
const sqlite3 = require('sqlite3').verbose();
// Most this code comes directly from https://electronjs.org/docs/tutorial/first-app

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.

const db = initDatabase('','mydatabase.sqlite')
let win
//excluding the editor/main window
let windowList = []

function createHTMLWindow (HTMLFilePath) {
  // Create the browser window.
  win = new BrowserWindow({ 
  width: 630, 
  minWidth:630,
  maxWidth:630,
	height: 440 ,
	webPreferences: {
	nodeIntegration:true
}})
  // and load the index.html of the app.
  win.loadFile(HTMLFilePath)
  win.webContents.openDevTools()
  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
  return win
}

function createPDFWindow(pdfFilePath) {
  win = new BrowserWindow({ 
	width: 800, 
	height: 600 ,
	webPreferences: {
	  nodeIntegration:true
}})
win.setMenuBarVisibility(false)
  // and load the index.html of the app.
  win.loadFile('public/template.html')
  let contents = win.webContents
  contents.on('dom-ready', () => {
    console.log('send pdfFile message: '+pdfFilePath)
    contents.send('pdfFile', pdfFilePath)
  })
  // Open the DevTools.
 // contents.openDevTools()
  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null
  })
  return win
}

var menu = Menu.buildFromTemplate([
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
            if(filePaths) filePaths.forEach( (path) => { windowList.push(createPDFWindow(path)) })
          }
      }, 
      {
        label: 'Load Text',
        accelerator: "CmdOrCtrl+l",
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
Menu.setApplicationMenu(menu);


////////////////////////////////////////////////////////////////////////////////////




// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', () => {
    //window1 = createPDFWindow('Bush – As we may think.pdf')
    //window2 = createPDFWindow('Bush – As we may think.pdf')
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

ipcMain.on('linking-action', (event, arg) => {
  console.log("linking action to be performed");
  windowList.map(window => {
    window.webContents.send('linking-message') //start linking next marked texts
  })
});

let linkingCounter = 0
ipcMain.on('linking-answer', (event, arg) => {
  console.log("link counter: "+linkingCounter)
  if(linkingCounter==0){
    editorWindow.webContents.send('link1',arg)
    linkingCounter++
  }else if (linkingCounter==1) {
    editorWindow.webContents.send('link2',arg)
    linkingCounter++
  }
  if (linkingCounter==2) {
    linkingCounter=0
  }
  // Return some data to the renderer process with the mainprocess-response ID
  //event.sender.send('mainprocess-response', "Hello World!");
});

ipcMain.on('save-link', (event, data) => {
  console.log("save-link called")
  let insertStatement = "INSERT INTO links(link_name,document_name_1,\
                          document_data_1,document_name_2,document_data_2) \
                          VALUES('"+data.linkName+"','"+data.docName1+"','bla','"+data.docName2+"','blabla')"
  
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

function deleteLinkEntryById(link_id){
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
  //Creating a table automatically includes ROWID
  //document_name_X is the name of the document in which the link was set
  //document_data includes the text, as well as the quads and page_number
  createLinkTable = 'CREATE TABLE links (\
    link_id INTEGER PRIMARY KEY AUTOINCREMENT,\
    link_name TEXT,\
    document_name_1 TEXT NOT NULL,\
    document_data_1 TEXT NOT NULL,\
    document_name_2 TEXT NOT NULL,\
    document_data_2 TEXT NOT NULL,\
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\
    );'
  
  //TODO: document mapping for name-changes
  //DocumentNameMappingTable = 'CREATE TABLE documents (\
  //  document_id INTEGER PRIMARY KEY AUTOINCREMENT\
  //  document_name TEXT NOT NULL\
  //  \
  //  );'

  fs.access(path, fs.F_OK, (err) => {
    if (err) {
      console.log(err)
      console.log("Datbase not found.")
      console.log("Datbase will be initiated found.")
      let db = new sqlite3.Database('mydatabase.sqlite')
      //db.run(createLinkTable)
      return db
    }else{
      return db = new sqlite3.Database('mydatabase.sqlite')
    }
  })
}
