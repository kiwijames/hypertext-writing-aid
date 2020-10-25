const { ipcRenderer, remote } = require('electron')
console.debug("pdf-viewer.js loaded")
var data

//Wait for pdfFile to be given
ipcRenderer.once('pdfFile', (event, pdfFile, pageNumber, quads, link_id) => {
  var pdfFileName = pdfFile
  console.log("linkid: "+link_id)
  console.debug("received pdfFile "+pdfFileName)
  console.debug("received pageNumber "+pageNumber)
  console.debug("received quads: "+JSON.stringify(quads))
  createPDFViewer(pdfFileName, pageNumber, quads, link_id)
});

// All functionality inside, so it starts when document finished loading
function createPDFViewer(pdfFileName, pageNumber=1, quads, link_id){
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

      // Highlight links if given
      if(quads) highlightQuads(Annotations, annotManager, quads, link_id)
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
          highlightQuads(Annotations, annotManager, allQuads)
          ipcRenderer.send('linking-answer', data);
        });
      });

      annotManager.on('annotationDoubleClicked', (annot) => {
        let linkId = annot.getCustomData('linkId')
        data = {
          linkId : linkId,
          pdfName : pdfFileName
        }
        ipcRenderer.send('openOtherLink', data);
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



function highlightQuads(Annotations, annotManager, quads, link_id) {
  let highlights = []
  let pageNumbers = Object.keys(quads)
  let lenth = Object.keys(quads).length
  pageNumbers.forEach(num => {
    let highlight = new Annotations.TextHighlightAnnotation();
    highlight.PageNumber=num
    highlight.Quads = quads[num]
    highlight.setCustomData('linkId', link_id)
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
  };
  feedbackSnackbarFalse.onclick = function(){
    console.log("gotten feedback, processing")
    snackbar.className = snackbar.className.replace("show", "");
  };
  //console.log("finished feedbackToast")
  //return await result;//result;
}