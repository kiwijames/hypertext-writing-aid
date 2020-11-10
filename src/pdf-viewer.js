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
  var pdfFilePath = path.resolve(pdfFile)

  // putting vars into debug log
    console.debug("baseBath: "+appBasePath)
    console.debug("linkid: "+link_id)
    console.debug("received pdfFile "+pdfFilePath)
    console.debug("received pageNumber "+pageNumber)
    console.debug("received quads: "+JSON.stringify(quads))
  createPDFViewer(pdfFilePath, pageNumber, quads, link_id, appBasePath)
});

// All functionality inside, so it starts when document finished loading
function createPDFViewer(pdfFileName, pageNumber=1, quads, link_id, appBasePath){
  console.debug("pdf-viewer.js creating viewer")
  const viewerElement = document.getElementById('viewer');
  let webviewerPath = path.resolve(path.join(appBasePath,'node_modules/@pdftron/webviewer/public'))
  WebViewer({
    path: webviewerPath,
    initialDoc: pdfFileName,
  }, viewerElement).then(instance => {
    console.debug("pdf-viewer.js viewer ready")
    // Interact with APIs here.
    // See https://www.pdftron.com/documentation/web/guides/basic-functionality for more info/
    const { Annotations, annotManager, docViewer } = instance;
    // wait until the PDF finished loading
    docViewer.on('documentLoaded', () => {
      // ~10 Sekunden bis hier hin vom window start
      console.debug("pdf-viewer.js document ready")
      // Viewer properties
      docViewer.setCurrentPage(pageNumber)
      //docViewer.setFitMode("FitWidth") //not a function..?

      // Highlight link if given
      //if(quads) highlightQuads(Annotations, annotManager, quads, link_id)
      loadAllAnchorsWithLinks(Annotations, annotManager, pdfFileName)
      // TODO: allEditorAnnotationsWithLinks(Annotations, annotManager, pdfFileName)

      pdfViewerWindow = document.getElementById('webviewer-1').contentWindow; //assuming webviewe-1 is allways there
      pdfViewerWindow.addEventListener("dblclick", function(event){
        console.log("clicked event inside getAnnotations")
        annoList = annotManager.getAnnotationsByMouseEvent(event)
        if(annoList){
          //let user choose
          annoList.forEach(annot =>{
            //check if i is in linkId
            let linkId = ""+annot.getCustomData('linkId')
            console.log("link id double clicked: "+linkId)
            if(linkId.includes("i")){
              //internal link
              console.log("internal link")
              linkId = linkId.replace('i','')
              ipcRenderer.send('openInternalLink', linkId);
            } else if(linkId.includes("e")){
              //internal link
              console.log("editor link")
              linkId = linkId.replace('e','')
              ipcRenderer.send('openEditorLink', linkId);
            }else{
              data = {
                linkId : linkId,
                pdfName : pdfFileName
              }
              ipcRenderer.send('openOtherLink', data);
            }
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
            $doc_path : pdfFileName,
            $pdf_quads : quads,
            $pdf_page: page,
            $file_type: "pdf",
            $anchor_text : text,
            $doc_position : null,
            //windowId : remote.getCurrentWindow().id
          }
          alert("sth. selcted, next selection")
          //TODO highlightQuads(Annotations, annotManager, allQuads, null, true)
          let anchors = []
          anchors[0] = anchor
          ipcRenderer.send('pdf-link-step2', anchors);
        }
      });

      ipcRenderer.on('pdf-link-step3', (event, arg) => {
        anchors = arg
        ipcRenderer.on('pdf-link-step4', (event) => {
          // more information on quads https://www.pdftron.com/documentation/web/guides/extraction/selected-text/
          let page = docViewer.getCurrentPage();
          let quads = docViewer.getSelectedTextQuads();
          let text = docViewer.getSelectedText();
          if(quads==null){
            alert("Please select the text to link.")
          } else{
            anchor = {
              $doc_name : pdfFileName,
              $doc_path : pdfFileName,
              $pdf_quads : quads,
              $pdf_page: page,
              $file_type: "pdf",
              $anchor_text : text,
              $doc_position : null,
              //windowId : remote.getCurrentWindow().id
            }
            alert("sth. selcted, saving link")
            anchors[1] = anchor
            //TODO highlightQuads(Annotations, annotManager, allQuads, null, true)
            ipcRenderer.send('pdf-link-step5', anchors);
          }
        });
      });

      ipcRenderer.on('internal-link-step1', (event, arg) => {
        //arg should be empty
        
        let page = docViewer.getCurrentPage();
        let quads = docViewer.getSelectedTextQuads();
        let text = docViewer.getSelectedText();
        if(quads==null){
          alert("Please select the text to link.")
        } else{
          data = {
            text : text,
            windowId : remote.getCurrentWindow().id,
            pdfName : pdfFileName,
            pageNumber: page,
            quads: quads,
            linkName: "default"
          }
          alert("sth. selcted")
          ipcRenderer.send('internal-link-step2', data);
        }
      });

      ipcRenderer.on('internal-link-step7', (event, arg) => {
        //arg = {
        //  quads: data.pdf_quads,
        //  internalLinkId: lastLinkId,
        //  editorWindowId: editorWindowId
        //}
        console.log(arg)
        console.log("linkid "+arg.editorWindowId)
        linkid="e"+arg.editorWindowId
        // put arg into annotation
        //TODOhighlightQuads(Annotations, annotManager,arg.quads,linkid,false)

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
    console.log("rows: "+rows)
    //console.log("number of rows: "+rows.length())
    rows.forEach((row) => {
      console.log("reihe "+row)
      quads = JSON.parse(row.pdf_quads)
      highlightQuads(Annotations, annotManager, quads, row.link_id, row.anchor_id)
    })
  })
}

// same for links to editor files
// internal links to editor
function allEditorAnnotationsWithLinks(Annotations, annotManager, pdfFileName){
  /*let selectStatement = "SELECT * from internallinks WHERE pdf_name LIKE '"+pdfFileName+"'";
  //let db = new sqlite3.Database('mydatabase.sqlite')
  db.all(selectStatement, function(err,rows){
    if(err){
      console.error("problem getting link")
      console.error(err)
    }else{
      console.log("now print rows")
      rows.forEach((row) => {
        console.log("reihe "+row)
        quads = JSON.parse(row.pdf_quads)
        linkId = "i"+row.link_id
        highlightQuads(Annotations, annotManager, quads, linkId)
      })
    }
  })*/
}