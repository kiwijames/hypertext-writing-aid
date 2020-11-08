const {ipcRenderer, remote, app} = require('electron');
const pfd = require('path');
console.debug("pdf-viewer.js loaded")
var data
const sqlite3 = require('sqlite3').verbose();

const appBasePath = remote.app.getAppPath()
const appUserPath = remote.app.getPath("userData")
const dbFileName = 'mydatabase.sqlite'
const fullDbPath = pfd.join(appUserPath,dbFileName)
const db = new sqlite3.Database(fullDbPath)

//Wait for pdfFile to be given
ipcRenderer.once('pdfFile', (event, pdfFile, pageNumber, quads, link_id) => {
  var pdfFilePath = pfd.resolve(pdfFile)
  



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
  let webviewerPath = pfd.resolve(pfd.join(appBasePath,'node_modules/@pdftron/webviewer/public'))
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
      if(quads) highlightQuads(Annotations, annotManager, quads, link_id)
      allAnnotationsWithLinks(Annotations, annotManager, pdfFileName)

      // Message received when wanting to create a link
      ipcRenderer.on('linking-message', (event, arg) => {
        // more information on quads https://www.pdftron.com/documentation/web/guides/extraction/selected-text/
        docViewer.getTool('TextSelect').on('selectionComplete', (startQuad, allQuads) => {
          data = {
            text : docViewer.getSelectedText(),
            windowId : remote.getCurrentWindow().id,
            pdfName : pdfFileName,
            pageNumber: docViewer.getCurrentPage(),
            quads: allQuads,
            linkName: "default"
          }
          highlightQuads(Annotations, annotManager, allQuads, null, true)
          ipcRenderer.send('linking-answer', data);
        });
      });
      
      
      pdfViewerWindow = document.getElementById('webviewer-1').contentWindow; //assuming webviewe-1 is allways there
      pdfViewerWindow.addEventListener("dblclick", function(event){
        console.log("clicked event inside getAnnotations")
        annoList = annotManager.getAnnotationsByMouseEvent(event)
        if(annoList){
          //let user choose
          annoList.forEach(annot =>{
            let linkId = annot.getCustomData('linkId')
            data = {
              linkId : linkId,
              pdfName : pdfFileName
            }
            ipcRenderer.send('openOtherLink', data);
          })
        }
      });
      

      ipcRenderer.on('linking-message', (event, arg) => {
        if(arg) if(arg.toast) toastMessage('Mark text to be linked');
      });

      ipcRenderer.on('firstLinkSaved', (event, arg) => {
        if(arg.toast) toastMessage('Mark the next text to be linked together');
      });
      ipcRenderer.on('secondLinkReceived', (event, arg) => {
        if(arg.toast)  toastMessageFeedback('Do you want to save the linking?')
      });

      ipcRenderer.on('focusText', (event, arg) => {
        console.log("open page "+arg)
        docViewer.setCurrentPage(arg)
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



function highlightQuads(Annotations, annotManager, quads, link_id, tmpFlag) {
  let highlights = []
  let pageNumbers = Object.keys(quads)
  let lenth = Object.keys(quads).length
  pageNumbers.forEach(num => {
    let highlight = new Annotations.TextHighlightAnnotation();
    highlight.PageNumber=num
    highlight.Quads = quads[num]
    if(!tmpFlag) highlight.setCustomData('linkId', link_id)
    else highlight.setCustomData('tmp', true)
    highlights.push(highlight)
  })
  annotManager.addAnnotation(highlights);
  annotManager.drawAnnotationsFromList(highlights);
}



function toastMessage(message) {
  let snackbar = document.getElementById("snackbar");
  snackbar.innerHTML = message;
  snackbar.className = "show";
  setTimeout(function(){ snackbar.className = snackbar.className.replace("show", ""); }, 3000);
}

function toastMessageFeedback(message) {
  console.log("started toastMessageFeedback")
  let snackbar = document.getElementById("feedbackSnackbar");
  let snackbarQuestion = document.getElementById("feedbackSnackbarQuestion");
  let feedbackSnackbarForm = document.getElementById("feedbackSnackbarForm");
  let feedbackSnackbarTrue = document.getElementById("feedbackSnackbarTrue");
  let feedbackSnackbarFalse = document.getElementById("feedbackSnackbarFalse");
  let feedbackSnackbarText = document.getElementById("feedbackSnackbarText");
  snackbarQuestion.innerHTML = message;
  snackbar.className = "show";
  //snackbar.className = snackbar.className.replace("show", "");

  
  console.log("waiting for input feedback")
  feedbackSnackbarTrue.onclick = function(){
    console.log("gotten feedback, processing")
    snackbar.className = snackbar.className.replace("show", "");
    data.linkName = feedbackSnackbarText.value
    ipcRenderer.send('save-link', data);
    //send message from main to add links to tmp highlights
  };
  feedbackSnackbarFalse.onclick = function(){
    console.log("gotten feedback, processing")
    snackbar.className = snackbar.className.replace("show", "");
    //send message from main to remove tmp highlights
  };
  //console.log("finished feedbackToast")
  //return await result;//result;
}

//write all annotations from the database into the pdf
function allAnnotationsWithLinks(Annotations, annotManager, pdfFileName){
  let selectStatement = "SELECT * from links WHERE document_name_1 LIKE '"+pdfFileName+"' OR document_data_2 LIKE '"+pdfFileName+"'";
  //let db = new sqlite3.Database('mydatabase.sqlite')
  db.all(selectStatement, function(err,rows){
    if(err){
      console.error("problem getting link")
      console.error(err)
    }else{
      console.log("now print rows")
      rows.forEach((row) => {
        console.log("reihe "+row)
        quads1 = JSON.parse(row.document_quads_1)
        quads2 = JSON.parse(row.document_quads_2)
        if(row.document_name_1 == pdfFileName){
          highlightQuads(Annotations, annotManager, quads1, row.link_id)
        }
        if(row.document_name_2 == pdfFileName){
          highlightQuads(Annotations, annotManager, quads2, row.link_id)
        }
      })
    }
  })
}
