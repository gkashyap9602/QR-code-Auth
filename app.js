require("dotenv").config();
require("./config/database").connect();
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const bodyParser = require('body-parser')
const qrcode = require("qrcode");
const User = require("./model/user");
const QRCode = require('./model/qrCode')
const ConnectedDevice = require('./model/connectedDevice')
const ejs = require('ejs')
const path = require('path')

const app = express();
app.set('view engine','ejs')

app.set('views',path.join(__dirname,"views"))
// console.log();
app.use(express.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static('views'));


// Logic here

// Register



app.get('/loginpage',async (req,res)=>{

    try {
        // res.send("hye")  
        res.render('index')  
    } catch (error) {
        res.send(error)
    }
    
})

app.get('/qr/scannerpage',async(req,res)=>{
    try {
        res.render('webscan')
    } catch (error) {
        res.send(error)
    }
})

app.post("/register", async (req, res) => {
    // Our register logic starts here
    try {
      // Get user input

      console.log(req.body);

      const { first_name, last_name, email, password } = req.body;
  
      // Validate user input
      if (!(email && password && first_name && last_name)) {
        res.status(400).send("All input is required");
      }
  
      // check if user already exist
      // Validate if user exist in our database
      const oldUser = await User.findOne({ email });
  
      if (oldUser) {
        return res.status(409).send("User Already Exist. Please Login");
      }
  
      // Encrypt user password
      encryptedPassword = await bcrypt.hash(password, 10);
  
      // Create user in our database
      const user = await User.create({
        first_name,
        last_name,
        email: email.toLowerCase(), // sanitize: convert email to lowercase
        password: encryptedPassword,
      });
  
      // Create token
      const token = jwt.sign(
        { user_id: user._id, email }, process.env.TOKEN_KEY,
        { expiresIn: "2h",});

    // console.log(token);
  
      // return new user
      res.status(201).json({ token });
    } catch (err) {
      console.log(err);
    }
    // Our register logic ends here
  });

    



    // Login
    app.post("/login", async (req, res) => {
        // Our login logic starts here
        try {
          // Get user input
          console.log(req.body);
          const { email, password } = req.body;
      
          // Validate user input
          if (!(email && password)) {
            res.status(400).send("All input is required");
          }
      
          // Validate if user exist in our database
          const user = await User.findOne({ email });
      console.log(process.env.TOKEN_KEY,"loginroute key");
          if (user && (await bcrypt.compare(password, user.password))) {
            // Create token
            const token = jwt.sign(
              { user_id: user._id, email },
              process.env.TOKEN_KEY,
              {
                expiresIn: "2h",
              }
            );
      
            // save user token
            user.token = token;

            console.log(user,"after token creation");
      
            // user
            return res.status(200).json({ token });
          }
          return res.status(400).send("Invalid Credentials");
        } catch (err) {
          console.log(err);
        }
        // Our login logic ends here
      });

      app.post("/qr/generate", async (req, res) => {
        try {
          const { userId } = req.body;
      
          // Validate user input
          if (!userId) {
            res.status(400).send("User Id is required");
          }
      
          const user = await User.findById(userId);
          const email = user.email
        //   console.log(user.email,"user exist");
      
          // Validate is user exist
          if (!user) {
            res.status(400).send("User not found");
          }
      
          const qrExist = await QRCode.findOne({ userId });

          console.log(qrExist,"qr exist");
      
          // If qr exist, update disable to true and then create a new qr record
          if (!qrExist) {
            await QRCode.create({ userId });
          } else {
            await QRCode.findOneAndUpdate({ userId }, { $set: { disabled: true } });
            await QRCode.create({ userId });
          }
          console.log(process.env.TOKEN_KEY,"scan route key");
          // Generate encrypted data
          const encryptedData = jwt.sign(
            { userId: user._id, email }, process.env.TOKEN_KEY,
            { expiresIn: "1d",}
          );
      
          console.log(encryptedData,"token encrpted created");
          
          // Generate qr code
          const dataImage = await qrcode.toDataURL(encryptedData);
            console.log(dataImage,"dataimage");
          // Return qr code
          return res.status(200).json({ dataImage });
        } catch (err) {
          console.log(err);
          res.send(err)
        }
      });


      app.post("/qr/scan", async (req, res) => {
        try {
          const {token, deviceInformation } = req.body;
      
          if (!token && !deviceInformation) {
            res.status(400).send("Token and deviceInformation is required");
          }

          const decoded = jwt.verify(token,process.env.TOKEN_KEY)
          console.log(decoded,"after decode");
      
          const qrCode = await QRCode.findOne({
            userId: decoded.userId,
            disabled: false,
          });
      
          if (!qrCode) {
            res.status(400).send("QR Code not found");
          }
      
          const connectedDeviceData = {
            userId: decoded.userId,
            qrCodeId: qrCode._id,
            deviceName: deviceInformation.deviceName,
            deviceModel: deviceInformation.deviceModel,
            deviceOS: deviceInformation.deviceOS,
            deviceVersion: deviceInformation.deviceVersion,
          };
      
          const connectedDevice = await ConnectedDevice.create(connectedDeviceData);
      
          // Update qr code
          await QRCode.findOneAndUpdate(
            { _id: qrCode._id },
            {
              isActive: true,
              connectedDeviceId: connectedDevice._id,
              lastUsedDate: new Date(),
            }
          );
      
          // Find user
          const user = await User.findById(decoded.userId);
      
          // Create token
          const authToken = jwt.sign({ user_id: user._id }, process.env.TOKEN_KEY, {
            expiresIn: "2h",
          });
      
        //   if(authToken)
          // Return token
          return res.status(200).json({ token: authToken });
        // res.send("done")
        } catch (err) {
          console.log(err);
          res.send(err)
        }
      });

module.exports = app;