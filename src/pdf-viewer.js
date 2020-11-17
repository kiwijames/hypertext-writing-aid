/**
 * PDF Viewer with linking supported by PDFTron Webviewer for the Hypertext Writing aid application.
 *
 * @file   PDF Edtior
 * @author Kevin Taylor
 */

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

      instance.setAnnotationContentOverlayHandler(annotation => {
        const div = document.createElement('div');
        if(annotation.doc == pdfFileName) div.appendChild(document.createTextNode('Same document'));
        else div.appendChild(document.createTextNode(`Linking to  ${annotation.doc}`));
        div.appendChild(document.createElement('br'));
        if(annotation.page) div.appendChild(document.createTextNode(` on page ${annotation.page}`));
        div.appendChild(document.createElement('br'));
        div.appendChild(document.createElement('br'));
        div.appendChild(document.createTextNode(`[...] ${annotation.text} [...]`));
        return div;
    });


      /////////////////////// Electron event handeling ///////////////////////

      ipcRenderer.on("forward-anchor", (event, data) => {
        event.sender.send("forward-anchor", data);
      });

      ipcRenderer.on("cancel-anchor", (event, data) => {
        event.sender.send("send-anchor", data);
      });

      ipcRenderer.on("alert", (event, data) => {
        alert(data)
      });

      ipcRenderer.on("focus-page", (event, data) => {
        docViewer.setCurrentPage(data);
      });

      ipcRenderer.on("remove-link", (event, data) => {
        link_id = data
        let annots = annotManager.getAnnotationsList();
        let annotsToDelete = []
        annots.forEach( annot => {
            if(annot.getCustomData("link_id")==link_id) annotsToDelete.push(annot)
        })
        annotManager.deleteAnnotations(annotsToDelete);
        //loadAllAnchorsWithLinks(Annotations, annotManager, pdfFileName)
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
          highlightQuads(Annotations, annotManager, data.anchor_1.$pdf_quads, data.link_id, data.anchor_id_1, data.anchor_2.$doc_name, data.anchor_2.$anchor_text, data.anchor_1.$pdf_page);
        }
        if (data.anchor_2.$doc_name == pdfFileName) {
          highlightQuads(Annotations, annotManager, data.anchor_2.$pdf_quads, data.link_id, data.anchor_id_2, data.anchor_1.$doc_name, data.anchor_1.$anchor_text, data.anchor_1.$pdf_page);
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
 * @param  {String} other_doc Name of the document that is linked to
 * @param  {String} other_text Text of the anchor that is linked to
 */
function highlightQuads(Annotations, annotManager, quads, link_id, anchor_id, other_doc, other_text, other_page) {
  let highlights = [];
  if (typeof quads == "string") quads = JSON.parse(quads);
  let pageNumbers = Object.keys(quads);
  pageNumbers.forEach((num) => {
    let highlight = new Annotations.TextHighlightAnnotation();
    highlight.StrokeColor = new Annotations.Color(185, 209, 248);
    highlight.PageNumber = num;
    highlight.Quads = quads[num];
    highlight.setCustomData("link_id", link_id);
    highlight.setCustomData("anchor_id", anchor_id);
    highlight.doc = other_doc;
    highlight.text = other_text;
    highlight.page = other_page;
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
      db.getOtherAnchorData(row.link_id, row.anchor_id).then((other_rows) => {
        quads = JSON.parse(row.pdf_quads);
        highlightQuads( Annotations, annotManager, quads, row.link_id, row.anchor_id, other_rows.doc_name, other_rows.anchor_text, other_rows.pdf_page);

      })
    })
  }).catch((err) => {console.log(err)});
}
