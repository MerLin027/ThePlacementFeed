// Audit trail for admin actions: who, what, which records — never emails, passwords or other PII.
const logAdminAction = (req, action, details = {}) => {
  console.info(
    '[AdminAction]',
    JSON.stringify({
      action,
      adminId: req.admin?.id,
      ...details,
      ip: req.ip,
      at: new Date().toISOString(),
    })
  );
};

module.exports = { logAdminAction };
