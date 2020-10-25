const { ipcRenderer } = require('electron');
const Tabulator = require('tabulator-tables');

let toReturnLinkId = false

/*var tabledata = [
    {id:1, name:"Oli Bob", location:"United Kingdom", gender:"male", rating:1, col:"red", dob:"14/04/1984"},
    {id:2, name:"Mary May", location:"Germany", gender:"female", rating:2, col:"blue", dob:"14/05/1982"},
    {id:3, name:"Christine Lobowski", location:"France", gender:"female", rating:0, col:"green", dob:"22/05/1982"},
    {id:4, name:"Brendon Philips", location:"USA", gender:"male", rating:1, col:"orange", dob:"01/08/1980"},
    {id:5, name:"Margret Marmajuke", location:"Canada", gender:"female", rating:5, col:"yellow", dob:"31/01/1999"},
    {id:6, name:"Frank Harbours", location:"Russia", gender:"male", rating:4, col:"red", dob:"12/05/1966"},
    {id:7, name:"Jamie Newhart", location:"India", gender:"male", rating:3, col:"green", dob:"14/05/1985"},
    {id:8, name:"Gemma Jane", location:"China", gender:"female", rating:0, col:"red", dob:"22/05/1982"},
    {id:9, name:"Emily Sykes", location:"South Korea", gender:"female", rating:1, col:"maroon", dob:"11/11/1970"},
    {id:10, name:"James Newman", location:"Japan", gender:"male", rating:5, col:"red", dob:"22/03/1998"},
];*/

//define table
function putTable(tableData, idReceiver){
    console.log("creating table")
//document.addEventListener('DOMContentLoaded', function() {
    var table
    if(toReturnLinkId){
        table = new Tabulator("#table", {
            data:tableData,
            autoColumns:true,
            rowClick:function(e, row){
                console.log('I want to return id: '+ "something")
                idReceiver.send('returnLinkId',row.getData().id);
                window.close()
            },
        });
    }else{
        table = new Tabulator("#table", {
            data:tabledata,
            autoColumns:true,
        });
        table.addColumn({formatter:"buttonCross", width:40, align:"center", cellClick:function(e, cell){
            let row = cell.getRow()
            console.log(row)
            ipcRenderer.send('deleteLink',row.getData().id);
            cell.getRow().delete();
        }});
    }
    table.redraw()
//});
}

ipcRenderer.on('requireLinkId', (event, data) => {
    console.log("received message "+data)
    toReturnLinkId = true
    let idReceiver = event.sender
    tableData = data
    putTable(tableData, idReceiver)
});

// rows.forEach((row) => {
//     tabledata.push(
//         {
//             id:row.link_id,
//             name:row.link_name,
//             document_name_1:row.document_name_1,
//             document_data_2:row.document_data_1,
//             document_name_2:row.document_name_2,
//             document_data_1:row.document_data_1,
//             creation_date:row.creation_date
//         }}