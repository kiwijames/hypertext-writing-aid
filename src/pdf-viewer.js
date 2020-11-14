const {ipcRenderer, remote, app} = require('electron');
const path = require('path');
console.debug("pdf-viewer.js loaded")
var data
const sqlite3 = require('sqlite3').verbose();
const Database = require('./database.js')

const appBasePath = remote.app.getAppPath()
const appUserPath = remote.app.getPath("userData")
const dbFileName = 'mydatabase.sqlite'
const fullDbPath = path.join(appUserPath,dbFileName)
//const db = new sqlite3.Database(fullDbPath)
var db = remote.getGlobal('sharedObj').db

//Wait for pdfFile to be given
ipcRenderer.once('pdfFile', (event, pdfFile, pageNumber, quads, link_id) => {
  var pdfFilePathFull = path.resolve(pdfFile)

  // putting vars into debug log
    console.debug("baseBath: "+appBasePath)
    console.debug("linkid: "+link_id)
    console.debug("received pdfFile "+pdfFilePathFull)
    console.debug("received pageNumber "+pageNumber)
    console.debug("received quads: "+JSON.stringify(quads))
  createPDFViewer(pdfFilePathFull, pageNumber, quads, link_id, appBasePath)
});

// All functionality inside, so it starts when document finished loading
function createPDFViewer(pdfFilePathFull, pageNumber=1, quads, link_id, appBasePath){
  var pdfFileName = path.basename(pdfFilePathFull)
  var pdfFilePath = path.dirname(pdfFilePathFull)
  console.debug("pdf-viewer.js creating viewer")
  const viewerElement = document.getElementById('viewer');
  let webviewerPath = path.resolve(path.join(appBasePath,'node_modules/@pdftron/webviewer/public'))
  WebViewer({
    path: webviewerPath,
    initialDoc: pdfFilePathFull,
  }, viewerElement).then(instance => {
    console.debug("pdf-viewer.js viewer ready")
    // Interact with APIs here.
    // See https://www.pdftron.com/documentation/web/guides/basic-functionality for more info/
    const { Annotations, annotManager, docViewer } = instance;
    // wait until the PDF finished loading
    docViewer.on('documentLoaded', () => {
      // ~10 Sekunden bis hier hin vom window start; scheint wohl an pdf und rechner speed zu liegen
      console.debug("pdf-viewer.js document ready")
      // Viewer properties
      docViewer.setCurrentPage(pageNumber)
      //docViewer.setFitMode("FitWidth") //not a function..?

      loadAllAnchorsWithLinks(Annotations, annotManager, pdfFileName)

      pdfViewerWindow = document.getElementById('webviewer-1').contentWindow; //assuming webviewer-1 is allways there
      pdfViewerWindow.addEventListener("dblclick", function(event){
        console.log("clicked event inside getAnnotations")
        annoList = annotManager.getAnnotationsByMouseEvent(event)
        if(annoList){
          //implement let user choose
          annoList.forEach(annot =>{
            //check if i is in linkId
            let link_id = ""+annot.getCustomData('link_id')
            let anchor_id = ""+annot.getCustomData('anchor_id')
            console.log("link double clicked: "+link_id+", "+anchor_id)
              data = {
                link_id : link_id,
                anchor_id : anchor_id
              }
              ipcRenderer.send('openOtherLink', data);
            })
          }
        });

      ipcRenderer.on('focusText', (event, arg) => {
        console.log("open page "+arg)
        docViewer.setCurrentPage(arg)
      });

      ipcRenderer.on('pdf-link-step1', (event, arg) => {
        // more information on quads https://www.pdftron.com/documentation/web/guides/extraction/selected-text/
        let page = docViewer.getCurrentPage();
        let quads = docViewer.getSelectedTextQuads();
        let text = docViewer.getSelectedText();
        if(quads==null){
          alert("Please select the text to link.")
        } else{
          anchor = {
            $doc_name : pdfFileName,
            $doc_path : pdfFilePath,
            $pdf_quads : quads,
            $pdf_page: page,
            $file_type: "pdf",
            $anchor_text : text,
            $doc_position : "",
            $last_modified : "", // doesnt matter, because pdf
          }
          data = {
            anchor_1 : anchor,
            windowId_1 : remote.getCurrentWindow().id
          }
          alert("sth. selcted, next selection")
          //TODO highlightQuads(Annotations, annotManager, allQuads, null, true)

          ipcRenderer.send('pdf-link-step2', data);
        }
      });

      ipcRenderer.on('pdf-link-step3', (event, data) => {
        anchors = data
        ipcRenderer.on('pdf-link-step4', (event, arg) => {
          if(arg) return
          // more information on quads https://www.pdftron.com/documentation/web/guides/extraction/selected-text/
          let page = docViewer.getCurrentPage();
          let quads = docViewer.getSelectedTextQuads();
          let text = docViewer.getSelectedText();
          if(quads==null){
            alert("Please select the text to link.")
          } else{
            anchor = {
              $doc_name : pdfFileName,
              $doc_path : pdfFilePath,
              $pdf_quads : quads,
              $pdf_page: page,
              $file_type: "pdf",
              $anchor_text : text,
              $doc_position : "",
              $last_modified : "", // doesnt matter, because pdf
            }
            anchors.anchor_2 = anchor
            anchors.windowId_2 = remote.getCurrentWindow().id
            alert("sth. selcted, saving link")
            ipcRenderer.send('pdf-link-step5', anchors);
          }
        });
      });

      ipcRenderer.on('pdf-link-step6', (event, data) => {
        console.log("data: "+JSON.stringify(data))
        highlightQuads(Annotations,annotManager,data.anchor_1.$pdf_quads,data.link_id,data.anchor_id_2,false)
      })
      ipcRenderer.on('pdf-link-step7', (event, data) => { 
        console.log("data: "+JSON.stringify(data))
        highlightQuads(Annotations,annotManager,data.anchor_2.$pdf_quads,data.link_id,data.anchor_id_1,false)
      })

      ipcRenderer.on('internal-link-step1', (event, arg) => {        
        let page = docViewer.getCurrentPage();
        let quads = docViewer.getSelectedTextQuads();
        let text = docViewer.getSelectedText();
        if(quads==null){
          alert("Please select the text to link.")
        } else{
          anchor = {
            $doc_name : pdfFileName,
            $doc_path : pdfFilePath,
            $pdf_quads : quads,
            $pdf_page: page,
            $file_type: "pdf",
            $anchor_text : text,
            $doc_position : "", // empty, because pdf
            $last_modified : "", // empty matter, because pdf
          }
          data = {
            anchor_1: anchor,
            windowId_1: remote.getCurrentWindow().id
          }
          alert("sth. selcted")
          ipcRenderer.send('internal-link-step2', data);
        }
      });

      ipcRenderer.on('internal-link-step7', (event, data) => {
        console.log("internal-link-step7, received saved link "+JSON.stringify(data))
        highlightQuads(Annotations, annotManager,data.anchor_1.$pdf_quads,data.link_id,data.anchor_id_1,false)
      });

      ipcRenderer.on('updateTempLinks', (event, arg) => {
        let link_id = arg
        //update all annotations without link_id with this
        annotList = annotManager.getAnnotationsList()
        annotList.forEach(x => {
          if(x.getCustomData('tmp')){
            x.deleteCustomData('tmp')
            x.setCustomData('linkId',link_id)
            annotManager.redrawAnnotation(x);
          }
        });
      });
      

    })//PDFDocumentLoaded
  })
}



