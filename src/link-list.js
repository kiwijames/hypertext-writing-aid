/**
 * Table of links from the user for the Hypertext Writing aid application.
 *
 * @file   Linking Table 
 * @author Kevin Taylor
 */

const { ipcRenderer, remote } = require('electron');
const Tabulator = require('tabulator-tables');
const Database = require('./database.js')
const db = remote.getGlobal('sharedObj').db

db.getAllLinks().then( (rows) => {
    let tabledata = []
    rows.forEach((row) => {
        tabledata.push(
            {
                "Link ID": row.link_id,
                "Link Tag": row.link_tag,
                "Link Description": row.link_description,
                "Creation Date": row.creation_date,
                "Anchor ID (1)": row.anchor_id_1,
                "Document Name (1)": row.doc_tag_1,
                "Anchor Text (1)": row.anchor_text_1,
                "Anchor ID (2)": row.anchor_id_2,
                "Document Name (2)": row.doc_tag_2,
                "Anchor Text (2)": row.anchor_text_2,
            }
        )
    })
    putTable(tabledata, all_columns);
}).catch((err) => {console.log(err)});

//define table
function putTable(tabledata, all_columns){
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
            ipcRenderer.send('delete-link',row.getData()["Link ID"]);
            cell.getRow().delete();
        }
    });
    table.redraw()
}

ipcRenderer.on('send-doc-name', (event, data) => {
    doc_name = data
    let tabledata = []
    db.getAllLinksOfDoc(doc_name).then( (rows) => {
        rows.forEach((row) => {
            tabledata.push(
                {
                    "Link ID": row.link_id,
                    "Link Tag": row.link_tag,
                    "Link Description": row.link_description,
                    "Creation Date": row.creation_date,
                    "Anchor ID (1)": row.anchor_id_1,
                    "Document Name (1)": row.doc_tag_1,
                    "Anchor Text (1)": row.anchor_text_1,
                    "Anchor ID (2)": row.anchor_id_2,
                    "Document Name (2)": row.doc_tag_2,
                    "Anchor Text (2)": row.anchor_text_2,
                }
            )
        })
        putTable(tabledata,all_columns)
    }).catch((err) => {console.log(err)});

});



//////////////////////////////////// const ////////////////////////////////////
const all_columns = [
    {title:"Link ID",           field:"Link ID",          sorter:"number"},
    {title:"Link Tag",         field:"Link Tag",        sorter:"string", headerFilter:"input"},
    {title:"Link Description",  field:"Link Description", sorter:"string", formatter: "textarea", headerFilter:"input"},
    {title:"Creation Date",     field:"Creation Date",    sorter:"date"},
    {title:"Anchor ID (1)",     field:"Anchor ID (1)",    visible:false},
    {title:"Document Name (1)", field:"Document Name (1)",sorter:"string", headerFilter:"input", cellClick(e,cell){ipcRenderer.send('open-anchor', cell.getRow().getData()["Anchor ID (1)"]);}},
    {title:"Anchor Text (1)",   field:"Anchor Text (1)",  sorter:"string", formatter: "textarea", headerFilter:"input", cellClick(e,cell){ipcRenderer.send('open-anchor', cell.getRow().getData()["Anchor ID (1)"])}},
    {title:"Anchor ID (2)",     field:"Anchor ID (2)",    visible:false},
    {title:"Document Name (2)", field:"Document Name (2)",sorter:"string", headerFilter:"input", cellClick(e,cell){ipcRenderer.send('open-anchor', cell.getRow().getData()["Anchor ID (2)"])}},
    {title:"Anchor Text (2)",   field:"Anchor Text (2)",  sorter:"string", formatter: "textarea", headerFilter:"input", cellClick(e,cell){ipcRenderer.send('open-anchor', cell.getRow().getData()["Anchor ID (2)"])}},
]

const doc_columns = [
    {title:"Link ID",            field:"Link ID",            sorter:"number"},
    {title:"Link Tag",          field:"Link Tag",          sorter:"string", headerFilter:"input"},
    {title:"Link Description",   field:"Link Description",   sorter:"string", formatter: "textarea", headerFilter:"input"},
    {title:"Creation Date",      field:"Creation Date",      sorter:"date"},
    {title:"Anchor ID",          field:"Anchor ID",          visible:false},
    {title:"Document Name",      field:"Document Name",      sorter:"string", headerFilter:"input"},
    {title:"Anchor Text",        field:"Anchor Text",        sorter:"string", formatter: "textarea", headerFilter:"input"},
    {title:"Anchor ID (2)",      field:"Anchor ID (2)",      visible:false},
    {title:"Other Document Name",field:"Other Document Name",sorter:"string", headerFilter:"input", visible:false},
    {title:"Other Anchor Text",  field:"Other Anchor Text",  sorter:"string", formatter: "textarea", headerFilter:"input", visible:false}
]