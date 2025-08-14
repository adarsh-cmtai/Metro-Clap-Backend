const User = require('../../models/userModel');
const jwt = require('jsonwebtoken');

const generateOtp = async (req, res) => {
  const { mobileNumber, role } = req.body;
  console.log("this is mobile", mobileNumber);

  if (!mobileNumber || !role) {
    return res.status(400).json({ message: 'Mobile number and role are required' });
  }

  const existingUser = await User.findOne({ mobileNumber });
  
  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  if (existingUser) {
    existingUser.otp = otp;
    existingUser.otpExpiry = otpExpiry;
    await existingUser.save();
    console.log("this is exist number",otp);
    
    return res.status(200).json({
      message: 'OTP sent to existing user for login.',
      otp: otp,
    });
  }
  console.log("this is mobile otp",otp);

  const newUser = await User.create({
    mobileNumber,
    role,
    otp,
    otpExpiry,
  });

  res.status(201).json({
    message: 'OTP sent for new user registration.',
    otp: newUser.otp,
  });
};

const registerPartner = async (req, res) => {
  const { mobileNumber } = req.body;
  if (!mobileNumber) {
    return res.status(400).json({ message: 'Mobile number is required' });
  }

  const existingUser = await User.findOne({ mobileNumber });
  if (existingUser) {
    return res.status(400).json({ message: 'A partner with this mobile number already exists.' });
  }

  const otp = Math.floor(1000 + Math.random() * 9000).toString();
  const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

  try {
    const newUser = await User.create({
      mobileNumber,
      role: 'partner',
      otp,
      otpExpiry,
      name: 'New Partner'
    });
  
    res.status(201).json({
      message: 'OTP sent for new partner registration.',
      otp: newUser.otp,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during partner registration', error: error.message });
  }
};

const verifyOtpAndLogin = async (req, res) => {
  const { mobileNumber, otp } = req.body;

  if (!mobileNumber || !otp) {
    return res.status(400).json({ message: 'Mobile number and OTP are required' });
  }

  const user = await User.findOne({ mobileNumber });

  if (!user) {
    return res.status(404).json({ message: 'User not found. Please sign up first.' });
  }

  if (user.otp !== otp || user.otpExpiry < Date.now()) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  await user.save();

  const token = jwt.sign(
    { id: user._id, role: user.role },
    process.env.JWT_SECRET,
    {
      expiresIn: '30d',
    }
  );

  res.status(200).json({
    message: 'Login successful',
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      mobileNumber: user.mobileNumber,
      role: user.role,
      avatarUrl: user.avatarUrl,
    },
  });
};

module.exports = { generateOtp, verifyOtpAndLogin, registerPartner };