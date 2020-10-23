const { ipcRenderer, remote } = require('electron')
console.debug("pdf-viewer.js loaded")
var data

//Wait for pdfFile to be given
ipcRenderer.once('pdfFile', (event, pdfFile, pageNumber, quads) => {
  var pdfFileName = pdfFile
  console.debug("received pdfFile "+pdfFileName)
  console.debug("received pageNumber "+pageNumber)
  console.debug("received quads: "+JSON.stringify(quads))
  createPDFViewer(pdfFileName, pageNumber, quads)
});

// All functionality inside, so it starts when document finished loading
function createPDFViewer(pdfFileName, pageNumber=1, quads){
  console.debug("pdf-viewer.js creating viewer")
  const viewerElement = document.getElementById('viewer');
  WebViewer({
    path: '../public/lib',
    initialDoc: pdfFileName, //'../public/files/'+
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
      
      if(quads) {
        let highlights = []
        let pageNumbers = Object.keys(quads)
        pageNumbers.forEach(num => {
          let highlight = new Annotations.TextHighlightAnnotation();
          highlight.PageNumber=num
          highlight.Quads = quads[num]
          highlights.push(highlight)
        })
        annotManager.addAnnotation(highlights);
        annotManager.drawAnnotations(highlights);
      }

      // Message received when wanting to create a link
      ipcRenderer.on('linking-message', (event, arg) => {
        // more information on quads https://www.pdftron.com/documentation/web/guides/extraction/selected-text/
        docViewer.getTool('TextSelect').one('selectionComplete', (startQuad, allQuads) => {
          data = {
            text : docViewer.getSelectedText(),
            windowId : remote.getCurrentWindow().id,
            pdfName : pdfFileName,
            pageNumber: docViewer.getCurrentPage(),
            quads: allQuads,
            linkName: "default"
          }
          ipcRenderer.send('linking-answer', data);
        });
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

    })//PDFDocumentLoaded
  })
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
  };
  feedbackSnackbarFalse.onclick = function(){
    console.log("gotten feedback, processing")
    snackbar.className = snackbar.className.replace("show", "");
  };
  //console.log("finished feedbackToast")
  //return await result;//result;
}