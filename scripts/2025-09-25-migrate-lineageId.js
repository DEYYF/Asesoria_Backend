// scripts/2025-09-25-migrate-lineageId.js
require("dotenv").config();
const mongoose = require("mongoose");
const Dieta = require("../models/Dieta");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const bulk = [];
    const cursor = Dieta.find({
      $or: [{ lineageId: { $exists: false } }, { rev: { $exists: false } }]
    }).cursor();

    for await (const d of cursor) {
      bulk.push({
        updateOne: {
          filter: { _id: d._id },
          update: {
            $set: {
              lineageId: d.lineageId || d._id,
              rev: d.rev || 1,
              isCurrent: d.isCurrent !== false,
            },
          },
        },
      });
      if (bulk.length >= 500) {
        await Dieta.bulkWrite(bulk);
        bulk.length = 0;
      }
    }
    if (bulk.length) await Dieta.bulkWrite(bulk);
    console.log("Migración completa");
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
