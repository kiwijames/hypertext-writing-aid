const { ipcRenderer, remote, dialog, ipcMain } = require('electron');
const fs = require('fs');
const { send } = require('process');

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

ipcRenderer.on('internal-link-step3', (event, data) => { 
    //origSender = pdf window that sent the link, now return link
    origSenderId = data.origSenderId
    ipcRenderer.on('internal-link-step4', (event, arg) => {  
        if(arg) return
        console.log("after return")
        //data = {
        //  text : text,
        //  windowId : remote.getCurrentWindow().id,
        //  pdfName : pdfFileName,
        //  pageNumber: page,
        //  quads: quads,
        //  linkName: "default"
        //}
        let pdfLinkData = data;
        let textBox = document.getElementById('textBox')
        let selectedText = window.getSelection()
        let newTextElement = document.createElement('a');
        newTextElement.appendChild(document.createTextNode(selectedText));
        newTextElement.setAttribute('href',"#")

        if(!textBox.innerText.includes(selectedText)){
            alert('please select the text first')
            ipcRenderer.send('internal-link-step2',pdfLinkData)
        }else{
            let dataToPutInDb = {
                link_name: 'tbd', 
                doc_name: 'tbd',
                doc_text: 'tbd', 
                doc_range: 'tbd', 
                pdf_name: pdfLinkData.pdfName, 
                pdf_data: pdfLinkData.pageNumber, 
                pdf_quads: pdfLinkData.quads, 
            }
            dataToPutInDb.origSenderId = origSenderId
            dataToPutInDb.editorWindowId = remote.getCurrentWindow().id
            console.log("current window id: "+dataToPutInDb.editorWindowId)
            ipcRenderer.send('internal-link-step5',dataToPutInDb)
            //TODO: store link data and give function link to anchor in text
            
            ipcRenderer.on('internal-link-step6', (event, data, ) => { 
                linkingFunction = "callinternalLink("+data+");"
                newTextElement.setAttribute('onclick',linkingFunction)

                if (selectedText.rangeCount) {
                    let range = selectedText.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(newTextElement);

                }else{
                    alert("something with the linking went wrong: no range")
                }
            });
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


//has to be put into html editor file
function callLinkedLinks(linkID){
    ipcRenderer.send('call-linked-links',linkID);
}

//has to be put into html editor file
function callinternalLink(linkID){
    ipcRenderer.send('call-pdf-link',linkID);
}


////////////////////////////////////Window Event Handeling//////////////////////////////////////////////////

//DOESNT WORK
//win.once('did-finish-load',()=>{
//    console.log("finish loading")
//    win.addEventListener('beforeunload', (e) => {
//        e.returnValue  =true;
//        var answer = confirm('Do you reallz want to close the window?')
//        
//        console.log("choice: "+answer)
//        if(answer) win.destroy()
//    })
//})