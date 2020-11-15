const { ipcRenderer, remote, app } = require("electron");
const path = require("path");
const appBasePath = remote.app.getAppPath();
const db = remote.getGlobal("sharedObj").db;

/**
 * Renderer gets sent the pdf file when ready
 */
ipcRenderer.once("pdfFile", (event, pdfFile, pageNumber, quads, link_id) => {
  var pdfFilePathFull = path.resolve(pdfFile);
  createPDFViewer(pdfFilePathFull, pageNumber, quads, link_id, appBasePath);
});

/**
 * Loads the pdf viewer
 * @param  {String} pdfFilePathFull Full file path of the pdf document
 * @param  {Number} pageNumber Page number to be opend
 * @param  {Object} quads Quads of text
 * @param  {Number} link_id Link ID
 * @param  {String} appBasePath base path of the application because PdfTRON Webviewer needs to be loaded
 */
function createPDFViewer(pdfFilePathFull, pageNumber = 1, quads, link_id, appBasePath) {
  var pdfFileName = path.basename(pdfFilePathFull);
  var pdfFilePath = path.dirname(pdfFilePathFull);
  console.debug("pdf-viewer.js creating viewer");
  const viewerElement = document.getElementById("viewer");
  let webviewerPath = path.resolve(
    path.join(appBasePath, "node_modules/@pdftron/webviewer/public")
  );
  WebViewer({path: webviewerPath, initialDoc: pdfFilePathFull}, viewerElement).then((instance) => {
    console.debug("pdf-viewer.js viewer ready");
    // Interact with APIs here,
    // See https://www.pdftron.com/documentation/web/guides/basic-functionality for more info/
    const { Annotations, annotManager, docViewer } = instance;
    docViewer.on("documentLoaded", () => {
      // Can take up to ~10 seconds on slow devices
      console.debug("pdf-viewer.js document ready");
      docViewer.setCurrentPage(pageNumber);
      loadAllAnchorsWithLinks(Annotations, annotManager, pdfFileName);
      pdfViewerWindow = document.getElementById("webviewer-1").contentWindow; //assuming webviewer-1 is allways there
      pdfViewerWindow.addEventListener("dblclick", function (event) {
        console.log("clicked event inside getAnnotations");
        annoList = annotManager.getAnnotationsByMouseEvent(event);
        if (annoList) {
          //implement let user choose
          annoList.forEach((annot) => {
            let link_id = "" + annot.getCustomData("link_id");
            let anchor_id = "" + annot.getCustomData("anchor_id");
            console.log("link double clicked: " + link_id + ", " + anchor_id);
            data = {
              link_id: link_id,
              anchor_id: anchor_id,
            };
            ipcRenderer.send("open-other-link", data);
          });
        }
      });

      ipcRenderer.on("focus-text", (event, arg) => {
        console.log("open page " + arg);
        docViewer.setCurrentPage(arg);
      });

      ipcRenderer.on("update-temp-links", (event, arg) => {
        let link_id = arg;
        //update all annotations without link_id with this
        annotList = annotManager.getAnnotationsList();
        annotList.forEach((x) => {
          if (x.getCustomData("tmp")) {
            x.deleteCustomData("tmp");
            x.setCustomData("linkId", link_id);
            annotManager.redrawAnnotation(x);
          }
        });
      });

      ipcRenderer.on("forward-anchor", (event) => {
        event.sender.send("forward-anchor");
      });

      ipcRenderer.on("cancel-anchor", (event, data) => {
        event.sender.send("send-anchor", data);
      });

      ipcRenderer.on("alert", (event, data) => {
        alert(data)
      });

      ipcRenderer.on("get-anchor", (event, data) => {
        let page = docViewer.getCurrentPage();
        let quads = docViewer.getSelectedTextQuads();
        let text = docViewer.getSelectedText();
        if (quads == null) {
          alert("Please select the text to be linked.");
        } else {
          anchor = {
            $doc_name: pdfFileName,
            $doc_path: pdfFilePath,
            $pdf_quads: quads,
            $pdf_page: page,
            $file_type: "pdf",
            $anchor_text: text,
            $doc_position: "", // empty, because pdf
            $last_modified: "", // empty, because pdf
          };
          if (data && data.anchor_1) {
            data.anchor_2 = anchor;
            data.windowId_2 = remote.getCurrentWindow().id;
          } else {
            data = {
              anchor_1: anchor,
              windowId_1: remote.getCurrentWindow().id,
            };
          }
          alert("'" + text + "' selected.");
          event.sender.send("send-anchor", data);
        }
      });

      ipcRenderer.on("put-link", (event, data) => {
        console.log("receiving put link: " + JSON.stringify(data));
        if (data.anchor_1.$doc_name == pdfFileName) {
          highlightQuads(Annotations, annotManager, data.anchor_1.$pdf_quads, data.link_id, data.anchor_id_1);
        }
        if (data.anchor_2.$doc_name == pdfFileName) {
          highlightQuads(Annotations, annotManager, data.anchor_2.$pdf_quads, data.link_id, data.anchor_id_2);
        }
      });
    });
  }).catch((err) => {console.log(err)});
}

/**
 * Loads all the anchors for a given pdf and creates links/highlights
 * @param  {Object} Annotations Annotations object
 * @param  {Object} annotManager Annotation Manager object
 * @param  {Object} quads quads to be highlighted
 * @param  {Number} link_id Link ID put into the annotation/link
 * @param  {Number} anchor_id Anchor ID put into the annotation/link
 */
function highlightQuads(Annotations, annotManager, quads, link_id, anchor_id) {
  let highlights = [];
  if (typeof quads == "string") quads = JSON.parse(quads);
  let pageNumbers = Object.keys(quads);
  pageNumbers.forEach((num) => {
    let highlight = new Annotations.TextHighlightAnnotation();
    highlight.PageNumber = num;
    highlight.Quads = quads[num];
    highlight.setCustomData("link_id", link_id);
    highlight.setCustomData("anchor_id", anchor_id);
    highlights.push(highlight);
  });
  annotManager.addAnnotation(highlights);
  annotManager.drawAnnotationsFromList(highlights);
}

/**
 * Loads all the anchors for a given pdf and creates links/highlights
 * @param  {Object} Annotations Annotations object
 * @param  {Object} annotManager Annotation Manager object
 * @param  {String} pdfFileName File name of the opend pdf
 */
function loadAllAnchorsWithLinks(Annotations, annotManager, pdfFileName) {
  db.getAllAnchorsForDoc(pdfFileName).then((rows) => {
    rows.forEach((row) => {
      console.log("reihe " + row);
      quads = JSON.parse(row.pdf_quads);
      highlightQuads( Annotations, annotManager, quads, row.link_id, row.anchor_id);
    })
  }).catch((err) => {console.log(err)});
}
