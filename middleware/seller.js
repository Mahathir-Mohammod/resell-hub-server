const seller = (req, res, next) => {
  if (req.user && (req.user.role === "seller" || req.user.role === "admin")) {
    next();
  } else {
    return res.status(403).json({ message: "Access denied, seller only" });
  }
};

module.exports = seller;
