const login = (req, res) => {
  res.status(200).json({ success: true, message: "Login successful" });
};

const register = (req, res) => {
  res.status(201).json({ success: true, message: "Register successful" });
};

module.exports = {
  login,
  register,
};
