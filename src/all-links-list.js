const { ipcRenderer, remote } = require('electron');
const Tabulator = require('tabulator-tables');
const Database = require('./database.js')
const db = remote.getGlobal('sharedObj').db

db.getAllLinks().then( (rows) => {
    let tabledata = []
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
    putTable(tabledata, all_columns);
})

//define table
function putTable(tabledata, all_columns){
    console.log("creating table")
    let table = new Tabulator("#table", {
        layout:"fitDataFill",
        data: tabledata,
        columns: all_columns,
    });
    table.addColumn({
        formatter:"buttonCross", 
        width:40, 
        align:"center", 
        cellClick:function(e, cell){
            let row = cell.getRow()
            console.log(JSON.stringify(row.getData()["Link ID"]))
            ipcRenderer.send('deleteLink',row.getData()["Link ID"]);
            console.log("row.getData().link_id "+row.getData("Link ID")["Link ID"])
            cell.getRow().delete();
        }
    });
    
    table.redraw()
}

ipcRenderer.on('send-doc-name', (event, data) => {
    doc_name = data
    let tabledata = []
    db.getAllAnchorsForDoc(doc_name).then( (rows) => {
        rows.forEach((row) => {
            tabledata.push(
                {
                    "Link ID": row.link_id,
                    "Link Name": row.link_name,
                    "Link Description": row.link_description,
                    "Creation Date": row.creation_date,
                    "Document Name": row.doc_name,
                    "Anchor Text": row.anchor_text,
                }
            )
        })
        putTable(tabledata,doc_columns)
    })


});



//////////////////////////////////// const ////////////////////////////////////
const all_columns = [
    {title:"Link ID",           field:"Link ID",          sorter:"number"},
    {title:"Link Name",         field:"Link Name",        sorter:"string"},
    {title:"Link Description",  field:"Link Description", sorter:"string"},
    {title:"Creation Date",     field:"Creation Date",    sorter:"date"},
    {title:"Document Name (1)", field:"Document Name (1)",sorter:"string"},
    {title:"Anchor Text (1)",   field:"Anchor Text (1)",  sorter:"string", formatter: "textarea"},
    {title:"Document Name (2)", field:"Document Name (2)",sorter:"string"},
    {title:"Anchor Text (2)",   field:"Anchor Text (2)",  sorter:"string", formatter: "textarea"},
]

const doc_columns = [
    {title:"Link ID",         field:"Link ID",         sorter:"number"},
    {title:"Link Name",       field:"Link Name",       sorter:"string"},
    {title:"Link Description",field:"Link Description",sorter:"string"},
    {title:"Creation Date",   field:"Creation Date",   sorter:"date"},
    {title:"Document Name",   field:"Document Name",   sorter:"string"},
    {title:"Anchor Text",     field:"Anchor Text",     sorter:"string", formatter: "textarea"}
]