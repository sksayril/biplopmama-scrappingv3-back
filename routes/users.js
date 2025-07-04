var express = require('express');
var router = express.Router();
const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const AdminUser = require("../models/admin.user.model"); // Ensure correct path


/* GET users listing. */
router.post("/signup", async (req, res) => {
  try {
      const { name, email, password } = req.body;
      const hashedPassword = await bcrypt.hash(password, 10);

      const newUser = new User({ name, email, password: hashedPassword, credits: 0 });
      await newUser.save();

      res.json({ message: "User registered successfully" });
  } catch (error) {
      res.status(500).json({ error: "Error registering user" });
  }
});

router.post("/login", async (req, res) => {
  try {
      const { email, password } = req.body;
      const user = await User.findOne({ email });

      if (!user || !(await bcrypt.compare(password, user.password))) {
          return res.status(400).json({ error: "Invalid credentials" });
      }

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "365d" });
      res.json({ token, credits: user.credits,userName:user.name });
  } catch (error) {
      res.status(500).json({ error: "Error logging in" });
  }
});
router.post("/get-credits", async (req, res) => {
  try {
      const { userToken } = req.body;

      if (!userToken) {
          return res.status(400).json({ error: "User token is required" });
      }

      // Verify JWT Token
      const decoded = jwt.verify(userToken, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
          return res.status(400).json({ error: "User not found" });
      }

      // Return user credits
      res.json({ credits: user.credits, userName: user.name });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error retrieving credits" });
  }
});

// ************************ADMIN************************
router.post("/admin/signup", async (req, res) => {
    try {
        const {email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
  
        const newUser = new AdminUser({ email, password: hashedPassword });
        await newUser.save();
  
        res.json({ message: "Admin registered successfully" });
    } catch (error) {
        res.status(500).json({ error: "Error registering user" });
    }
  });

  router.post("/admin/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const adminUser = await AdminUser.findOne({ email });

        // Validate admin user
        if (!adminUser || !(await bcrypt.compare(password, adminUser.password))) {
            return res.status(400).json({ error: "Invalid credentials" });
        }

        // Create JWT Token with `isAdmin` role
        const token = jwt.sign(
            { id: adminUser._id, isAdmin: true }, 
            process.env.ADMIN_SECRET, 
            { expiresIn: "30d" }
        );

        res.json({ token, userName: "Admin" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Error logging in as admin" });
    }
});

module.exports = router;
