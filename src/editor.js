const { ipcRenderer } = require('electron');
const fs = require('fs')

var docData1
var docName1
var docData2
var docName2

ipcRenderer.on('link1', (event, data) => {
    console.log("received message "+data)
    docName1 = data.pdfName
    docData1 = data
    document.getElementById('document-1-data').value = data.text
    document.getElementById('document-1-name').value = data.pdfName
});

ipcRenderer.on('link2', (event, data) => {
    console.log("received message "+data)
    docName2 = data.pdfName
    docData2 = data
    document.getElementById('document-2-data').value = data.text
    document.getElementById('document-2-name').value = data.pdfName
});

/*ipcRenderer.on('table-data', (event, data) => {
    document.getElementById('database-textarea').value = data
});*/

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
    let cancelButton = document.getElementById('cancelLink');
    let saveButton = document.getElementById('saveLink');
    let linkNameString = document.getElementById('link-name');
    let addLocalLinkButton = document.getElementById('addLocalLink');

    //Remove all content of the fields
    cancelButton.onclick = function(){
        document.getElementById('document-1-data').value = ""
        document.getElementById('document-1-name').value = ""
        document.getElementById('document-2-data').value = ""
        document.getElementById('document-2-name').value = ""
        document.getElementById('link-name').value= ""
        docName2=""
        docName1=""
    }

    //save link if all fields filled
    saveButton.onclick = function(){
        console.log(linkNameString.value)
        if(linkNameString.value.length>0){//} && docName1.length>0 && docName2.length>0){
            data = {
                linkName: linkNameString.value,
                docData1: docData1,
                docData2: docData2,
                docName1: docName1,
                docName2: docName2
            }
            ipcRenderer.send('save-link', data);
        }
    }

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
                newTextElement.setAttribute('href',data)
                console.log("end!")
                console.log(data)
                if (selectedText.rangeCount) {
                    let range = selectedText.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(newTextElement);
                }
            });
        }      
    }
})
