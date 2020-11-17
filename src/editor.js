const { ipcRenderer, remote } = require("electron");
const fs = require("fs");
const path = require('path');
const db = remote.getGlobal("sharedObj").db;


ipcRenderer.on("saveTextAsHTML", (event, data) => {
  let filepath = data + ".html"
  let content = document.getElementById("textBox").innerHTML;
  let anchors = Array.from(document.getElementById("textBox").getElementsByTagName("a"));
  let linkList = [];
  console.log("anchors" + JSON.stringify(anchors));
  anchors.forEach((x) => {
    onclickfuntion = x.getAttribute("onclick");
    if (onclickfuntion.includes("callinternalLink")) {
      link = {
        link_id: onclickfuntion.split("(")[1].split(",")[0],
        anchor_id: onclickfuntion.split(",")[1].split(")")[0].trim(),
      };
    }
    linkList.push(link);
  });
  console.log("linkList" + JSON.stringify(linkList));

  fs.writeFile(filepath, content, (err) => {
    if (err) {
      alert("An error ocurred writing the file" + err.message);
      console.log(err);
    } else {
      var mtime = fs.statSync(filepath).mtime.toString();
      newData = {
        full_file_path: data,
        link_list: linkList,
        last_modified: mtime,
      };
      console.log(
        "saving document with all this data: " + JSON.stringify(newData)
      );
      ipcRenderer.send("saveTextAsHTML-step2", newData);
      alert("The file has been succesfully saved");
    }
  });
});

ipcRenderer.on("loadText", (event, data) => {
  let file_path = data;
  fs.readFile(file_path, "utf-8", (err, data) => {
    if (err) {
      alert("An error ocurred updating the file" + err.message);
      console.log(err);
      return;
    }
    deletedAnchors = []
    db.getAllAnchorsForDoc(path.basename(file_path)).then( (anchors) => {
      let anchorIds = anchors.map(anchor => anchor.anchor_id)
      document.getElementById("textBox").innerHTML = data;
      anchors = Array.from(document.getElementById("textBox").getElementsByTagName("a"))
      anchors.forEach( (a) => {
        onclickfuntion = a.getAttribute("onclick");
        if (onclickfuntion.includes("callinternalLink") && 
              anchorIds.includes(onclickfuntion.split(",")[1].split(")")[0])) {
          a.outerHTML = a.innerHTML
        }
      })
      
    })

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

ipcRenderer.on("remove-link", (event, data) => {
  let anchors = Array.from(document.getElementById("textBox").getElementsByTagName("a"))
  anchors.forEach( (a) => {
    onclickfuntion = a.getAttribute("onclick");
    if (onclickfuntion.includes("callinternalLink")) {
      a.outerHTML = a.innerHTML
    }
  })
});

ipcRenderer.on("get-anchor", (event, data) => {
  let textBox = document.getElementById("textBox");
  let text = window.getSelection();
  let newTextElement = document.createElement("a");
  newTextElement.appendChild(document.createTextNode(text));
  newTextElement.setAttribute("href", "#");

  if (!textBox.innerText.includes(text) && text.rangeCount) {
    alert("Please select the text to be linked.");
  } else {
    anchor = {
      $doc_name: "tbd",
      $doc_path: "tbd",
      $pdf_quads: "",
      $pdf_page: "",
      $file_type: "text",
      $anchor_text: "" + text, //as string
      $doc_position: "",
      $last_modified: "tbd",
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
    ipcRenderer.send("send-anchor", data);

    ipcRenderer.once("put-link", (event, data) => {
      if (data.windowId_1 == remote.getCurrentWindow().id) {
        linkingFunction = "callinternalLink(" + data.link_id + ", " + data.anchor_id_1 + ");";
        newTextElement.setAttribute("onclick", linkingFunction);
        let range = text.getRangeAt(0);
        range.deleteContents();
        range.insertNode(newTextElement);
      }
      if (data.windowId_2 == remote.getCurrentWindow().id) {
        linkingFunction = "callinternalLink(" + data.link_id + ", " + data.anchor_id_2 + ");";
        newTextElement.setAttribute("onclick", linkingFunction);
        let range = text.getRangeAt(0);
        range.deleteContents();
        range.insertNode(newTextElement);
      }
    });
  }
});

/**
 * Needs to be put into the editor.html file! It is activated as onclick-Event of the links
 * @param  {Number} link_id Link ID
 * @param  {Number} anchor_id Anchor ID
 */
function callinternalLink(link_id, anchor_id) {
  data = {
    link_id: link_id,
    link_id: anchor_id,
  };
  ipcRenderer.send("open-other-link", data);
}

