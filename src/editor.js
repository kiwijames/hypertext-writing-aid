const { ipcRenderer, remote } = require("electron");
const fs = require("fs");


ipcRenderer.on("saveTextAsHTML", (event, data) => {
  var filepath = data; // + ".html"
  let content = document.getElementById("textBox").innerHTML;
  let anchors = Array.from(
    document.getElementById("textBox").getElementsByTagName("a")
  );
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
        filePathFull: data,
        linkList: linkList,
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
  let filepath = data;
  fs.readFile(filepath, "utf-8", (err, data) => {
    if (err) {
      alert("An error ocurred updating the file" + err.message);
      console.log(err);
      return;
    }
    document.getElementById("textBox").innerHTML = data;
  });
});

ipcRenderer.on("forward-anchor", (event) => {
  event.sender.send("forward-anchor");
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
      $pdf_quads: null,
      $pdf_page: null,
      $file_type: "text",
      $anchor_text: "" + text,
      $doc_position: "tbd",
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

    ipcRenderer.on("put-link", (event, data) => {
      if (data.anchor_1.$file_type == "text") {
        linkingFunction =
          "callinternalLink(" + data.link_id + ", " + data.anchor_id_1 + ");";
        newTextElement.setAttribute("onclick", linkingFunction);
        let range = text.getRangeAt(0);
        range.deleteContents();
        range.insertNode(newTextElement);
      }
      if ((data.anchor_2.$file_type = "text")) {
        linkingFunction =
          "callinternalLink(" + data.link_id + ", " + data.anchor_id_2 + ");";
        newTextElement.setAttribute("onclick", linkingFunction);
        let range = text.getRangeAt(0);
        range.deleteContents();
        range.insertNode(newTextElement);
      }
    });
  }
});

/**
 * Needs to be put into the editor.html file. It is activated as onclick-Event of the links
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
