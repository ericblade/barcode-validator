// Useful information: GTIN13 and EAN are basically the same thing.
// TODO: should also be functions to convert between UPC and EAN.
// TODO: need to also return 978 and 979 versions of 290 and 291 series ISBN barcodes.

/* eslint-disable eqeqeq */
const {
    validationRegex,
} = require('./util');

const {
    getIsbn13Checksum,
    validGtinChecksum,
    validUpcChecksum,
    validIsbn10Checksum,
    validIsbn13Checksum,
} = require('./checksums');


// https://stackoverflow.com/questions/2123131/determine-if-10-digit-string-is-valid-amazon-asin
// effectively tells us "does this string start with a "B" and is 10 alpha-numeric digits.
// Unfortunately, 10 digit strings such as BOOTSTRAPS look like a perfectly valid ASIN, and you wouldn't
// know the difference without asking Amazon if it's real.

const validAsin = (asin) => {
    return /^(B[\dA-Z]{9}|\d{9}(X|\d))$/.test(asin);
}

function getTypeOfBarcode(code) {
    switch(code.length) {
        case 10: {
            if (code.startsWith('B')) {
                return 'asin';
            }
            return 'isbn10';
        }
        case 12: return 'upc';
        case 13: {
            if(/^(978|979|290|291)[0-9].*/.test(code)) {
                return 'isbn13';
            }
            return 'gtin';
        }
        default: return 'gtin';
    }
}

const validatorMap = {
    gtin: validGtinChecksum,
    upc: validUpcChecksum,
    isbn10: validIsbn10Checksum,
    isbn13: validIsbn13Checksum,
    asin: validAsin,
};

// Given a barcode and an optional type, will attempt to correct an invalid code in some possible ways,
// and return if the code was valid.  If a type is NOT provided, type will be inferred (see getTypeOfBarcode())
// and returned.  If you DO specify a type, *only* validation on that type will be performed.
// Therefore, if your application *requires* a ISBN, pass the type.  If your application doesn't care what
// kind, or wants to know what kind it is, then don't pass the type.
// From the return value, you probably want to make use of the modifiedCode value, as that will contain
// the barcode that was actually validated -- ancient UPC codes pre-12 digit usage will be modified,
// if passed a "used" book code of 290 or 291, modifiedCode will contain the 978/979 bookland version.

const validate = (code, type) => {
    // early 1980s era UPC codes were apparently 11 digits, not using a checksum. So, if we get 11, I
    // guess there's not much we can do besides pass it with a 0 prefixing it and hope it works.
    let modifiedCode = code.length === 11 ? `0${code}` : code;
    if (!type) {
        type = getTypeOfBarcode(modifiedCode);
    }
    // console.warn('* validating ', code, modifiedCode, type);
    if (type === 'isbn13') {
        if (modifiedCode.startsWith('290')) {
            const [ junk1, junk2, junk3, ...rest ] = modifiedCode;
            const baseCode = rest.join('');
            modifiedCode = `978${baseCode.slice(0, -1)}${getIsbn13Checksum(`978${baseCode}`)}`;
        } else if (modifiedCode.startsWith('291')) {
            const [ junk1, junk2, junk3, ...rest ] = modifiedCode;
            const baseCode = rest.join('');
            modifiedCode = `979${baseCode.slice(0, -1)}${getIsbn13Checksum(`979${baseCode}`)}`
        }
    }
    let valid = false;
    if (type !== 'asin' && !validationRegex.test(modifiedCode)) {
        type = 'unknown';
    } else {
        valid = validatorMap[type](modifiedCode);
    }
    return {
        code,
        type,
        valid,
        modifiedCode,
    }
}

// console.warn(validate('092091900451')); // valid UPC
// console.warn(validate('92091900451')); // valid old UPC
// console.warn(validate('0083717201410')); // should be a valid EAN / GTIN13
// console.warn(validate('00837172014104')); // should be a valid GTIN14 !!
// console.warn(validate('BOOTSTRA P')); // should be an invalid ASIN
// console.warn(getUpcChecksum('02035616631'));
// console.warn(validate('Test random text'));
// console.warn(validate('2900077274312'));
// console.warn(validate('2900538754575'));
module.exports = validate;