function highlightQuads(Annotations, annotManager, quads, link_id, anchor_id, tmpFlag) {
  let highlights = []
  if(typeof(quads) == "string") quads = JSON.parse(quads)
  let pageNumbers = Object.keys(quads)
  
  pageNumbers.forEach( num => {
    let highlight = new Annotations.TextHighlightAnnotation();
    highlight.PageNumber=num
    highlight.Quads = quads[num]
    if(!tmpFlag) {
      highlight.setCustomData('link_id', link_id)
      highlight.setCustomData('anchor_id', anchor_id)
    }
    else highlight.setCustomData('tmp', true)
    highlights.push(highlight)
  })
  annotManager.addAnnotation(highlights);
  annotManager.drawAnnotationsFromList(highlights);
}



//write all annotations from the database into the pdf,  only pdf to pdf 
function loadAllAnchorsWithLinks(Annotations, annotManager, pdfFileName){
  db.getAllAnchorsForDoc(pdfFileName).then((rows) => { //ONLY THE DOCUMENT NAME //HOW TO CHECK FOR ERRORS?
    //if(rows) return console.debug("there might be a problem here")
    console.log("pdfFileName: "+pdfFileName)
    console.log("rows: "+JSON.stringify(rows))
    //console.log("number of rows: "+rows.length())
    rows.forEach((row) => {
      console.log("reihe "+row)
      quads = JSON.parse(row.pdf_quads)
      highlightQuads(Annotations, annotManager, quads, row.link_id, row.anchor_id)
    })
  })
}