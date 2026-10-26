// True for an absolute https:// URL. Used by validators and schemas for every link a user can store
// (resume links, application forms), so nothing else (javascript:, data:, http:) is ever saved.
const isHttpsUrl = (value) => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

// Schema validator form: an empty value is allowed (the field is optional)
const optionalHttpsUrl = (value) => !value || isHttpsUrl(value);

module.exports = { isHttpsUrl, optionalHttpsUrl };
