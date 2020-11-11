const { ipcRenderer, remote, dialog, ipcMain } = require('electron');
const fs = require('fs');
const { send } = require('process');
const path = require('path');
const Database = require('./database.js') 

const appBasePath = remote.app.getAppPath()
const appUserPath = remote.app.getPath("userData")
const dbFileName = 'mydatabase.sqlite'
const fullDbPath = path.join(appUserPath,dbFileName)
//const db = new sqlite3.Database(fullDbPath)
var db = remote.getGlobal('sharedObj').db


ipcRenderer.on('saveTextAsHTML', (event, data) => {
    let filepath = data// + ".html"
    let content = document.getElementById('textBox').innerHTML
    let anchors = Array.from(document.getElementById('textBox').getElementsByTagName('a'))
    let internalLinkIdList = []
    anchors.forEach(x => {
        onclickfuntion = x.getAttribute('onclick')
        if(onclickfuntion.includes('callinternalLink')) {
            internaLlinkId = onclickfuntion.split('(')[1].split(')')[0]
        }
        internalLinkIdList.push(internaLlinkId)
    })

    fs.writeFile(filepath, content, (err) => {
        if (err) {
            alert("An error ocurred updating the file" + err.message);
            console.log(err);
        }else{
            newData = {
                filepath:data,
                internalLinkIdList:internalLinkIdList
            }
            console.log("internalLinkIdList: "+internalLinkIdList)
            console.log("internalLinkIdList: "+newData.internalLinkIdList)
            ipcRenderer.send('saveTextAsHTML-step2',newData)
            alert("The file has been succesfully saved");
        
        }
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

ipcRenderer.on('internal-link-step3', (event, data) => {//sent from main.js. based on the message from pdf.js
    origSenderId = data.windowId_1
    console.log("internal-link-step3")
    ipcRenderer.on('internal-link-step4', (event, arg) => {//sent from editor menu
        console.log("internal-link-step4")
        if(arg) return //arg not null for other open editors

        let pdfLinkData = data;
        let textBox = document.getElementById('textBox')
        let text = window.getSelection()
        let newTextElement = document.createElement('a');
        newTextElement.appendChild(document.createTextNode(text));
        newTextElement.setAttribute('href',"#")

        if(!textBox.innerText.includes(text)){
            alert('please select the text first')
            ipcRenderer.send('internal-link-step2',pdfLinkData)
        }else{
            alert('Text selected: '+text)
            anchor = {
                $doc_name : 'tbd',
                $doc_path : 'tbd',
                $pdf_quads : '',
                $pdf_page: '',
                $file_type: "text",
                $anchor_text : ""+text,
                $doc_position : "tbd",
            }
            data.anchor_2 = anchor
            data.windowId_2 = remote.getCurrentWindow().id

            console.log("current window id: "+data.windowId_2)
            console.log("creating link "+JSON.stringify(data.anchor_1))
            console.log("creating link "+JSON.stringify(data.anchor_2))
            db.createLinkWithAnchors("default","default",data.anchor_1,data.anchor_2).then( (link_ids) => {
                data.link_id = link_ids.link_id
                data.anchor_id_1 = link_ids.anchor_id_1
                data.anchor_id_2 = link_ids.anchor_id_2
                ipcRenderer.send('internal-link-step5', data) //give other window all the data

                linkingFunction = "callinternalLink("+data.link_id+", "+data.anchor_id_1+");"
                newTextElement.setAttribute('onclick',linkingFunction)

                if (text.rangeCount) {
                    let range = text.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(newTextElement);
                }else{
                    alert("something with the linking went wrong: no range")
                }
            })
        }
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
})


//has to be put into html editor file
function callLinkedLinks(linkID){
    ipcRenderer.send('call-linked-links',linkID);
}

//has to be put into html editor file
function callinternalLink(linkID){
    ipcRenderer.send('call-pdf-link',linkID);
}
