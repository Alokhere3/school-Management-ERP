const crypto = require('crypto');

/**
 * Generate a secure temporary password
 * @param {number} length - Length of password (default: 12)
 * @returns {string} Temporary password
 */
function generateTempPassword(length = 12) {
    const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
    const randomBytes = crypto.randomBytes(length);
    let password = '';
    
    for (let i = 0; i < length; i++) {
        password += charset[randomBytes[i] % charset.length];
    }
    
    return password;
}

module.exports = {
    generateTempPassword
};


