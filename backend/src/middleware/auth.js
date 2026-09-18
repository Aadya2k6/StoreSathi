// Mock Auth Middleware for Hackathon Demo
// Hardcodes the context to merchant_id = 'merchant_1' and store_id = 'store_1'
module.exports = (req, res, next) => {
  // In a real app, this would extract a JWT from the Authorization header
  // and look up the merchant and store in the DB.
  req.merchant_id = 'merchant_1';
  req.store_id = 'store_1';
  next();
};
