function format(msg, obj) {
  return msg.replace(/\{([\w|\||!|_|-]+)\}/g, function (m, k) {
    let rt = obj[k] || '';
    k.split('|').some(function(key) {
      if (!key) return;
      if (key.substr(0, 1) == "!" && !obj[key.substr(1)]) { return true; }
      if (obj[key]) { rt = obj[key]; return true; }
    });
    return rt;
  });
}

exports.format = format;
