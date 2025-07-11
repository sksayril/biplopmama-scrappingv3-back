const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    credits: { type: Number, default: 0 },
},{timestamps:true});

module.exports = mongoose.model("User", UserSchema);
