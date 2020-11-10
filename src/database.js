const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs')


class Database {
    constructor(db_path, db_name) {
        const fullDbPath = path.join(db_path,db_name)
        this.db = initDatabase(fullDbPath)
    }

    /**
     * Creates a database object with the default schema based on the given path, or loads the existing one.
     * @param  {String} fullDbPath Complete path of the sqlite3 database file
     * @return  {sqlite3.Database} sqlite3 database object
     */
    initDatabase(fullDbPath) {
        if(fs.existsSync('fullFilePath')){
            consloge.debug("Found database at: "+fullFilePath)
            let db = new sqlite3.Database(fullFilePath, (err) => {
                if(err) return null
                return db
            })
        }else{
            console.debug("Existing database not found, initianting new one.")
            let db = new sqlite3.Database(fullFilePath, (err) => {
                if(er) return null
                db.exec(createLinkObjectTable)
                    .exec(createLinkingTable)
                    .exec(createAnchorTable, (err) => {
                        if(err) {
                            console.error("Error creating the tables.")
                            db.close((err)=>{
                                fs.unlinkSync(fullFilePath)
                                console.error("Deleted the table.")
                                return null
                            })
                        }
                        return db
                    })
            })
        }
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
const createLinkingTable = 'CREATE TABLE linking (\
    linking_id INTEGER PRIMARY KEY AUTOINCREMENT,\
    FOREIGN KEY(link_id_1) REFERENCES link(link_id),\
    FOREIGN KEY(link_id_2) REFERENCES link(link_id),\
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\
    );'
  
const createLinkObjectTable = 'CREATE TABLE link (\
    link_id INTEGER PRIMARY KEY AUTOINCREMENT,\
    link_name TEXT,\
    link_description TEXT,\
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\
    );'

const createAnchorTable = 'CREATE TABLE anchor (\
    anchor_id INTEGER PRIMARY KEY AUTOINCREMENT,\
    FOREIGN KEY(link_id) REFERENCES link(link_id),\
    doc_name TEXT,\
    doc_path TEXT,\
    pdf_quads TEXT,\
    pdf_page TEXT,\
    doc_position TEXT,\
    file_type TEXT,\
    anchor_text TEXT,\
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\
    );'