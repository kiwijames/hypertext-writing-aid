const { ipcRenderer, remote } = require('electron');
const Tabulator = require('tabulator-tables');
const Database = require('./database.js')


const appBasePath = remote.app.getAppPath()
const appUserPath = remote.app.getPath("userData")

var db = remote.getGlobal('sharedObj').db
var tabledata = []
var toReturnLinkId = false

db.getAllLinks().then( (rows) => {
    console.log("rows: "+JSON.stringify(rows))
    rows.forEach((row) => {
        tabledata.push(
            {
                "Link ID": row.link_id,
                "Link Name": row.link_name,
                "Link Description": row.link_description,
                "Creation Date": row.creation_date,
                "Document Name (1)": row.doc_name_1,
                "Anchor Text (1)": row.anchor_text_1,
                "Document Name (2)": row.doc_name_2,
                "Anchor Text (2)": row.anchor_text_2,
            }
        )
    })
    console.log("lets create the table!")
    putTable();
})

/*
db.all("SELECT * FROM links", function(err,rows){
    if(err) {
    console.log(err)
    } else{
        console.log(rows)
        //let rowText ="link_id | link_name | name1 | data1 | name2 | data2\n"
        rows.forEach((row) => {
            tabledata.push(
                {
                    id:row.link_id,
                    name:row.link_name,
                    document_name_1:row.document_name_1,
                    document_data_2:row.document_data_1,
                    document_name_2:row.document_name_2,
                    document_data_1:row.document_data_1,
                    creation_date:row.creation_date
                }
            )
        //  rowText = rowText+row.link_id+"|"+row.link_name+"|"+row.document_name_1+"|"+row.document_data_1+"|"+row.document_name_2+"|"+row.document_data_2+"\n"
        });
        console.log(tabledata)
        console.log("lets create the table!")
        putTable();
    }
});
*/

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
function putTable(){
    console.log("creating table")
//document.addEventListener('DOMContentLoaded', function() {
    var table
    if(toReturnLinkId){
        table = new Tabulator("#table", {
            data:tabledata,
            autoColumns:true,
            rowClick:function(e, row){
                console.log('I want to return id: '+row.getData()["Link ID"] +"something")
                ipcRenderer.send('returnLinkId',row.getData()["Link ID"]);
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
            console.log(JSON.stringify(row.getData()["Link ID"]))
            ipcRenderer.send('deleteLink',row.getData()["Link ID"]);
            console.log("row.getData().link_id "+row.getData("Link ID")["Link ID"])
            cell.getRow().delete();
        }});
    }
    table.redraw()
//});
}

ipcRenderer.on('requireLinkId', (event, data) => {
    console.log("received message "+data)
    toReturnLinkId = true
    
    putTable()
});

