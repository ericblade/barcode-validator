// Useful information: GTIN13 and EAN are basically the same thing.
// TODO: should also be functions to convert between UPC and EAN.
// TODO: need to also return 978 and 979 versions of 290 and 291 series ISBN barcodes.

/* eslint-disable eqeqeq */
const validationRegex = /^(\d{8,14}|\d{9}[xX])$/;

const toInt = (num) => parseInt(num, 10);

const isOdd = (num) => (num % 2) === 1;

// generates a checksum calculator.  The various checksums we support are all generated in similar
// fashion, just using some slightly different parameters.  In UPC, odd numbers are multiplied by 3,
// in GTIN and ISBN, the even numbers are multiplied by 3.  The difference between ISBN and GTIN checksums
// is that GTIN checksums are calculated from last digit to first, instead of first to last.
// Therefore, we have 3 function parameters: evenMult, oddMult, and shouldReverse.  The formulae are
// otherwise identical between UPC, GTIN, and ISBN.  This may also be true for other types of barcodes,
// but I have not studied those, as these are the most commonly used ones in the United States, where I am
// located. -Eric
// The returned function takes a string containing numbers from 0-9, and calculates a checksum value.
// Note that it does NOT validate that the length of the string is valid -- it returns a checksum based
// on the entire string given to it, it needs to be up to other functions to determine if the length
// is valid or not.
// Note also that ISBN10, which contains "X" as a valid character, has a completely different checksum
// routine, below.
const generateChecksumCalculator = ({ evenMult, oddMult, shouldReverse }) => {
    return (str) => {
        // parseInt makes sure the entire string is an int, but if the first char is a '0',
        // then it strips it, oops.
        // TODO: we need to verify the same thing with ISBNs that end in "X".
        const chunks = parseInt(str).toString().split('').map(toInt);
        if (str.startsWith('0')) chunks.unshift(0);
        const parseChunks = shouldReverse ? chunks.reverse() : chunks;
        if (shouldReverse) parseChunks.shift();
        else parseChunks.pop();

        let checksum = parseChunks.reduce((acc, n, i) => {
            acc += isOdd(i) ? n * evenMult : n * oddMult;
            return acc;
        }, 0);

        checksum %= 10;
        return (checksum === 0) ? 0 : (10 - checksum);
    }
};

// create the UPC, ISBN13, and GTIN checksum generators.
// ([ a, b, c, d, e, f, g, h, i, j, k ] * [ 3 1 3 1 3 1 3 1 3 1 3 1 ]) % 10
const getUpcChecksum = generateChecksumCalculator({ evenMult: 1, oddMult: 3, shouldReverse: false });
// ([ a, b, c, d, e, f, g, h, i, j, k, l ] * [ 1 3 1 3 1 3 1 3 1 3 1 3 ]) % 10
const getIsbn13Checksum = generateChecksumCalculator({ evenMult: 3, oddMult: 1, shouldReverse: false })
// ([ l, k, j, i, h, g, f, e, d, c, b, a ] * [ 1 3 1 3 1 3 1 3 1 3 1 3 ]) % 10
const getGtinChecksum = generateChecksumCalculator({ evenMult: 3, oddMult: 1, shouldReverse: true });

// all of the supported barcode types have their checksum digit as the last digit of the string.
const extractCheckDigit = (code) => {
    const str = code.toString().toUpperCase();
    return str[str.length - 1];
};

// ([ a, b, c, d, e, f, g, h, i ] * [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ]) % 11
const validIsbn10Checksum = (isbn) => {
    const chunks = parseInt(isbn).toString().split('').map(toInt);
    if (extractCheckDigit(isbn) === 'X') {
        chunks.push(10);
    }
    if (isbn.startsWith('0')) {
        chunks.unshift(0);
    }
    // console.warn('* chunks=', chunks);
    const check = chunks.reduce((acc, n, i) => {
        acc += (n * (i + 1));
        return acc;
    }, 0);
    return (check % 11) === 0;
};

const validUpcChecksum = (upc) => {
    const check = extractCheckDigit(upc);
    // console.warn('* check digit=', check);
    return getUpcChecksum(upc) == check || getGtinChecksum(upc) == check;
}

const validGtinChecksum = (gtin) => {
    const check = extractCheckDigit(gtin);
    return getGtinChecksum(gtin) == check;
}

const validIsbn13Checksum = (isbn) => {
    const check = extractCheckDigit(isbn);
    return getIsbn13Checksum(isbn) == check;
}

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
    // 1980s era UPC codes were apparently 11 digits, not using a checksum. So, if we get 11, I
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
