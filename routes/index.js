var express = require('express');
var router = express.Router();
const Razorpay = require("razorpay");
const User = require("../models/user.model");
const jwt = require("jsonwebtoken");
const scrapeGoogleMaps = require("../utilities/module.scrapper");
const ScrapeResult = require("../models/scrape.model");
const Payment = require("../models/payment.model"); // Import the Payment model

/* GET home page. */
// *********************************RAZORPAY*********************************

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

router.post("/create-order", async (req, res) => {
  try {
      const { amount } = req.body; // Amount in INR
      const order = await razorpay.orders.create({
          amount: amount * 100, // Convert to paisa
          currency: "INR",
          receipt: "receipt_" + Date.now(),
      });

      res.json(order);
  } catch (error) {
      res.status(500).json({ error: "Error creating Razorpay order" });
  }
});


router.post("/verify-payment", async (req, res) => {
  try {
    const { userToken, order_id, payment_id } = req.body;
    const decoded = jwt.verify(userToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) return res.status(400).json({ error: "User not found" });

    // Save payment details in MongoDB
    const payment = new Payment({
      userId: user._id,
      orderId: order_id,
      paymentId: payment_id,
      amount:199,
    });

    await payment.save();

    // Update user credits
    user.credits += 250;
    await user.save();

    res.json({
      message: "Payment successful and saved",
      credits: user.credits,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Payment verification and saving failed" });
  }
});

// *********************************PAYU MONEY*********************************

// const PAYU_MERCHANT_KEY = "8688894"; 
// const PAYU_MERCHANT_SALT = "Vzxxs7";
// const PAYU_BASE_URL = "https://test.payu.in"; // Change to production URL if needed

// // Generate a PayU Money transaction
// router.post("/create-order", async (req, res) => {
//     try {
//         const { amount, email, phone, firstName, productInfo } = req.body;

//         // Unique transaction ID
//         const txnid = "txn_" + Date.now();

//         // Create hash string for PayU
//         const hashString = `${PAYU_MERCHANT_KEY}|${txnid}|${amount}|${productInfo}|${firstName}|${email}|||||||||||${PAYU_MERCHANT_SALT}`;
//         const hash = crypto.createHash('sha512').update(hashString).digest('hex');

//         // PayU payment request payload
//         const payUData = {
//             key: PAYU_MERCHANT_KEY,
//             txnid,
//             amount,
//             productinfo: productInfo,
//             firstname: firstName,
//             email,
//             phone,
//             surl: "https://7cvccltb-5000.inc1.devtunnels.ms/success",
//             furl: "https://7cvccltb-5000.inc1.devtunnels.ms/failure",
//             hash,
//             service_provider: "payu_paisa",
//         };

//         res.json({ payUData });
//     } catch (error) {
//         console.error("Error creating PayU order:", error);
//         res.status(500).json({ error: "Error creating PayU order" });
//     }
// });

// // Verify PayU payment
// router.post("/verify-payment", async (req, res) => {
//     try {
//         const { userToken, txnid, mihpayid, status } = req.body;

//         const decoded = jwt.verify(userToken, process.env.JWT_SECRET);
//         const user = await User.findById(decoded.id);
//         if (!user) return res.status(400).json({ error: "User not found" });

//         if (status === "success") {
//             user.credits += 150;
//             await user.save();
//             res.json({ message: "Payment successful", credits: user.credits });
//         } else {
//             res.status(400).json({ error: "Payment failed" });
//         }
//     } catch (error) {
//         console.error("Payment verification failed:", error);
//         res.status(500).json({ error: "Payment verification failed" });
//     }
// });





// scrapeapi
// router.post("/scrape", async (req, res) => {
//   try {
//       const { userToken, keyword } = req.body;
//       const decoded = jwt.verify(userToken, process.env.JWT_SECRET);
//       const user = await User.findById(decoded.id);

//       if (!user || user.credits < 50) {
//           return res.status(400).json({ error: "Not enough credits. Minimum 50 credits required." });
//       }

//       const result = await scrapeGoogleMaps(keyword, user._id);

//       if (result.count === 0) {
//           return res.status(400).json({ error: "No new data available. You have already scraped all available results." });
//       }

//       // Deduct credits (50 per request)
//       user.credits -= 50;
//       await user.save();

//       // Save the new unique results
//       let existingScrape = await ScrapeResult.findOne({ userId: user._id, keyword });
//       if (existingScrape) {
//           existingScrape.data.push(...result.data);
//           await existingScrape.save();
//       } else {
//           const savedScrape = new ScrapeResult({ userId: user._id, keyword, data: result.data });
//           await savedScrape.save();
//       }

//       res.json({ message: "Scraping successful", data: result.data, remainingCredits: user.credits });
//   } catch (error) {
//       console.error(error);
//       res.status(500).json({ error: "Scraping failed" });
//   }
// });

router.post("/scrape", async (req, res) => {
  try {
      const { userToken, keyword } = req.body;
      const decoded = jwt.verify(userToken, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user || user.credits < 50) {
          return res.status(400).json({ error: "Not enough credits. Minimum 50 credit required." });
      }

      const result = await scrapeGoogleMaps(keyword, user._id);

      if (result.count === 0) {
          return res.status(400).json({ error: "No new data available. You have already scraped all available results." });
      }

      // Calculate the actual number of results extracted
      const dataCount = result.count; // Extracted results count

      // Deduct credits dynamically (1 credit per result)
      if (user.credits < dataCount) {
          return res.status(400).json({ error: `Not enough credits. You need at least ${dataCount} credits.` });
      }

      user.credits -= dataCount; // Deduct only for the number of extracted results
      await user.save();

      // Save the new unique results
      let existingScrape = await ScrapeResult.findOne({ userId: user._id, keyword });
      if (existingScrape) {
          existingScrape.data.push(...result.data);
          await existingScrape.save();
      } else {
          const savedScrape = new ScrapeResult({ userId: user._id, keyword, data: result.data });
          await savedScrape.save();
      }

      res.json({
          message: "Scraping successful",
          data: result.data,
          extractedCount: dataCount,
          remainingCredits: user.credits
      });

  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Scraping failed" });
  }
});
router.post("/get-scraped-data", async (req, res) => {
    try {
      const { userToken } = req.body;
  
      // Verify and decode the token
      const decoded = jwt.verify(userToken, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
  
      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }
  
      // Fetch all scraped data for the user
      const scrapedData = await ScrapeResult.find({ userId: user._id });
  
      if (!scrapedData.length) {
        return res.status(404).json({ error: "No scraped data found for this user" });
      }
  
      res.json({
        message: "Scraped data retrieved successfully",
        data: scrapedData,
      });
  
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to retrieve scraped data" });
    }
  });
  
  

// ******************************ADMIN************************
const verifyAdmin = (req, res, next) => {
  const { adminToken } = req.body;
  if (!adminToken) {
      return res.status(403).json({ error: "Admin token is required" });
  }

  try {
      const decoded = jwt.verify(adminToken, process.env.ADMIN_SECRET);

      // You can add custom logic to check if the user is an admin.
      // For example, check a role field or compare against a specific admin ID.
      if (!decoded.isAdmin) {
          return res.status(403).json({ error: "Unauthorized access - not an admin" });
      }

      // Attach the decoded data to the request object for further use
      req.admin = decoded;
      next();

  } catch (error) {
      return res.status(403).json({ error: "Invalid or expired admin token" });
  }
};

// ✅ API 1: Fetch User Payments and Credits by User ID
router.post('/admin/getusers', verifyAdmin, async (req, res) => {
  try {
      // Fetch all users with specific fields
      const users = await User.find({}, { _id: 1, email: 1, createdAt: 1 });

      if (!users || users.length === 0) {
          return res.status(404).json({ error: "No users found" });
      }

      // Format the response data
      const formattedUsers = users.map(user => ({
          userId: user._id,
          email: user.email,
          createdAt: user.createdAt,
      }));

      res.json({ users: formattedUsers });

  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error fetching users" });
  }
});

router.post("/admin/user-details", verifyAdmin, async (req, res) => {
  try {
      const { userId } = req.body;
      const user = await User.findById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const userPayments = await Payment.find({ userId });
      const totalPayments = userPayments.reduce((sum, payment) => sum + payment.amount, 0);

      res.json({
          userId: user._id,
          name: user.name,
          email: user.email,
          credits: user.credits,
          totalPayments,
          payments: userPayments,
      });
  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error fetching user details" });
  }
});

router.post("/admin/revenue-summary", verifyAdmin, async (req, res) => {
  try {
      // 1. Calculate total revenue
      const totalRevenueData = await Payment.aggregate([
          {
              $group: {
                  _id: null,
                  total: { $sum: "$amount" }
              }
          }
      ]);

      const totalRevenue = totalRevenueData[0]?.total || 0;

      // 2. Calculate month-wise revenue
      const monthlyRevenue = await Payment.aggregate([
          {
              $group: {
                  _id: {
                      year: { $year: "$createdAt" },
                      month: { $month: "$createdAt" }
                  },
                  total: { $sum: "$amount" }
              }
          },
          {
              $sort: {
                  "_id.year": -1,
                  "_id.month": -1
              }
          }
      ]);

      // Format the results
      const formattedRevenue = monthlyRevenue.map(item => ({
          month: `${item._id.month}-${item._id.year}`,
          totalRevenue: item.total
      }));

      // 3. Get total users
      const totalUsers = await User.countDocuments();

      res.json({
          totalRevenue,
          totalUsers,
          monthlyRevenue: formattedRevenue
      });

  } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Error fetching revenue summary" });
  }
});


module.exports = router;
