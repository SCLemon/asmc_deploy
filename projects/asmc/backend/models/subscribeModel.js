const mongoose = require("mongoose");

const subscribeSchema = new mongoose.Schema({
    createTime: String,
    token:{
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    subscription: {
      type: Object,
      required: true,
    },
    userAgent: String,
});

const subscribeModel = mongoose.model("Subscribe", subscribeSchema);

module.exports = subscribeModel;