const validationRegex = /^(\d{8,14}|\d{9}[xX])$/;

const toInt = (num) => parseInt(num, 10);

const isOdd = (num) => (num % 2) === 1;

// all of the supported barcode types have their checksum digit as the last digit of the string.
const extractCheckDigit = (code) => {
    const str = code.toString().toUpperCase();
    return str[str.length - 1];
};


module.exports = {
    validationRegex,
    toInt,
    isOdd,
    extractCheckDigit,
};
