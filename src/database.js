const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs')


module.exports = class Database {
    constructor(db_path, db_name) {
        const fullDbPath = path.join(db_path,db_name)
        this.db = this.initDatabase(fullDbPath)
    }

    /**
     * Creates a database object with the default schema based on the given path, or loads the existing one.
     * @param  {String} fullDbPath Complete path of the sqlite3 database file
     * @return  {sqlite3.Database} sqlite3 database object
     */
    initDatabase(fullFilePath) {
        if(fs.existsSync(fullFilePath)){
            console.debug("Found database at: "+fullFilePath)
            return new sqlite3.Database(fullFilePath, (err) => {
                if(err) console.debug("Error creating database: "+err)
            })
        }else{
            console.debug("Existing database not found at "+fullFilePath+", initianting new one.")
            let db = new sqlite3.Database(fullFilePath, (err) => {
                if(err) console.debug("There might be a problem with the database.")
                else {
                db.exec(createLinkTable)
                .exec(createAnchorTable, (err) => {
                    console.debug("create table executed")
                    if(err) {
                        console.error("Error creating the tables." + err)
                        db.close((err)=>{
                            fs.unlinkSync(fullFilePath)
                            console.error("Deleted the table.")
                        })
                    }
                })
                }
            })
            return db
        }
    }

    closeDatabase() {
        this.db.close()
    }



    /**
    * Returns a promise returning an error or the id of the new link
    * @param  {Object} link corresponds to the database object
    */
   createLink(link){
    return new Promise((resolve,reject) => {
        this.db.run("INSERT INTO link(link_name,link_description,anchor_id_1,anchor_id_2) \
        VALUES($link_name,$link_description,$anchor_id_1,$anchor_id_2)", link, function (err) {
            if(err) {
                console.log(err)
                reject(err)
            }
            else resolve(this.lastID)
        })
    })
}


    /**
    * Returns a promise returning an error or the id of the new anchor
    * @param  {Object} anchor corresponds to the database object
    */
    createAnchor(anchor){
        console.log("putting anchor into table")
        return new Promise((resolve,reject) => {
            this.db.run("INSERT INTO 'anchor' (doc_name,  doc_path,  file_type,  anchor_text,  pdf_quads,  pdf_page,  doc_position) \
                                     VALUES ($doc_name, $doc_path, $file_type, $anchor_text, $pdf_quads, $pdf_page, $doc_position)", 
            anchor, function (err) {
                if(err) {
                    console.log(err)
                    reject(err)
                }
                else resolve(this.lastID)
                
            })
        })
    }



    /**
    * Returns a promise returning all anchor objects associated with a document name.
    * @param  {String} doc_name name of the document
    * @return  {[Object]} list of sqlite3 database objects
    */
    getAllAnchorsForDoc(doc_name){
        return new Promise((resolve,reject) => {
            this.db.all("SELECT * FROM anchor WHERE anchor.doc_name = ?",
                        doc_name, (err,rows) => {
                if(err) {
                    console.log(err)
                    reject(err)
                }
                else resolve(rows)
            })
        })
    }


    /**
     * Returns a promise given a link_id and anchor_id the other corresponding anchor is given.
     * @param  {Number} link_id id of the link
     * @param  {Number} anchor_id id of the anchor
     * @return  {Object} sqlite3 database object
     */
    getOtherAnchorData(link_id, anchor_id){
        return new Promise((resolve,reject) => {
            this.db.get("SELECT * FROM anchor WHERE anchor.link_id = ? AND anchor.anchor_id != ?", 
                            link_id, anchor_id, (err,row) => {
                if(err) return reject
                else return resolve(row)
            })
        })
    }

    /**
     * Returns a promise returning a anchor database object given the anchor_id
     * @param  {Number} anchor_id Id corresponding to an entry in the 'anchor' table
     * @return {Object} link object based on the database
     */
    getAnchorData(anchor_id) {
        return new Promise((resolve,reject) => {
            this.db.get("SELECT * FROM anchor WHERE anchor_id= ?", anchor_id, (err,row) => {
                if(err) return reject
                else return resolve(row)
            })
        })
    }

    /**
     * Returns a promise returning a link database object given the link_id
     * @param  {Number} link_id Id corresponding to an entry in the 'link' table
     * @return {Object} link object based on the database
     */
    getFullLinkData(link_id) {
        return new Promise((resolve,reject) => {
            this.db.get("SELECT * FROM link \
                        INNER JOIN anchor AS anchor_1 ON anchor_1.link_id = link.link_id \
                        INNER JOIN anchor AS anchor_2 ON anchor_2.link_id = link.link_id \
                        WHERE link.link_id= ?", link_id, (err,row) => {
                if(err) return reject
                else return resolve(row)
            })
        })
    }


    /**
     * Returns a promise returning a link database object given the link_id
     * @param  {Number} link_id Id corresponding to an entry in the 'link' table
     * @return {Object} link object based on the database
     */
    getBasicLinkData(link_id) {
        return new Promise((resolve,reject) => {
            this.db.get("SELECT * FROM link WHERE link_id= ?", link_id, (err,row) => {
                if(err) return reject
                else return resolve(row)
            })
        })
    }

    /**
     * Deletes entry from the 'link' table given the link_id.
     * Objects related with foreign key restraints are deleted as well! (TODO CHECK if foreign key auto deletion)
     * @param  {Number} link_id Id corresponding to an entry in the 'link' table
     */
    deleteLinkById(link_id) {
        let deleteStatement = "DELETE FROM link WHERE link_id = ?";
        this.db.run(deleteStatement, link_id, function(err){
        if(err) console.error("Error occured when trying to delete link ",err)
        else console.debug("Finished deleting link with the link_id "+link_id)
        });
    } 
}



/////////////////////////////////////////////Database Schema/////////////////////////////////////////////

const createLinkTable = 'CREATE TABLE link (\
    link_id INTEGER PRIMARY KEY AUTOINCREMENT,\
    link_name TEXT,\
    link_description TEXT,\
    anchor_id_1 INTEGER NOT NULL,\
    anchor_id_2 INTEGER NOT NULL,\
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,\
    FOREIGN KEY(anchor_id_1) REFERENCES anchor(anchor_id),\
    FOREIGN KEY(anchor_id_2) REFERENCES anchor(anchor_id)\
    );'

const createAnchorTable = 'CREATE TABLE anchor (\
    anchor_id INTEGER PRIMARY KEY AUTOINCREMENT,\
    doc_name TEXT,\
    doc_path TEXT,\
    pdf_quads TEXT,\
    pdf_page INTEGER,\
    doc_position TEXT,\
    file_type TEXT,\
    anchor_text TEXT,\
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\
    );'
