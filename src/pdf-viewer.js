const { ipcRenderer, remote } = require('electron')
console.log("app.js loaded")

//Wait for pdfFile to be given
ipcRenderer.on('pdfFile', (event, pdfFile) => {
  var pdfFileName = pdfFile
  console.log("received message "+pdfFileName)
  createPDFViewer(pdfFileName)
});


function createPDFViewer(pdfFileName){
  const viewerElement = document.getElementById('viewer');
  WebViewer({
    path: '../public/lib',
    initialDoc: pdfFileName, //'../public/files/'+
  }, viewerElement).then(instance => {
    // Interact with APIs here.
    // See https://www.pdftron.com/documentation/web/guides/basic-functionality for more info/
    const docViewer = instance.docViewer;
    //Wait until the PDF finished loading
    docViewer.on('documentLoaded', () => {
      ipcRenderer.on('linking-message', (event, arg) => {
        docViewer.getTool('TextSelect').one('selectionComplete', (startQuad, allQuads) => {
          //more information on quads https://www.pdftron.com/documentation/web/guides/extraction/selected-text/
          console.log("selected + sending")
          data = {
            text : docViewer.getSelectedText(),
            windowId : remote.getCurrentWindow().id,
            pdfName : pdfFileName,
            pageNumber: docViewer.getCurrentPage(),
            quads: allQuads
          }
          ipcRenderer.send('linking-answer', data);
        });
      })
    })//PDFDocumentLoaded
  })
}//createPDFFunction

      //const displayMode = docViewer.getDisplayModeManager().getDisplayMode();
      //const pageNumber = 1;
      //const pagePoint = {x: 0,y: 0};
      //const windowPoint = displayMode.pageToWindow(pagePoint, pageNumber);
      //const originalPagePoint = displayMode.windowToPage(windowPoint, pageNumber);

/*docViewer.on('textSelected', (quads, selectedText, pageNumber) => {
  // quads will be an array of 'Quad' objects
  // text is the selected text as a string
  if (selectedText.length > 0) {
    console.log(selectedText);
  }
});*/