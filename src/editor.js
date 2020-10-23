const { ipcRenderer } = require('electron');
const fs = require('fs')

ipcRenderer.on('saveTextAsHTML', (event, data) => {
    let filepath = data + ".html"
    let content = document.getElementById('textBox').innerHTML
    fs.writeFile(filepath, content, (err) => {
        if (err) {
            alert("An error ocurred updating the file" + err.message);
            console.log(err);
            return;
        }
        alert("The file has been succesfully saved");
    });
});

ipcRenderer.on('loadText', (event, data) => {
    let filepath = data;
    fs.readFile(filepath,'utf-8',(err,data) => {
        if (err) {
            alert("An error ocurred updating the file" + err.message);
            console.log(err);
            return;
        }
        document.getElementById('textBox').innerHTML = data
    });
});

document.addEventListener('DOMContentLoaded', function() {
    //let linkNameString = document.getElementById('link-name');
    let addLocalLinkButton = document.getElementById('addLocalLink');



    addLocalLinkButton.onclick = function(){
        let textBox = document.getElementById('textBox')
        let selectedText = window.getSelection()
        let newTextElement = document.createElement('a');
        newTextElement.appendChild(document.createTextNode(selectedText));
        //let newText = '<a href="_blank">'+selectedText+'</a>'
        if (textBox.innerText.includes(selectedText)) {

            //Text selected, now which link to be linked?
            console.log("start requireLinkId")
            ipcRenderer.send('requireLinkId');
            console.log("message sent, waiting?")
            
            ipcRenderer.on('returnLinkId', (event, data) => {
                linkingFunction = "callLinkedLinks("+data+");"
                newTextElement.setAttribute('href',"#")
                newTextElement.setAttribute('onclick',linkingFunction)
                
                console.log("end!")
                console.log(linkingFunction)
                if (selectedText.rangeCount) {
                    let range = selectedText.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(newTextElement);
                }
            });
        }      
    }

    // Aktuell: jeder link click führt den onclick event durch, könnte aber deaktiviert werden
    // mit hover + strg wie ein link aussehen lassen, sonst keine funktion haben
    // window.addEventListener("keydown", function(event) {
    //     // Bind to both command (for Mac) and control (for Win/Linux)
    //     if (event.ctrlKey) {
    //         anchorList = document.getElementsByTagName('a')
    //         console.log("content false")
    //         anchorList.array.foreach(anchor => {
    //             console.log("false")
    //             anchor.setAttribute('contenteditable','false')
    //         })
    //     }
    // }, false);
    // window.addEventListener("keyup", function(event) {
    //     // Bind to both command (for Mac) and control (for Win/Linux)
    //     if (event.ctrlKey) {
    //         anchorList = document.getElementsByTagName('a')
    //         console.log("content true")
    //         anchorList.array.foreach(anchor => {
    //             console.log("true")
    //             anchor.setAttribute('contenteditable','true')
    //         })
    //     }
    // }, false);
})


function callLinkedLinks(linkID){
    ipcRenderer.send('call-linked-links',linkID);
}

