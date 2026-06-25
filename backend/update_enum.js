require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    console.log("Connected to DB");
    
    try {
      await client.query("ALTER TYPE offender_category RENAME VALUE 'INTERSTATE_KINGPIN' TO 'INTERSTATE_LINK';");
      console.log("Renamed INTERSTATE_KINGPIN to INTERSTATE_LINK");
    } catch(e) { console.log(e.message); }
    
    try {
      await client.query("ALTER TYPE offender_category RENAME VALUE 'LOCAL_SUPPLIER' TO 'SUPPLIER';");
      console.log("Renamed LOCAL_SUPPLIER to SUPPLIER");
    } catch(e) { console.log(e.message); }

    try {
      await client.query("ALTER TYPE offender_category ADD VALUE 'FINANCIER';");
      console.log("Added FINANCIER");
    } catch(e) { console.log(e.message); }

    console.log("Done");
  } catch(e) {
    console.error("Error:", e);
  } finally {
    await client.end();
  }
}

run();
