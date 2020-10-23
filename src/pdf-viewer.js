const { ipcRenderer, remote } = require('electron')
console.log("pdf-viewer.js loaded")
var data

//Wait for pdfFile to be given
ipcRenderer.once('pdfFile', (event, pdfFile, pageNumber, quads) => {
  var pdfFileName = pdfFile
  console.log("received message "+pdfFileName)
  console.log("received quads: "+JSON.stringify(quads["5"]))
  console.log("received quads: "+quads["5"])
  //console.log("received quads: "+quads.getString("5"))
  console.log("received quads: "+quads["5"])
  createPDFViewer(pdfFileName, pageNumber, quads)
});

// All functionality inside, so it starts when document finished loading
function createPDFViewer(pdfFileName, pageNumber=1, quads){
  console.log("pdf-viewer.js creating viewer")
  const viewerElement = document.getElementById('viewer');
  WebViewer({
    path: '../public/lib',
    initialDoc: pdfFileName, //'../public/files/'+
  }, viewerElement).then(instance => {
    console.log("pdf-viewer.js viewer ready")
    // Interact with APIs here.
    // See https://www.pdftron.com/documentation/web/guides/basic-functionality for more info/
    const { Annotations, annotManager, docViewer } = instance;
    // wait until the PDF finished loading
    docViewer.on('documentLoaded', () => {
      docViewer.setCurrentPage(pageNumber)
      //docViewer.setFitMode("FitWidth")
      console.log("before quads")
      if(quads) {
        console.log("quads: "+JSON.stringify(quads))
        const highlight = new Annotations.TextHighlightAnnotation();
        highlight.StrokeColor = new Annotations.Color(255, 255, 0);
        highlight.PageNumber = 5;
        highlight.Quads = quads["5"];
        annotManager.addAnnotation(highlight);
        annotManager.drawAnnotations(highlight);
      }
      // ~10 Sekunden bis hier hin vom window start
      console.log("pdf-viewer.js document ready")
      // I want to create a link
      ipcRenderer.on('linking-message', (event, arg) => {
        // next slected text will be linked
        docViewer.getTool('TextSelect').one('selectionComplete', (startQuad, allQuads) => {
          // more information on quads https://www.pdftron.com/documentation/web/guides/extraction/selected-text/
          console.log("selected + sending")
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
        if(arg) {
          if(arg.toast) toastMessage('Mark text to be linked');
        }
      });

      ipcRenderer.on('link1', (event, arg) => {
        if(arg.toast) {
          toastMessage('Mark the next text to be linked together');
        }
      });
      ipcRenderer.on('link2', (event, arg) => {
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
    console.log("text value: "+feedbackSnackbarText.value)
    console.log("text value: "+data.linkName)
    console.log("page number: "+data.pageNumber)
    ipcRenderer.send('save-link', data);
  };
  feedbackSnackbarFalse.onclick = function(){
    console.log("gotten feedback, processing")
    snackbar.className = snackbar.className.replace("show", "");
    
  };
  //console.log("finished feedbackToast")
  //return await result;//result;
}