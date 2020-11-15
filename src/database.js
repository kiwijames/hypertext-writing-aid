const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

module.exports = class Database {

  /**
  * Constructor for the database class of the Hypertext Writing Aid program.
  * @param  {String} db_path Path to put the SQLite database in. The program needs proper allowance in this fodler.
  * @param  {String} db_name File name of the database
  * @return  {Database} this database object
  */
  constructor(db_path, db_name) {
    const fullDbPath = path.join(db_path, db_name);
    this.db = this.initDatabase(fullDbPath);
  }

  /**
   * Creates a database object with the default schema based on the given path, or loads the existing one.
   * @param  {String} fullDbPath Complete path of the sqlite3 database file
   * @return  {sqlite3.Database} sqlite3 database object
   */
  initDatabase(fullFilePath) {
    if (fs.existsSync(fullFilePath)) {
      console.debug("Found database at: " + fullFilePath);
      return new sqlite3.Database(fullFilePath, (err) => {
        if (err) console.debug("Error creating database: " + err);
      });
    } else {
      console.debug(
        "Existing database not found at " +
          fullFilePath +
          ", initianting new one."
      );
      let db = new sqlite3.Database(fullFilePath, (err) => {
        if (err) console.debug("There might be a problem with the database.");
        else {
          db.exec(createLinkTable).exec(createAnchorTable, (err) => {
            console.debug("create table executed");
            if (err) {
              console.error("Error creating the tables." + err);
              db.close((err) => {
                fs.unlinkSync(fullFilePath);
                console.error("Deleted the table.");
              });
            }
          });
        }
      });
      return db;
    }
  }

  /*
   * Closes the database.
   * After this function is called, the Database object won't work work anymore.
   */
  closeDatabase() {
    this.db.close();
  }
  
  /**
   * Given a filename will delete all associated links and anchors.
   * @param  {String} doc_name Name of the document
   */
  deleteLinksWithFilePath(doc_name) {
    let deleteStatement =
      "DELETE FROM link\
            WHERE anchor_id_1 IN (SELECT a1.anchor_id FROM anchor a1 WHERE a1.doc_name = ?) \
            OR anchor_id_2 IN (SELECT a2.anchor_id FROM anchor a2 WHERE a2.doc_name = ?)";
    let deleteSTatement2 = "DELETE FROM anchor WHERE doc_name = ?";
    this.db.run(deleteStatement, doc_name, doc_name, function (err) {
      if (err) console.error("Error occured when trying to delete link ", err);
      else console.debug("Finished deleting link");
    });
    this.db.run(deleteSTatement2, doc_name, function (err) {
      if (err) console.error("Error occured when trying to delete link ", err);
      else console.debug("Finished deleting anchor");
    });
  }

  /**
   * WIll update the file path, file name, and last modification date for all anchors of the given file name
   * @param  {String} doc_name Name of the document
   * @param  {String} doc_path Path to the document
   * @param  {String} last_modified Last modified date as a String
   */
  updateFilePathForAllAnchors(doc_name, doc_path, last_modified="") {
    this.db.run(
      "UPDATE anchor \
        SET doc_name = ?, doc_path = ?, last_modified = ? \
        WHERE doc_name = ?",
      doc_name,
      doc_path,
      last_modified,
      doc_name,
      function (err) {
        if (err) console.log(err);
      }
    );
  }
  
  /**
   * WIll update the file path, file name, and last modification date for the given anchor ID
   * @param  {Number} anchor_id Anchor ID
   * @param  {String} doc_name Name of the document
   * @param  {String} doc_path Path to the document
   * @param  {String} last_modified Last modified date as a String
   */
  updateTemporaryAnchors(anchor_id,doc_name,doc_path,last_modified) {
    this.db.run(
      "UPDATE anchor \
       SET doc_name = ?, doc_path = ?, last_modified = ? \
       WHERE anchor.anchor_id = ?",
      doc_name,doc_path,last_modified,anchor_id,
      function (err) {
        if (err) console.log(err);
      }
    );
  }

  /**
   * Creates a link with the given data and anchors. The anchor objects need to be in the proper format.
   * @param  {String} link_name Name of the link
   * @param  {String} link_description Description of the link
   * @param  {Object} anchor_1 First anchor object
   * @param  {Object} anchor_2 Second anchor oject
   */
  createLinkWithAnchors(link_name, link_description, anchor_1, anchor_2) {
    return new Promise((resolve, reject) => {
      this.createAnchor(anchor_1).then((anchor_id_1) => {
        this.createAnchor(anchor_2).then((anchor_id_2) => {
          let link = {
            $link_name: link_name,
            $link_description: link_description,
            $anchor_id_1: anchor_id_1,
            $anchor_id_2: anchor_id_2,
          };
          this.createLink(link).then((link_id) => {
            let link_ids = {
              link_id: link_id,
              anchor_id_1: anchor_id_1,
              anchor_id_2: anchor_id_2,
            };
            resolve(link_ids);
          });
        });
      });
    });
  }

  /**
   * Returns a promise returning an error or the id of the new link
   * @param  {Object} link corresponds to the database object
   */
  createLink(link) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO 'link' (link_name,link_description,anchor_id_1,anchor_id_2) \
            VALUES($link_name,$link_description,$anchor_id_1,$anchor_id_2)",
        link,
        function (err) {
          if (err) eject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  /**
   * Returns a promise returning an error or the id of the new anchor
   * @param  {Object} anchor corresponds to the database object
   */
  createAnchor(anchor) {
    anchor.$pdf_quads = JSON.stringify(anchor.$pdf_quads);
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO 'anchor' (doc_name,  doc_path,  file_type,  anchor_text,  pdf_quads,  pdf_page, doc_position, last_modified) \
                                     VALUES ($doc_name, $doc_path, $file_type, $anchor_text, $pdf_quads, $pdf_page, $doc_position, $last_modified)",
        anchor,
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
  }

  /**
   * Returns a promise returning all links with anchor data
   * @return  {[Object]} list of sqlite3 database objects
   */
  getAllAnchors() {
    return new Promise((resolve, reject) => {
      this.db.all("SELECT * from anchor", (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Returns a promise returning all links with anchor data
   * @return  {[Object]} list of sqlite3 database objects
   */
  getAllLinks() {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT l.link_id link_id, l.link_name link_name, l.link_description link_description, l.creation_date, \
            a1.doc_name doc_name_1, a1.doc_path doc_path_1, a1.anchor_text anchor_text_1, a1.pdf_quads pdf_quads_1, a1.pdf_page pdf_page_1, a1.doc_position doc_position_1, a1.file_type file_type_1, a1.last_modified last_modified_1, \
            a2.doc_name doc_name_2, a2.doc_path doc_path_2, a2.anchor_text anchor_text_2, a2.pdf_quads pdf_quads_2, a2.pdf_page pdf_page_2, a2.doc_position doc_position_2, a2.file_type file_type_2, a2.last_modified last_modified_2 \
            FROM link l\
            INNER JOIN anchor AS a1 ON a1.anchor_id = l.anchor_id_1 \
            INNER JOIN anchor AS a2 ON a2.anchor_id = l.anchor_id_2",
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  /**
   * Returns a promise returning all anchor objects associated with a document name.
   * @param  {String} doc_name name of the document
   * @return  {[Object]} list of sqlite3 database objects
   */
  getAllAnchorsForDoc(doc_name) {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM link, anchor WHERE (anchor_id = link.anchor_id_1 OR anchor_id = link.anchor_id_2) AND doc_name = ?",
        doc_name,
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  /**
   * Returns a promise given a link_id and anchor_id the other corresponding anchor is given.
   * @param  {Number} link_id id of the link
   * @param  {Number} anchor_id id of the anchor
   * @return  {Object} sqlite3 database object
   */
  getOtherAnchorData(link_id, anchor_id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM link, anchor WHERE (anchor_id=anchor_id_1 OR anchor_id=anchor_id_2) AND link_id = ? AND anchor_id != ? \
            ",
        link_id,
        anchor_id,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Returns a promise returning a anchor database object given the anchor_id
   * @param  {Number} anchor_id Id corresponding to an entry in the 'anchor' table
   * @return {Object} link object based on the database
   */
  getAnchorData(anchor_id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM anchor WHERE anchor_id= ?",
        anchor_id,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Returns a promise returning a link database object given the link_id
   * @param  {Number} link_id Id corresponding to an entry in the 'link' table
   * @return {Object} link object based on the database
   */
  getFullLinkData(link_id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM link \
                        INNER JOIN anchor AS anchor_1 ON anchor_1.link_id = link.link_id \
                        INNER JOIN anchor AS anchor_2 ON anchor_2.link_id = link.link_id \
                        WHERE link.link_id= ?",
        link_id,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Returns a promise returning a link database object given the link_id
   * @param  {Number} link_id Id corresponding to an entry in the 'link' table
   * @return {Object} link object based on the database
   */
  getBasicLinkData(link_id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM link WHERE link_id= ?",
        link_id,
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  /**
   * Deletes entry from the 'link' table given the link_id.
   * Objects related with foreign key restraints are deleted as well! (TODO CHECK if foreign key auto deletion)
   * @param  {Number} link_id Id corresponding to an entry in the 'link' table
   */
  deleteLinkById(link_id) {
    let deleteStatement = "DELETE FROM link WHERE link_id = ?";
    this.db.run(deleteStatement, link_id, function (err) {
      if (err) console.error("Error occured when trying to delete link ", err);
    });
  }

  /**
   * Deletes entry from the 'link' table given the link_id.
   * Objects related with foreign key restraints are deleted as well! (TODO CHECK if foreign key auto deletion)
   * @param  {Number} link_id Id corresponding to an entry in the 'link' table
   */
  deleteTemporaryLinks() {
    let deleteStatement =
      "DELETE FROM link WHERE link_id IN ( \
            SELECT link_temp.link_id FROM link AS link_temp\
            INNER JOIN anchor AS anchor_1 ON anchor_1.anchor_id = link_temp.anchor_id_1 \
            INNER JOIN anchor AS anchor_2 ON anchor_2.anchor_id = link_temp.anchor_id_2 \
            WHERE anchor_1.doc_name = 'tbd' OR anchor_2.doc_name = 'tbd')";
    this.db.run(deleteStatement, function (err) {
      if (err) console.error("Error occured when trying to delete links", err);
      else console.debug("Finished deleting temp links");
    });
  }
};

/////////////////////////////////////////////Database Schema/////////////////////////////////////////////

const createLinkTable =
  "CREATE TABLE link (\
    link_id INTEGER PRIMARY KEY AUTOINCREMENT,\
    link_name TEXT,\
    link_description TEXT,\
    anchor_id_1 INTEGER NOT NULL,\
    anchor_id_2 INTEGER NOT NULL,\
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,\
    FOREIGN KEY(anchor_id_1) REFERENCES anchor(anchor_id) ON DELETE CASCADE,\
    FOREIGN KEY(anchor_id_2) REFERENCES anchor(anchor_id) ON DELETE CASCADE\
    );";

const createAnchorTable =
  "CREATE TABLE anchor (\
    anchor_id INTEGER PRIMARY KEY AUTOINCREMENT,\
    doc_name TEXT,\
    doc_path TEXT,\
    pdf_quads TEXT,\
    pdf_page INTEGER,\
    doc_position TEXT,\
    file_type TEXT,\
    anchor_text TEXT,\
    last_modified TEXT\
    creation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL\
    );";
